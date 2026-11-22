/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PageAction, PageBox } from "@noldova/browser.protocol";
import { WebViewFailureKind } from "@noldova/desktop.protocol";
import { type IModuleLog, type IPermissionDetail, type IPermissionRequest, type IRuntimeWebViews, PermissionOption, ToolAbortReason,
  type ToolCall, ToolContent, type ToolResult, ToolRisk, WebViewFailureException } from "@noldova/desktop.runtime";

import { CallFailureException } from "../exceptions/call-failure.exception.ts";
import { HandedOverException } from "../exceptions/handed-over.exception.ts";
import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import { PageLoadingException } from "../exceptions/page-loading.exception.ts";
import { PageNotControlledException } from "../exceptions/page-not-controlled.exception.ts";
import { ProtocolFailedException } from "../exceptions/protocol-failed.exception.ts";
import { PageChangedAfterGrantException } from "../exceptions/page-changed-after-grant.exception.ts";
import { RiskRoseException } from "../exceptions/risk-rose.exception.ts";
import { StaleReferenceException } from "../exceptions/stale-reference.exception.ts";
import { TakenOverException } from "../exceptions/taken-over.exception.ts";
import { Resources } from "../resources.ts";
import { AccessibilitySnapshot } from "../services/accessibility-snapshot.ts";
import { AimFollower } from "../services/aim-follower.ts";
import { ConsoleBuffers } from "../services/console-buffers.ts";
import { ContentQuads } from "../services/content-quads.ts";
import { FrameTreeReader } from "../services/frame-tree.reader.ts";
import { HistoryPageReader } from "../services/history-page.reader.ts";
import { JsonShapes } from "../services/json-shapes.ts";
import { NavigationWatch } from "../services/navigation-watch.ts";
import { NodeFactsReader } from "../services/node-facts.reader.ts";
import { PageChanges } from "../services/page-changes.ts";
import { PendingNavigations } from "../services/pending-navigations.ts";
import { PermissionGate } from "../services/permission-gate.ts";
import { RiskClassifier } from "../services/risk-classifier.ts";
import { RuntimeDomains } from "../services/runtime-domains.ts";
import { SessionPages } from "../services/session-pages.ts";
import { ToolFailures } from "../services/tool-failures.ts";
import { ToolResults } from "../services/tool-results.ts";
import { ViewCalls } from "../services/view-calls.ts";
import type { WorkspaceOrigins } from "../services/workspace-origins.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";
import type { SessionReference } from "../types/session-reference.ts";
import type { AccessibilityNode } from "./accessibility-node.ts";
import { ActionProgress } from "./action-progress.ts";
import { BrowserLimits } from "./browser-limits.ts";
import { CallOptions } from "./call-options.ts";
import { ElementFacts } from "./element-facts.ts";
import { ElementReference } from "./element-reference.ts";
import type { FrameFacts } from "./frame-facts.ts";
import type { NodeFacts } from "./node-facts.ts";
import type { OriginPage } from "./origin-page.ts";
import type { PageActivity } from "./page-activity.ts";
import { PageStops } from "./page-stops.ts";
import { PaneQueue } from "./pane-queue.ts";
import type { ResolvedElement } from "./resolved-element.ts";
import type { SessionPage } from "./session-page.ts";
import type { SessionStates } from "./session-states.ts";
import { ShownElement } from "./shown-element.ts";
import { ShownPage } from "./shown-page.ts";
import type { SnapshotReference } from "./snapshot-reference.ts";

export class ToolKit {
  public static readonly lowRiskOptions: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny,
    PermissionOption.DenyAlways];
  private static readonly ACTING_OPTIONS: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny];
  private static readonly TAKING_OVER_OPTIONS: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.TakeOver, PermissionOption.Deny];
  private static readonly HIGH_OPTIONS: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.Deny];
  private static readonly SENT_BACK: unique symbol = Symbol("sent back");
  private readonly recordAgent: (page: SessionPage) => void;
  public readonly webViews: IRuntimeWebViews;
  public readonly sessions: SessionStates;
  public readonly origins: WorkspaceOrigins;
  public readonly pages: SessionPages;
  public readonly calls: ViewCalls;
  public readonly consoles: ConsoleBuffers;
  public readonly domains: RuntimeDomains;
  public readonly changes: PageChanges;
  public readonly navigations: PendingNavigations;
  public readonly queue: PaneQueue = new PaneQueue();
  public readonly gate: PermissionGate = new PermissionGate();
  public readonly stops: PageStops;
  public readonly log: IModuleLog;

  public constructor(
    webViews: IRuntimeWebViews,
    sessions: SessionStates,
    origins: WorkspaceOrigins,
    publish: (payload: JsonObject) => void,
    recordAgent: (page: SessionPage) => void,
    log: IModuleLog) {
    this.webViews = webViews;
    this.sessions = sessions;
    this.origins = origins;
    this.stops = new PageStops(publish, t => this.letGo(t));
    this.recordAgent = recordAgent;
    this.log = log;
    this.pages = new SessionPages(webViews);
    this.calls = new ViewCalls(webViews.relay);
    this.consoles = new ConsoleBuffers(webViews.relay);
    this.domains = new RuntimeDomains(webViews.relay, this.consoles);
    this.changes = new PageChanges(webViews.relay, this.calls, this.domains, log);
    this.navigations = new PendingNavigations(webViews);
  }

  public static optionsFor(activity: PageActivity, call: ToolCall, progress: ActionProgress, isReferenced: boolean): CallOptions {
    return new CallOptions(activity.signal, call.deadline, BrowserLimits.maximumNodeReplyBytes, isReferenced, progress);
  }

  public static handingOver(options: CallOptions): CallOptions {
    return options.withProgress(new ActionProgress(() => undefined));
  }

  public static request(action: string, title: string, origin: string, details: readonly IPermissionDetail[], risk: ToolRisk,
    options: readonly PermissionOption[], alwaysLabel: string = Resources.allowForChatLabel): IPermissionRequest {
    const labels: Partial<Record<PermissionOption.AllowAlways | PermissionOption.TakeOver, string>> = {};
    if (options.includes(PermissionOption.AllowAlways))
      labels[PermissionOption.AllowAlways] = alwaysLabel;
    if (options.includes(PermissionOption.TakeOver))
      labels[PermissionOption.TakeOver] = Resources.typeItMyselfLabel;
    return {
      action: risk === ToolRisk.High ? `${action}${Resources.highRiskActionSuffix}` : action,
      subject: origin,
      title: title.length > Resources.maximumTitleLength ? `${title.slice(0, Resources.maximumTitleLength - 1)}${Resources.shownCut}` : title,
      details,
      risk,
      isAsking: PermissionGate.isAsking(risk),
      options,
      labels
    };
  }

  public static actingOptions(risk: ToolRisk, canTakeOver: boolean = false): readonly PermissionOption[] {
    switch (risk) {
      case ToolRisk.Low:
        return ToolKit.lowRiskOptions;
      case ToolRisk.Medium:
        return ToolKit.ACTING_OPTIONS;
      case ToolRisk.High:
        return canTakeOver ? ToolKit.TAKING_OVER_OPTIONS : ToolKit.HIGH_OPTIONS;
    }
  }

  public actAsync<T>(call: ToolCall, page: SessionPage, action: PageAction, work: (activity: PageActivity) => Promise<T>): Promise<T> {
    const generation: number = this.stops.generationOf(page.instance);
    return this.queue.runAsync(page.viewId, async () => {
      if (call.signal.aborted)
        throw ToolFailures.fromAbort(call.signal.reason);
      this.ensureFree(call, page, generation);
      this.recordAgent(page);
      if (this.origins.isPassing(page.viewId)) {
        await this.origins.stopPassingAsync(page.viewId, page.profileKey);
        // The person may stop or take the page, or the session end, while its typed redirects stop passing.
        this.ensureFree(call, page, generation);
        if (call.signal.aborted)
          throw ToolFailures.fromAbort(call.signal.reason);
      }
      const activity: PageActivity = this.stops.begin(page, call.session, action, call.signal);
      try {
        await this.controlAsync(activity, page.viewId);
        return await work(activity);
      }
      finally {
        this.stops.finish(activity);
      }
    });
  }

  // A view marked from an earlier start of the runtime part, which no control holds now, stops being marked.
  public letGoUnheld(viewId: string): void {
    if (!this.stops.controlsView(viewId))
      this.letGo(viewId);
  }

  public async askAsync(activity: PageActivity, call: ToolCall, request: IPermissionRequest, progress: ActionProgress,
    handOverAsync: (() => Promise<void>) | null = null): Promise<void> {
    if (request.isAsking === true)
      activity.ask();
    try {
      await this.gate.askAsync(call, request, progress);
    }
    catch (error) {
      if (!Object.isNull(handOverAsync) && error instanceof HandedOverException) {
        activity.handOver();
        await handOverAsync().catch((failure: unknown) => {
          if (!(failure instanceof CallFailureException))
            throw failure;
        });
      }
      throw error;
    }
    finally {
      activity.act();
    }
    if (activity.stopSignal.aborted)
      throw ToolFailures.fromAbort(activity.stopSignal.reason);
  }

  public followAsync<T>(activity: PageActivity, element: ElementReference, request: IPermissionRequest, options: CallOptions, askAsync: () => Promise<T>): Promise<T> {
    return request.isAsking === true ? AimFollower.whileAsync(this.calls, this.changes, element, activity, options, askAsync) : askAsync();
  }

  public async readBoxAsync(viewId: string, backendNodeId: number, options: CallOptions, notLaidOut: (() => CallFailureException) | null = null): Promise<PageBox | null> {
    const quad: readonly number[] | null = await this.readQuadAsync(viewId, backendNodeId, options, notLaidOut);
    return Object.isNull(quad) ? null : ContentQuads.toBox(quad);
  }

  // The element's first box, or null for one with none: the engine answers no quads for some, and refuses the call for one it doesn't lay
  // out, such as an element under display: none. That refusal fails as `notLaidOut` gives, or reads as no box without one.
  public async readQuadAsync(viewId: string, backendNodeId: number, options: CallOptions, notLaidOut: (() => CallFailureException) | null = null)
    : Promise<readonly number[] | null> {
    try {
      return ContentQuads.readFirst(await this.calls.sendAsync(viewId, Resources.getContentQuadsMethod, { backendNodeId }, options));
    }
    catch (error) {
      if (!(error instanceof ProtocolFailedException && error.cause instanceof WebViewFailureException && error.cause.failure.message === Resources.noContentQuads))
        throw error;
      if (!Object.isNull(notLaidOut))
        throw notLaidOut();
      return null;
    }
  }

  public async readFrameAsync(viewId: string, options: CallOptions): Promise<FrameFacts> {
    const frame: FrameFacts = FrameTreeReader.read(await this.calls.sendAsync(viewId, Resources.getFrameTreeMethod, {}, options));
    this.navigations.watch(viewId, frame.frameId);
    return frame;
  }

  // Runs `readAsync` once no navigation of the view's main frame waits for its next document, waiting for a pending one until `until`, as
  // every call the page answers waits for that document; a navigation that starts during the read sends it back to that wait. `null` when
  // a navigation still waits at `until`. A read sent back ends before the next one starts, so none of its late steps undoes the next's.
  public async readSettledAsync<T>(viewId: string, until: number, signal: AbortSignal, readAsync: () => Promise<T>): Promise<T | null> {
    for (;;) {
      if (!await this.navigations.settleAsync(viewId, until, signal))
        return null;
      const reading: Promise<T> = readAsync();
      const outcome: Awaited<T> | typeof ToolKit.SENT_BACK = await Promise.race([reading, this.navigations.startedAsync(viewId).then((): typeof ToolKit.SENT_BACK => ToolKit.SENT_BACK)]);
      if (outcome !== ToolKit.SENT_BACK)
        return outcome;
      // Its outcome tells nothing once the read was sent back, so its failure is let go with it.
      const ended: Promise<PromiseSettledResult<Awaited<T>>[]> = Promise.allSettled([reading]);
      if (!await this.navigations.settleAsync(viewId, until, signal))
        return null;
      await ended;
    }
  }

  // The frame an input goes to, read once no navigation of the view's main frame waits for its next document. One still waiting by the
  // call's read margin fails the call before any input, as every call the page answers would wait for that document past the deadline.
  public async readActingFrameAsync(viewId: string, options: CallOptions): Promise<FrameFacts> {
    const frame: FrameFacts | null = await this.readSettledAsync(viewId, options.deadline - Resources.readMarginMilliseconds, options.signal,
      () => this.readFrameAsync(viewId, options));
    if (Object.isNull(frame))
      throw new PageLoadingException();
    return frame;
  }

  // The answer of a read whose page still waits for its next document: the page the view's history still shows, which the engine answers
  // itself, and the note that the next one is still loading.
  public async stillLoadingAsync(viewId: string, options: CallOptions): Promise<ToolResult> {
    const shown: OriginPage = await HistoryPageReader.readAsync(this.calls, viewId, options);
    return ToolResults.page(shown.origin, [ToolContent.fromText(Resources.formatNavigated(shown.page.url, shown.page.title), shown.origin),
      ToolContent.fromText(Resources.stillLoading, null)], shown.page);
  }

  public async confirmDocumentAsync(viewId: string, documentId: string, options: CallOptions): Promise<void> {
    if ((await this.readFrameAsync(viewId, options)).documentId !== documentId)
      throw new PageChangedAfterGrantException();
  }

  public async confirmRiskAsync(viewId: string, backendNodeId: number, granted: ElementFacts, risk: ToolRisk, classify: (facts: ElementFacts) => ToolRisk,
    options: CallOptions, rose: () => CallFailureException = () => new RiskRoseException()): Promise<void> {
    const now: ElementFacts = await this.readElementAsync(viewId, backendNodeId, options);
    if (!Object.isNull(granted.path) && Object.isNull(now.path))
      throw new PageChangedAfterGrantException();
    if (risk !== ToolRisk.High && classify(now) === ToolRisk.High)
      throw rose();
  }

  // The node of the element a session's reference names: the element the snapshot that gave the reference kept in the page, while it is
  // still there.
  public async findReferencedNodeAsync(session: string, id: string, viewId: string, documentId: string, options: CallOptions): Promise<ElementReference> {
    const reference: SessionReference = this.sessions.resolveReference(session, id, viewId, documentId);
    return await reference.accept<Promise<ElementReference>>({
      visitSnapshotElement: (kept: SnapshotReference): Promise<ElementReference> => this.findSnapshotNodeAsync(kept, viewId, documentId, options),
      visitClosedElement: (closed: ElementReference): Promise<ElementReference> => Promise.resolve(closed)
    });
  }

  public async readElementAsync(viewId: string, backendNodeId: number, options: CallOptions): Promise<ElementFacts> {
    const element: ResolvedElement = await this.changes.resolveElementAsync(viewId, backendNodeId, options);
    try {
      const reply: JsonObject = await this.changes.readElementAsync(viewId, element.objectId, options);
      const path: readonly NodeFacts[] | null = NodeFactsReader.readPath(reply);
      // Only a submit is rated by its form, so only then is the form read, which on a page wrapped in one form is the whole page.
      const isSubmitting: boolean = !Object.isNull(path) && (RiskClassifier.submitsClick(path) || RiskClassifier.submitsEnter(path));
      const form: JsonObject | null = isSubmitting ? await this.changes.readFormAsync(viewId, element.objectId, options) : null;
      // The world is found by its context number, which a navigation can pass to the new document's own world, whose script could change
      // what the function reads, so the facts count only from the document the world was found in.
      if ((await this.readFrameAsync(viewId, options)).documentId !== element.documentId)
        throw new StaleReferenceException();
      return NodeFactsReader.readElement(reply, Object.isNull(form) ? null : NodeFactsReader.readSubtree(form));
    }
    finally {
      await this.changes.releaseAsync(viewId, element.objectId, options);
    }
  }

  public async selectFieldAsync(viewId: string, backendNodeId: number, options: CallOptions): Promise<boolean> {
    const element: ResolvedElement = await this.changes.resolveElementAsync(viewId, backendNodeId, options);
    try {
      return await this.changes.selectFieldAsync(viewId, element.objectId, options);
    }
    finally {
      await this.changes.releaseAsync(viewId, element.objectId, options);
    }
  }

  public async readTitleOfAsync(viewId: string, documentId: string, options: CallOptions): Promise<string> {
    const title: string = AccessibilitySnapshot.readTitle(AccessibilitySnapshot.readNodes(
      await this.calls.sendAsync(viewId, Resources.getFullAXTreeMethod, { depth: Resources.rootLevelDepth }, options.withMaximumReplyBytes(BrowserLimits.maximumTreeReplyBytes))));
    return (await this.readFrameAsync(viewId, options)).documentId === documentId ? title : "";
  }

  public async readShownElementAsync(viewId: string, backendNodeId: number, facts: ElementFacts, options: CallOptions): Promise<ShownElement> {
    const nodes: readonly AccessibilityNode[] = AccessibilitySnapshot.readNodes(
      await this.calls.sendAsync(viewId, Resources.getPartialAXTreeMethod, { backendNodeId, fetchRelatives: false }, options.withMaximumReplyBytes(BrowserLimits.maximumTreeReplyBytes))).nodes;
    const node: AccessibilityNode | undefined = nodes.find(t => t.backendNodeId === backendNodeId);
    if (Object.isUndefined(node))
      throw new MalformedReplyException();
    const target: NodeFacts | undefined = facts.path?.at(-1);
    return new ShownElement(node.role, node.name, Object.isUndefined(target) || RiskClassifier.isSecret(target));
  }

  // Sends the input `send` gives and reports the call done. An input that makes the page navigate its main frame in place, as a link's click
  // or a form's Enter does, is reported once that navigation loaded, with the page it loaded, or as still loading when the call's time ends
  // first. The page asks for the navigation while it handles the input, and answers a call only after that, so the call after the input
  // lets its request arrive before the wait is decided. Once the engine started the navigation, a call the page answers waits until the
  // next document's answer came, so the request ends that call's wait, and a page still loading is read from the view's history.
  public async doneAsync(viewId: string, frameId: string, message: string, element: ShownElement | null, options: CallOptions,
    send: () => Promise<void>): Promise<ToolResult> {
    await this.calls.sendAsync(viewId, Resources.enableMethod, {}, options);
    const watch: NavigationWatch = new NavigationWatch(this.webViews, viewId, frameId);
    let isLoaded: boolean;
    try {
      await send();
      const turn: Promise<JsonObject> = this.calls.sendAsync(viewId, Resources.enableMethod, {}, options);
      // The race fails with the call; once the request came, the call's later answer or failure tells nothing.
      turn.catch(() => undefined);
      await Promise.race([turn, watch.requested]);
      isLoaded = await watch.waitAsync(options.deadline - Resources.readMarginMilliseconds, options.signal);
    }
    finally {
      watch[Symbol.dispose]();
    }
    if (!isLoaded) {
      const shown: OriginPage = await HistoryPageReader.readAsync(this.calls, viewId, options);
      return ToolResults.done(message, shown.origin, shown.page, element, false);
    }
    const frame: FrameFacts = await this.readFrameAsync(viewId, options);
    return ToolResults.done(message, frame.origin, new ShownPage(frame.url, await this.readTitleOfAsync(viewId, frame.documentId, options)), element, true);
  }

  // The node of the element a snapshot kept in the page, while it is still there.
  private async findSnapshotNodeAsync(reference: SnapshotReference, viewId: string, documentId: string, options: CallOptions): Promise<ElementReference> {
    const objectId: string | null = await this.changes.findSnapshotElementAsync(viewId, reference.index, options);
    if (Object.isNull(objectId))
      throw new StaleReferenceException();
    try {
      const node: JsonValue | undefined = (await this.calls.sendAsync(viewId, Resources.describeNodeMethod, { objectId }, options))[Resources.nodeField];
      const backendNodeId: JsonValue | undefined = JsonShapes.isObject(node) ? node[Resources.backendNodeIdField] : undefined;
      if (!Object.isNumber(backendNodeId))
        throw new MalformedReplyException();
      return new ElementReference(viewId, documentId, backendNodeId);
    }
    finally {
      await this.changes.releaseAsync(viewId, objectId, options);
    }
  }

  // The view keeps drawing while hidden only while it is marked, and a document it loads hidden takes no press until it draws, so a call
  // that can't mark it does nothing rather than report an input that never arrived. An earlier view of the page that the control marked
  // stops being marked first, and the control holds the new mark from its request, so a control that ends meanwhile still ends it.
  private async controlAsync(activity: PageActivity, viewId: string): Promise<void> {
    const marked: string | null = activity.markedViewId;
    if (!Object.isNull(marked) && marked !== viewId)
      this.letGo(marked);
    activity.mark(viewId);
    try {
      await this.webViews.setControlledAsync(viewId, true);
    }
    catch (error) {
      activity.mark(null);
      throw new PageNotControlledException(viewId, error);
    }
  }

  // A view already closed has no mark left to end, so its answer isn't logged.
  private letGo(viewId: string): void {
    this.webViews.setControlledAsync(viewId, false).catch((error: unknown) => {
      if (!(error instanceof WebViewFailureException && error.failure.kind === WebViewFailureKind.ViewClosed))
        this.log.write(Resources.formatControlNotCleared(viewId, String(error)));
    });
  }

  private ensureFree(call: ToolCall, page: SessionPage, generation: number): void {
    if (this.stops.isTakenOver(page.instance, call.session))
      throw new TakenOverException();
    if (this.stops.generationOf(page.instance) !== generation)
      throw ToolFailures.interrupted(ToolAbortReason.Stopped);
  }
}
