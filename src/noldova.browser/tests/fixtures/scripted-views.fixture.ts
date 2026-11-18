/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";

import { PageChangeScript } from "@noldova/browser.protocol";
import { QualifiedName, WebViewAction, WebViewDeclaration, WebViewEvent, WebViewEventKind, WebViewFailure, WebViewFailureKind, WebViewInfo,
  WebViewNavigation, WebViewNavigationKind, WebViewPane } from "@noldova/desktop.protocol";
import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
import { WebViewFailureException, WebViewProtocolEvent } from "@noldova/desktop.runtime";
import { FakeRuntimeWebViews } from "@noldova/desktop.runtime/testing";

import { PageSnapshotScript } from "../../src/models/page-snapshot-script.ts";
import { JsonShapes } from "../../src/services/json-shapes.ts";
import type { JsonObject, JsonValue } from "../../src/types/json-value.ts";

export interface IRelayCall {
  readonly viewId: string;
  readonly method: string;
  readonly params: JsonObject;
  readonly timeoutMilliseconds: number;
}

export interface INavigationCall {
  readonly viewId: string;
  readonly target: string;
}

type Answer = { readonly kind: "reply"; readonly reply: JsonValue } | { readonly kind: "computed"; readonly compute: (params: JsonObject) => JsonValue | Promise<JsonValue> } | { readonly kind: "failure"; readonly failure: WebViewFailure } | { readonly kind: "hang" };

interface IPendingCall {
  readonly viewId: string;
  readonly reject: (error: WebViewFailureException) => void;
}

export class UnscriptedMethodException extends UnansweredCallException {
  public readonly method: string;

  public constructor(method: string) {
    super("sendAsync");
    this.method = method;
    this.message = `The scripted views have no answer for ${method}; a test gives one with answer, answerWith, acknowledge, fail or hang before the code under test sends it.`;
  }
}

const DECLARED: unknown = JSON.parse(readFileSync(new URL("../../webViews.json", import.meta.url), "utf8"));

export class ScriptedViews {
  public static readonly moduleId: string = "browser";
  public static readonly pane: WebViewPane = new WebViewPane(new QualifiedName("browser", "pane"));
  public static readonly declaration: WebViewDeclaration = WebViewDeclaration.fromJson(DECLARED);
  public static readonly snapshotElementPrefix: string = "snapshot-element-";
  public static readonly emptyReplies: readonly string[] = [
    "Page.enable", "DOM.scrollIntoViewIfNeeded", "DOM.focus",
    "Emulation.setDeviceMetricsOverride", "Emulation.clearDeviceMetricsOverride",
    "Input.dispatchMouseEvent", "Input.dispatchKeyEvent", "Input.insertText",
    "Runtime.enable", "Runtime.disable", "Runtime.discardConsoleEntries", "Runtime.addBinding", "Runtime.releaseObject", "Log.enable"
  ];
  private readonly views: Set<string>;
  private readonly foreignViews: ReadonlySet<string>;
  private readonly lost: Map<string, WebViewFailure> = new Map();
  private readonly answers: Map<string, Answer> = new Map();
  private readonly pending: Set<IPendingCall> = new Set();
  private readonly allowWaits: Map<string, ((origins: readonly string[]) => void)[]> = new Map();
  public readonly webViews: FakeRuntimeWebViews = new FakeRuntimeWebViews();
  public readonly calls: IRelayCall[] = [];
  public readonly navigations: INavigationCall[] = [];
  public readonly clearedProfiles: string[] = [];
  public readonly allowedOrigins: Map<string, readonly string[]> = new Map();
  public readonly profileKeys: Map<string, string> = new Map();
  public readonly instances: Map<string, string> = new Map();
  public afterNavigation: (viewId: string) => void = () => undefined;
  public navigationOutcome: WebViewNavigation = new WebViewNavigation(WebViewNavigationKind.Started);
  public allowing: () => Promise<void> = async () => undefined;
  // What the pinned snapshot function replies to each request, once the worlds are served, and the indexes of the elements that left the page.
  public snapshot: (request: JsonObject) => JsonValue | Promise<JsonValue> = () => ScriptedViews.snapshotOf("Cart", []);
  public readonly snapshotRequests: JsonObject[] = [];
  // The objects each snapshot was given after its request: the hosts of closed shadow roots.
  public readonly snapshotObjects: (readonly string[])[] = [];
  public readonly goneElements: Set<number> = new Set();
  public findElement: (index: number) => JsonValue = (index: number) => ({ result: this.goneElements.has(index) ? { type: "object", subtype: "null", value: null }
    : { type: "object", subtype: "node", objectId: `${ScriptedViews.snapshotElementPrefix}${index}` } });
  private isServingSnapshots: boolean = false;

  public constructor(viewIds: readonly string[], foreignViewIds: readonly string[] = []) {
    this.views = new Set(viewIds);
    this.foreignViews = new Set(foreignViewIds);
    this.webViews.answer("list", () => this.list());
    this.webViews.answer("navigateAsync", (viewId, url) => this.navigateAsync(viewId, url));
    this.webViews.answer("actAsync", (viewId, action) => this.actAsync(viewId, action));
    this.webViews.answer("setAllowedOriginsAsync", (viewId, origins) => this.setAllowedOriginsAsync(viewId, origins));
    this.webViews.answer("clearProfileAsync", profileKey => this.clearProfileAsync(profileKey));
    this.webViews.answer("setControlledAsync", () => Promise.resolve());
    this.webViews.relay.answer("sendAsync", (viewId, method, params, timeoutMilliseconds) => {
      this.calls.push({ viewId, method, params, timeoutMilliseconds });
      return this.sendAsync(viewId, method, params);
    });
  }

  public get relay(): FakeRuntimeWebViews["relay"] {
    return this.webViews.relay;
  }

  public get viewListenerCount(): number {
    return this.webViews.activeCallsOf("onViewEvent").length;
  }

  public get protocolListenerCount(): number {
    return this.webViews.relay.activeCallsOf("onProtocolEvent").length;
  }

  public get pendingCount(): number {
    return this.pending.size;
  }

  public answer(method: string, reply: JsonValue): void {
    this.answers.set(method, { kind: "reply", reply });
  }

  public answerWith(method: string, compute: (params: JsonObject) => JsonValue | Promise<JsonValue>): void {
    this.answers.set(method, { kind: "computed", compute });
  }

  public acknowledge(...methods: readonly string[]): void {
    for (const method of methods)
      this.answer(method, {});
  }

  public fail(method: string, failure: WebViewFailure): void {
    this.answers.set(method, { kind: "failure", failure });
  }

  public hang(method: string): void {
    this.answers.set(method, { kind: "hang" });
  }

  public allowedAsync(viewId: string): Promise<readonly string[]> {
    const { promise, resolve }: PromiseWithResolvers<readonly string[]> = Promise.withResolvers<readonly string[]>();
    this.allowWaits.set(viewId, [...this.allowWaits.get(viewId) ?? [], resolve]);
    return promise;
  }

  // Each view's isolated worlds, made once per frame and name, reported as the engine reports them: when made, and each again when the
  // runtime is enabled.
  public serveWorlds(): void {
    const worlds: Map<string, number> = new Map();
    const contexts: Map<string, JsonObject[]> = new Map();
    this.answerWith("Page.createIsolatedWorld", (params: JsonObject) => {
      const viewId: string = this.calls.at(-1)?.viewId ?? "";
      const key: string = `${viewId} ${String(params["frameId"])} ${String(params["worldName"])}`;
      const id: number = worlds.get(key) ?? worlds.size + 1;
      if (!worlds.has(key)) {
        const context: JsonObject = { id, uniqueId: `${viewId}.${id}`, name: params["worldName"] ?? null, origin: "https://shop.test", auxData: { frameId: params["frameId"] ?? null } };
        contexts.set(viewId, [...contexts.get(viewId) ?? [], context]);
        this.emitProtocolEvent(viewId, "Runtime.executionContextCreated", { context });
      }
      worlds.set(key, id);
      return { executionContextId: id };
    });
    this.answerWith("Runtime.enable", () => {
      const viewId: string = this.calls.at(-1)?.viewId ?? "";
      for (const context of contexts.get(viewId) ?? [])
        this.emitProtocolEvent(viewId, "Runtime.executionContextCreated", { context });
      return {};
    });
    this.answer("Runtime.callFunctionOn", { result: { type: "boolean", value: true } });
    this.isServingSnapshots = true;
  }

  // The snapshot function's reply: the document's line, then the lines given as [depth, role, name, value, isMasked, index, host], a line
  // without its host's number standing for none.
  public static snapshotOf(title: string, lines: readonly JsonValue[], isCut: boolean = false, isDeeper: boolean = false, isFromView: boolean = false): JsonObject {
    const full: JsonValue[] = lines.map(t => JsonShapes.isArray(t) && t.length === 6 ? [...t, -1] : t);
    return ScriptedViews.byValue({ title, lines: [[0, "RootWebArea", title, "", false, -1, -1], ...full], isCut, isDeeper, isFromView });
  }

  // A function's reply that gives the value by value.
  public static byValue(value: JsonValue): JsonObject {
    return { result: { type: "object", value } };
  }

  public reportChange(viewId: string): void {
    this.emitProtocolEvent(viewId, "Runtime.bindingCalled", { name: PageChangeScript.bindingName, payload: "", executionContextId: 1 });
  }

  public emitProtocolEvent(viewId: string, method: string, params: JsonObject): void {
    this.webViews.relay.raiseProtocolEvent(viewId, new WebViewProtocolEvent(viewId, method, params, false));
  }

  public emitViewEvent(viewId: string, kind: WebViewEventKind, details: JsonObject = {}): void {
    this.emit(new WebViewEvent(ScriptedViews.moduleId, viewId, kind, details));
  }

  public emit(event: WebViewEvent): void {
    this.webViews.raiseViewEvent(event);
  }

  public open(viewId: string, profileKey: string): void {
    this.views.add(viewId);
    this.profileKeys.set(viewId, profileKey);
    this.emitViewEvent(viewId, WebViewEventKind.Opened, { pane: ScriptedViews.pane.toJson(), profileKey });
  }

  public crash(viewId: string): void {
    this.lose(viewId, WebViewFailureKind.Crashed);
    this.emitViewEvent(viewId, WebViewEventKind.Crashed);
  }

  public close(viewId: string): void {
    this.lose(viewId, WebViewFailureKind.ViewClosed);
    this.emitViewEvent(viewId, WebViewEventKind.Closed);
  }

  private list(): readonly WebViewInfo[] {
    return [...this.views]
      .filter(t => !this.isClosed(t))
      .map(t => new WebViewInfo(t, ScriptedViews.moduleId, this.paneOf(t), this.profileKeyOf(t)));
  }

  private async sendAsync(viewId: string, method: string, params: JsonObject): Promise<JsonValue> {
    this.refuseUnreachable(viewId);
    const wireParams: unknown = JSON.parse(JSON.stringify(params));
    if (!ScriptedViews.declaration.allows(method, wireParams))
      throw new WebViewFailureException(new WebViewFailure(WebViewFailureKind.NotAllowed));
    if (this.isServingSnapshots && method === "Runtime.callFunctionOn" && params["functionDeclaration"] === PageSnapshotScript.functionDeclaration)
      return this.answerSnapshotAsync(params);
    const objectId: JsonValue | undefined = params["objectId"];
    if (this.isServingSnapshots && method === "DOM.describeNode" && typeof objectId === "string" && objectId.startsWith(ScriptedViews.snapshotElementPrefix))
      return { node: { backendNodeId: Number(objectId.slice(ScriptedViews.snapshotElementPrefix.length)), nodeName: "DIV" } };
    const answer: Answer | undefined = this.answers.get(method) ?? this.defaultAnswer(method, params);
    if (answer === undefined)
      throw new UnscriptedMethodException(method);
    if (answer.kind === "failure")
      throw new WebViewFailureException(answer.failure);
    if (answer.kind === "reply")
      return answer.reply;
    if (answer.kind === "computed")
      return answer.compute(params);
    return new Promise<JsonValue>((_resolve, reject) => {
      this.pending.add({ viewId, reject });
    });
  }

  // Once the worlds are served, a page without closed shadow roots: the document holds only its root element, which a test can script.
  private defaultAnswer(method: string, params: JsonObject): Answer | undefined {
    if (!this.isServingSnapshots)
      return undefined;
    if (method === "DOM.getDocument")
      return { kind: "reply", reply: { root: { backendNodeId: 1, nodeType: 9, nodeName: "#document" } } };
    if (method === "DOM.describeNode" && params["backendNodeId"] === 1)
      return { kind: "reply", reply: { node: { backendNodeId: 1, nodeType: 9, nodeName: "#document", children: [{ backendNodeId: 2, nodeType: 1, localName: "html" }] } } };
    return undefined;
  }

  // An element the page keeps by its index is given as an object whose id names the index, which DOM.describeNode gives as its node.
  private async answerSnapshotAsync(params: JsonObject): Promise<JsonValue> {
    const passed: JsonValue | undefined = params["arguments"];
    const [argument, ...objects]: readonly JsonValue[] = JsonShapes.isArray(passed) ? passed : [];
    const request: JsonValue | undefined = JsonShapes.isObject(argument) ? argument["value"] : undefined;
    if (!JsonShapes.isObject(request))
      throw new Error("The snapshot function was called without a request.");
    const index: JsonValue | undefined = request["element"];
    if (typeof index === "number")
      return this.findElement(index);
    this.snapshotRequests.push(request);
    this.snapshotObjects.push(objects.map(t => JsonShapes.isObject(t) ? String(t["objectId"]) : ""));
    return this.snapshot(request);
  }

  private async navigateAsync(viewId: string, url: string): Promise<WebViewNavigation> {
    this.navigations.push({ viewId, target: url });
    this.refuseUnowned(viewId);
    if (this.isCrashed(viewId) && this.navigationOutcome.kind === WebViewNavigationKind.Started)
      this.lost.delete(viewId);
    this.afterNavigation(viewId);
    return this.navigationOutcome;
  }

  private async actAsync(viewId: string, action: WebViewAction): Promise<WebViewNavigation> {
    this.navigations.push({ viewId, target: action });
    this.refuseUnowned(viewId);
    if (this.isCrashed(viewId) && action === WebViewAction.Reload)
      return new WebViewNavigation(WebViewNavigationKind.NoHistory);
    this.afterNavigation(viewId);
    return this.navigationOutcome;
  }

  private async setAllowedOriginsAsync(viewId: string, origins: readonly string[]): Promise<void> {
    this.refuseUnowned(viewId);
    await this.allowing();
    this.allowedOrigins.set(viewId, [...origins]);
    const waits: readonly ((origins: readonly string[]) => void)[] = this.allowWaits.get(viewId) ?? [];
    this.allowWaits.delete(viewId);
    waits.forEach(t => t([...origins]));
  }

  private async clearProfileAsync(profileKey: string): Promise<void> {
    this.clearedProfiles.push(profileKey);
    const views: readonly string[] = [...this.views].filter(t => !this.isClosed(t) && this.profileKeyOf(t) === profileKey);
    for (const viewId of views)
      this.endPending(viewId, WebViewFailureKind.ProfileCleared);
    for (const viewId of views)
      this.emitViewEvent(viewId, WebViewEventKind.ProfileCleared, { profileKey });
  }

  private refuseUnreachable(viewId: string): void {
    this.refuseUnowned(viewId);
    if (this.isCrashed(viewId))
      throw new WebViewFailureException(new WebViewFailure(WebViewFailureKind.Crashed));
  }

  private refuseUnowned(viewId: string): void {
    if (this.isClosed(viewId) || (!this.views.has(viewId) && !this.foreignViews.has(viewId)))
      throw new WebViewFailureException(new WebViewFailure(WebViewFailureKind.ViewClosed));
    if (this.foreignViews.has(viewId))
      throw new WebViewFailureException(new WebViewFailure(WebViewFailureKind.NotOwned));
  }

  private isClosed(viewId: string): boolean {
    return this.lost.get(viewId)?.kind === WebViewFailureKind.ViewClosed;
  }

  private isCrashed(viewId: string): boolean {
    return this.lost.get(viewId)?.kind === WebViewFailureKind.Crashed;
  }

  private paneOf(viewId: string): WebViewPane {
    const instance: string | undefined = this.instances.get(viewId);
    return instance === undefined ? ScriptedViews.pane : new WebViewPane(new QualifiedName("browser", "page"), instance);
  }

  private profileKeyOf(viewId: string): string {
    return this.profileKeys.get(viewId) ?? "workspace-1";
  }

  private lose(viewId: string, failure: WebViewFailureKind): void {
    this.lost.set(viewId, new WebViewFailure(failure));
    this.endPending(viewId, failure);
  }

  private endPending(viewId: string, failure: WebViewFailureKind): void {
    for (const call of [...this.pending])
      if (call.viewId === viewId) {
        this.pending.delete(call);
        call.reject(new WebViewFailureException(new WebViewFailure(failure)));
      }
  }
}
