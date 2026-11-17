/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageChangeScript } from "@noldova/browser.protocol";
import type { IModuleLog, IWebViewRelay, WebViewProtocolEvent } from "@noldova/desktop.runtime";

import { BrowserRuntimeException } from "../exceptions/browser-runtime.exception.ts";
import { CallFailureException } from "../exceptions/call-failure.exception.ts";
import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import { PageChangesContextMissingException } from "../exceptions/page-changes-context-missing.exception.ts";
import { PageChangesNotSwitchedException } from "../exceptions/page-changes-not-switched.exception.ts";
import { BrowserLimits } from "../models/browser-limits.ts";
import type { CallOptions } from "../models/call-options.ts";
import { ElementFactsScript } from "../models/element-facts-script.ts";
import { PageFrames } from "../models/page-frames.ts";
import { PageTextScript } from "../models/page-text-script.ts";
import { Resources } from "../resources.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";
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

  public async hearAsync(viewId: string, options: CallOptions, changed: () => void): Promise<() => void> {
    const contexts: string[] = [];
    let release: () => void = () => undefined;
    const stopEvents: () => void = this.relay.onProtocolEvent(viewId, (event: WebViewProtocolEvent) => {
      if (event.method === Resources.frameNavigatedEvent || event.method === Resources.bindingCalledEvent && event.params[Resources.nameField] === PageChangeScript.bindingName)
        changed();
    });
    const stop = (): void => {
      stopEvents();
      release();
      for (const uniqueContextId of contexts)
        void this.switchAsync(viewId, uniqueContextId, false, ViewCalls.releasing(options)).catch((error: unknown) => this.logStopFailure(viewId, error));
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
    const { origin, mainId }: PageFrames = PageChanges.readFrames(await this.calls.sendAsync(viewId, Resources.getFrameTreeMethod, {}, options));
    await this.domains.startAsync(viewId, origin, (method, params) => this.calls.sendAsync(viewId, method, params, options));
    const uniqueContextId: string = await this.findWorldAsync(viewId, mainId, options);
    const reply: JsonObject = await this.calls.sendAsync(viewId, Resources.callFunctionOnMethod, {
      functionDeclaration: PageTextScript.functionDeclaration, uniqueContextId, arguments: [{ value: text }], returnByValue: true, silent: true
    }, options);
    const result: JsonValue | undefined = reply[Resources.resultField];
    const has: JsonValue | undefined = JsonShapes.isObject(result) ? result[Resources.valueField] : undefined;
    if (typeof has !== "boolean")
      throw new MalformedReplyException();
    return has;
  }

  // The element's facts, as the one pinned function reads them in the page changes' isolated world of the main frame, where the element is
  // resolved, so the page's own script never sees the call or changes what it reads; the reply holds only those facts, never the whole document.
  public async readElementAsync(viewId: string, backendNodeId: number, options: CallOptions): Promise<JsonObject> {
    const { mainId }: PageFrames = PageChanges.readFrames(await this.calls.sendAsync(viewId, Resources.getFrameTreeMethod, {}, options));
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
    return this.calls.sendAsync(viewId, Resources.callFunctionOnMethod, { functionDeclaration: ElementFactsScript.functionDeclaration, objectId, returnByValue: true, silent: true },
      options.withMaximumReplyBytes(BrowserLimits.maximumTreeReplyBytes));
  }

  private async startAsync(viewId: string, frameId: string, options: CallOptions, contexts: string[]): Promise<void> {
    const uniqueId: string = await this.findWorldAsync(viewId, frameId, options);
    contexts.push(uniqueId);
    if (await this.switchAsync(viewId, uniqueId, true, options) !== true)
      throw new PageChangesNotSwitchedException(viewId, frameId);
  }

  private async findWorldAsync(viewId: string, frameId: string, options: CallOptions): Promise<string> {
    const world: JsonObject = await this.calls.sendAsync(viewId, Resources.createIsolatedWorldMethod, { frameId, worldName: PageChangeScript.worldName, grantUniveralAccess: false },
      options);
    const id: JsonValue | undefined = world[Resources.executionContextIdField];
    const uniqueId: string | null = typeof id === "number"
      ? await this.domains.findContextAsync(viewId, id, frameId, PageChangeScript.worldName, options.deadline - Date.now(), options.signal)
      : null;
    if (uniqueId === null)
      throw options.signal.aborted ? ToolFailures.fromAbort(options.signal.reason) : new PageChangesContextMissingException(viewId, frameId);
    return uniqueId;
  }

  private async switchAsync(viewId: string, uniqueContextId: string, isOn: boolean, options: CallOptions): Promise<JsonValue | undefined> {
    const reply: JsonObject = await this.calls.sendAsync(viewId, Resources.callFunctionOnMethod, {
      functionDeclaration: PageChangeScript.functionDeclaration, uniqueContextId, arguments: [{ value: isOn }], returnByValue: true, silent: true
    }, options);
    const result: JsonValue | undefined = reply[Resources.resultField];
    return JsonShapes.isObject(result) ? result[Resources.valueField] : undefined;
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
