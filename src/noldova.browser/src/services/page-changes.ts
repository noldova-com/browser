/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElementFactsScript, PageChangeScript } from "@noldova/browser.protocol";
import type { IModuleLog, IWebViewRelay, WebViewProtocolEvent } from "@noldova/desktop.runtime";

import { BrowserRuntimeException } from "../exceptions/browser-runtime.exception.ts";
import { CallFailureException } from "../exceptions/call-failure.exception.ts";
import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import { PageChangesContextMissingException } from "../exceptions/page-changes-context-missing.exception.ts";
import { PageChangesNotSwitchedException } from "../exceptions/page-changes-not-switched.exception.ts";
import { PageCrashedException } from "../exceptions/page-crashed.exception.ts";
import { ProfileClearedException } from "../exceptions/profile-cleared.exception.ts";
import { ProtocolFailedException } from "../exceptions/protocol-failed.exception.ts";
import { ViewClosedException } from "../exceptions/view-closed.exception.ts";
import { BrowserLimits } from "../models/browser-limits.ts";
import type { CallOptions } from "../models/call-options.ts";
import { MarkedSnapshot } from "../models/marked-snapshot.ts";
import { PageFrames } from "../models/page-frames.ts";
import { PageSnapshotScript } from "../models/page-snapshot-script.ts";
import { PageTextScript } from "../models/page-text-script.ts";
import { ResolvedElement } from "../models/resolved-element.ts";
import { Resources } from "../resources.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";
import { FrameTreeReader } from "./frame-tree.reader.ts";
import { JsonShapes } from "./json-shapes.ts";
import type { RuntimeDomains } from "./runtime-domains.ts";
import { ToolFailures } from "./tool-failures.ts";
import { ViewCalls } from "./view-calls.ts";

export class PageChanges {
  private readonly relay: IWebViewRelay;
  private readonly calls: ViewCalls;
  private readonly domains: RuntimeDomains;
  private readonly log: IModuleLog;

  public constructor(relay: IWebViewRelay, calls: ViewCalls, domains: RuntimeDomains, log: IModuleLog) {
    this.relay = relay;
    this.calls = calls;
    this.domains = domains;
    this.log = log;
  }

  // A frame's navigation gives it a new document, which has neither the world nor its function, so the hearing starts again in that frame and
  // calls back once more when it has, for what the new document shows by then.
  public async hearAsync(viewId: string, options: CallOptions, changed: () => void): Promise<() => void> {
    const contexts: string[] = [];
    let isStopped: boolean = false;
    let release: () => void = () => undefined;
    const restartAsync = async (frameId: string): Promise<void> => {
      const started: string[] = [];
      try {
        await this.startAsync(viewId, frameId, options, started);
      }
      finally {
        if (isStopped)
          this.stopAll(viewId, started, options);
        else
          contexts.push(...started);
      }
      if (!isStopped)
        changed();
    };
    const stopEvents: () => void = this.relay.onProtocolEvent(viewId, (event: WebViewProtocolEvent) => {
      if (event.method === Resources.frameNavigatedEvent) {
        changed();
        const frame: JsonValue | undefined = event.params[Resources.frameField];
        const frameId: JsonValue | undefined = JsonShapes.isObject(frame) ? frame[Resources.idField] : undefined;
        if (typeof frameId === "string")
          void restartAsync(frameId).catch((error: unknown) => this.logRestartFailure(viewId, error));
      }
      else if (event.method === Resources.bindingCalledEvent && event.params[Resources.nameField] === PageChangeScript.bindingName)
        changed();
    });
    const stop = (): void => {
      isStopped = true;
      stopEvents();
      release();
      this.stopAll(viewId, contexts, options);
    };
    try {
      const { origin, mainId, childIds }: PageFrames = PageChanges.readFrames(await this.calls.sendAsync(viewId, Resources.getFrameTreeMethod, {}, options));
      release = await this.domains.keepAsync(viewId, origin, Resources.addBindingMethod, { name: PageChangeScript.bindingName, executionContextName: PageChangeScript.worldName },
        (method, params) => this.calls.sendAsync(viewId, method, params, options)).catch((error: unknown) => {
        this.domains.drop(viewId);
        throw error;
      });
      const main: Promise<void> = this.startAsync(viewId, mainId, options, contexts);
      const outcomes: readonly PromiseSettledResult<void>[] = await Promise.allSettled([main, ...childIds.map(t => this.startAsync(viewId, t, options, contexts))]);
      await main;
      const bug: PromiseRejectedResult | undefined = outcomes.find((t): t is PromiseRejectedResult => t.status === "rejected" && !(t.reason instanceof BrowserRuntimeException));
      if (bug !== undefined)
        throw bug.reason;
    }
    catch (error) {
      stop();
      throw error;
    }
    return stop;
  }

  // Whether the page's main frame shows the text, as the one pinned function reads it in the page changes' isolated world of that frame,
  // which the engine keeps by its name, so the page's own world and script never see the call.
  public async hasTextAsync(viewId: string, text: string, options: CallOptions): Promise<boolean> {
    const result: JsonValue | undefined = await this.runInMainWorldAsync(viewId, PageTextScript.functionDeclaration, text, true, options);
    const has: JsonValue | undefined = JsonShapes.isObject(result) ? result[Resources.valueField] : undefined;
    if (typeof has !== "boolean")
      throw new MalformedReplyException();
    return has;
  }

  // The page's lines as the pinned snapshot function walks them in the same world, by value, within the tree reply's bound. The hosts of
  // closed shadow roots go to it as objects in that world and are released after it; a host the page removed since is left out, so the
  // snapshot comes with the hosts it was given, in their order.
  public async snapshotAsync(viewId: string, request: JsonObject, hosts: readonly number[], options: CallOptions): Promise<MarkedSnapshot> {
    const { origin, mainId }: PageFrames = PageChanges.readFrames(await this.calls.sendAsync(viewId, Resources.getFrameTreeMethod, {}, options));
    await this.domains.startAsync(viewId, origin, (method, params) => this.calls.sendAsync(viewId, method, params, options));
    const [executionContextId, uniqueContextId]: [number, string] = await this.findWorldIdsAsync(viewId, mainId, options);
    const objects: string[] = [];
    try {
      const given: number[] = [];
      for (const host of hosts)
        if (await this.markAsync(viewId, host, executionContextId, objects, options))
          given.push(host);
      const reply: JsonObject = await this.calls.sendAsync(viewId, Resources.callFunctionOnMethod, {
        functionDeclaration: PageSnapshotScript.functionDeclaration, uniqueContextId,
        arguments: [{ value: request }, ...objects.map(t => ({ objectId: t }))], returnByValue: true, silent: true
      }, options.withMaximumReplyBytes(BrowserLimits.maximumTreeReplyBytes));
      const result: JsonValue | undefined = reply[Resources.resultField];
      const snapshot: JsonValue | undefined = JsonShapes.isObject(result) ? result[Resources.valueField] : undefined;
      if (!JsonShapes.isObject(snapshot))
        throw new MalformedReplyException();
      return new MarkedSnapshot(snapshot, given);
    }
    finally {
      for (const objectId of objects)
        await this.releaseAsync(viewId, objectId, options);
    }
  }

  // The element the last snapshot gave the index, as an object in the same world, or none once it left the page; the caller releases it.
  public async findSnapshotElementAsync(viewId: string, index: number, options: CallOptions): Promise<string | null> {
    const result: JsonValue | undefined = await this.runInMainWorldAsync(viewId, PageSnapshotScript.functionDeclaration, { [Resources.elementField]: index },
      false, options);
    if (JsonShapes.isObject(result) && result[Resources.subtypeField] === Resources.nullSubtype)
      return null;
    const objectId: JsonValue | undefined = JsonShapes.isObject(result) ? result[Resources.objectIdField] : undefined;
    if (typeof objectId !== "string")
      throw new MalformedReplyException();
    return objectId;
  }

  // The element as an object in the page changes' isolated world of the main frame, where the pinned function reads it, so the page's own
  // script never sees the calls or changes what they read, with the document the world was found in; the caller releases the object.
  public async resolveElementAsync(viewId: string, backendNodeId: number, options: CallOptions): Promise<ResolvedElement> {
    const tree: JsonObject = await this.calls.sendAsync(viewId, Resources.getFrameTreeMethod, {}, options);
    const { mainId }: PageFrames = PageChanges.readFrames(tree);
    const world: JsonObject = await this.calls.sendAsync(viewId, Resources.createIsolatedWorldMethod, { frameId: mainId, worldName: PageChangeScript.worldName, grantUniveralAccess: false },
      options);
    const executionContextId: JsonValue | undefined = world[Resources.executionContextIdField];
    if (typeof executionContextId !== "number")
      throw new PageChangesContextMissingException(viewId, mainId);
    const resolved: JsonObject = await this.calls.sendAsync(viewId, Resources.resolveNodeMethod, { backendNodeId, executionContextId }, options);
    const element: JsonValue | undefined = resolved[Resources.objectField];
    const objectId: JsonValue | undefined = JsonShapes.isObject(element) ? element[Resources.objectIdField] : undefined;
    if (typeof objectId !== "string")
      throw new MalformedReplyException();
    return new ResolvedElement(objectId, FrameTreeReader.read(tree).documentId);
  }

  // The resolved element's facts, by value, so the reply holds only those facts, never the whole document.
  public async readElementAsync(viewId: string, objectId: string, options: CallOptions): Promise<JsonObject> {
    return this.calls.sendAsync(viewId, Resources.callFunctionOnMethod,
      { functionDeclaration: ElementFactsScript.functionDeclaration, objectId, arguments: [{ value: false }], returnByValue: true, silent: true },
      options.withMaximumReplyBytes(BrowserLimits.maximumTreeReplyBytes));
  }

  // The whole subtree of the form the resolved element belongs to, through every shadow root, closed ones too, which the function in the
  // isolated world can't enter; none when the element belongs to no form.
  public async readFormAsync(viewId: string, objectId: string, options: CallOptions): Promise<JsonObject | null> {
    const reply: JsonObject = await this.calls.sendAsync(viewId, Resources.callFunctionOnMethod,
      { functionDeclaration: ElementFactsScript.functionDeclaration, objectId, arguments: [{ value: true }], returnByValue: false, silent: true }, options);
    const result: JsonValue | undefined = reply[Resources.resultField];
    if (JsonShapes.isObject(result) && result[Resources.subtypeField] === Resources.nullSubtype)
      return null;
    const form: JsonValue | undefined = JsonShapes.isObject(result) ? result[Resources.objectIdField] : undefined;
    if (typeof form !== "string")
      throw new MalformedReplyException();
    try {
      return await this.calls.sendAsync(viewId, Resources.describeNodeMethod, { objectId: form, depth: Resources.wholeSubtreeDepth, pierce: true },
        options.withMaximumReplyBytes(BrowserLimits.maximumTreeReplyBytes));
    }
    finally {
      await this.releaseAsync(viewId, form, options);
    }
  }

  // Lets the engine drop an object the module made, which it otherwise keeps, with the node it holds, for as long as its world lives; an
  // object whose document has gone, or whose view closed, crashed or lost its profile, has nothing left to release.
  public async releaseAsync(viewId: string, objectId: string, options: CallOptions): Promise<void> {
    try {
      await this.calls.sendAsync(viewId, Resources.releaseObjectMethod, { objectId }, ViewCalls.releasing(options));
    }
    catch (error) {
      if (!(error instanceof CallFailureException))
        throw error;
      if (!(error instanceof ProtocolFailedException || error instanceof ViewClosedException || error instanceof PageCrashedException
        || error instanceof ProfileClearedException))
        this.log.write(Resources.formatObjectNotReleased(viewId, String(error)));
    }
  }

  private async runInMainWorldAsync(viewId: string, functionDeclaration: string, value: JsonValue, returnByValue: boolean,
    options: CallOptions): Promise<JsonValue | undefined> {
    const { origin, mainId }: PageFrames = PageChanges.readFrames(await this.calls.sendAsync(viewId, Resources.getFrameTreeMethod, {}, options));
    await this.domains.startAsync(viewId, origin, (method, params) => this.calls.sendAsync(viewId, method, params, options));
    const uniqueContextId: string = await this.findWorldAsync(viewId, mainId, options);
    const reply: JsonObject = await this.calls.sendAsync(viewId, Resources.callFunctionOnMethod, {
      functionDeclaration, uniqueContextId, arguments: [{ value }], returnByValue, silent: true
    }, options);
    return reply[Resources.resultField];
  }

  // The node as an object in the world, kept to release; none for a node the page removed since it was found.
  private async markAsync(viewId: string, backendNodeId: number, executionContextId: number, objects: string[], options: CallOptions): Promise<boolean> {
    let resolved: JsonObject;
    try {
      resolved = await this.calls.sendAsync(viewId, Resources.resolveNodeMethod, { backendNodeId, executionContextId }, options);
    }
    catch (error) {
      if (!(error instanceof ProtocolFailedException))
        throw error;
      return false;
    }
    const element: JsonValue | undefined = resolved[Resources.objectField];
    const objectId: JsonValue | undefined = JsonShapes.isObject(element) ? element[Resources.objectIdField] : undefined;
    if (typeof objectId !== "string")
      throw new MalformedReplyException();
    objects.push(objectId);
    return true;
  }

  private async startAsync(viewId: string, frameId: string, options: CallOptions, contexts: string[]): Promise<void> {
    const uniqueId: string = await this.findWorldAsync(viewId, frameId, options);
    contexts.push(uniqueId);
    if (await this.switchAsync(viewId, uniqueId, true, options) !== true)
      throw new PageChangesNotSwitchedException(viewId, frameId);
  }

  private async findWorldAsync(viewId: string, frameId: string, options: CallOptions): Promise<string> {
    return (await this.findWorldIdsAsync(viewId, frameId, options))[1];
  }

  // The world's context by its number in this process, which DOM.resolveNode takes, and by its unique id, which a call takes.
  private async findWorldIdsAsync(viewId: string, frameId: string, options: CallOptions): Promise<[number, string]> {
    const world: JsonObject = await this.calls.sendAsync(viewId, Resources.createIsolatedWorldMethod, { frameId, worldName: PageChangeScript.worldName, grantUniveralAccess: false },
      options);
    const id: JsonValue | undefined = world[Resources.executionContextIdField];
    const uniqueId: string | null = typeof id === "number"
      ? await this.domains.findContextAsync(viewId, id, frameId, PageChangeScript.worldName, options.deadline - Date.now(), options.signal)
      : null;
    if (uniqueId === null || typeof id !== "number")
      throw options.signal.aborted ? ToolFailures.fromAbort(options.signal.reason) : new PageChangesContextMissingException(viewId, frameId);
    return [id, uniqueId];
  }

  private async switchAsync(viewId: string, uniqueContextId: string, isOn: boolean, options: CallOptions): Promise<JsonValue | undefined> {
    const reply: JsonObject = await this.calls.sendAsync(viewId, Resources.callFunctionOnMethod, {
      functionDeclaration: PageChangeScript.functionDeclaration, uniqueContextId, arguments: [{ value: isOn }], returnByValue: true, silent: true
    }, options);
    const result: JsonValue | undefined = reply[Resources.resultField];
    return JsonShapes.isObject(result) ? result[Resources.valueField] : undefined;
  }

  private stopAll(viewId: string, contexts: readonly string[], options: CallOptions): void {
    for (const uniqueContextId of contexts)
      void this.switchAsync(viewId, uniqueContextId, false, ViewCalls.releasing(options)).catch((error: unknown) => this.logStopFailure(viewId, error));
  }

  // A frame that navigates again, or a view that closes, before the new document's world forms fails as the view does; anything else is a bug.
  private logRestartFailure(viewId: string, error: unknown): void {
    if (!(error instanceof BrowserRuntimeException))
      this.log.write(Resources.formatChangesNotRestarted(viewId, String(error)));
  }

  private logStopFailure(viewId: string, error: unknown): void {
    if (!(error instanceof CallFailureException))
      this.log.write(Resources.formatChangesNotStopped(viewId, String(error)));
  }

  private static readFrames(reply: JsonObject): PageFrames {
    const tree: JsonValue | undefined = reply[Resources.frameTreeField];
    const frame: JsonValue | undefined = JsonShapes.isObject(tree) ? tree[Resources.frameField] : undefined;
    const mainId: JsonValue | undefined = JsonShapes.isObject(frame) ? frame[Resources.idField] : undefined;
    const origin: JsonValue | undefined = JsonShapes.isObject(frame) ? frame[Resources.securityOriginField] : undefined;
    if (!JsonShapes.isObject(tree) || typeof mainId !== "string" || typeof origin !== "string")
      throw new MalformedReplyException();
    return new PageFrames(origin, mainId, PageChanges.readChildIds(tree));
  }

  private static readChildIds(tree: JsonObject): readonly string[] {
    const children: JsonValue | undefined = tree[Resources.childFramesField];
    return (JsonShapes.isArray(children) ? children : []).filter(JsonShapes.isObject).flatMap(child => {
      const frame: JsonValue | undefined = child[Resources.frameField];
      const id: JsonValue | undefined = JsonShapes.isObject(frame) ? frame[Resources.idField] : undefined;
      return typeof id === "string" ? [id, ...PageChanges.readChildIds(child)] : [];
    });
  }
}
