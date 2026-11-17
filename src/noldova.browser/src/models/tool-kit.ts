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
  type ToolCall, type ToolResult, ToolRisk, WebViewFailureException } from "@noldova/desktop.runtime";

import { CallFailureException } from "../exceptions/call-failure.exception.ts";
import { HandedOverException } from "../exceptions/handed-over.exception.ts";
import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import { PageNotControlledException } from "../exceptions/page-not-controlled.exception.ts";
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
import { NodeFactsReader } from "../services/node-facts.reader.ts";
import { PageChanges } from "../services/page-changes.ts";
import { PermissionGate } from "../services/permission-gate.ts";
import { RiskClassifier } from "../services/risk-classifier.ts";
import { RuntimeDomains } from "../services/runtime-domains.ts";
import { SessionPages } from "../services/session-pages.ts";
import { ToolFailures } from "../services/tool-failures.ts";
import { ToolResults } from "../services/tool-results.ts";
import { ViewCalls } from "../services/view-calls.ts";
import type { WorkspaceOrigins } from "../services/workspace-origins.ts";
import type { JsonObject } from "../types/json-value.ts";
import type { AccessibilityNode } from "./accessibility-node.ts";
import { ActionProgress } from "./action-progress.ts";
import { BrowserLimits } from "./browser-limits.ts";
import { CallOptions } from "./call-options.ts";
import { ElementFacts } from "./element-facts.ts";
import type { ElementReference } from "./element-reference.ts";
import type { FrameFacts } from "./frame-facts.ts";
import type { NodeFacts } from "./node-facts.ts";
import type { PageActivity } from "./page-activity.ts";
import { PageStops } from "./page-stops.ts";
import { PaneQueue } from "./pane-queue.ts";
import type { ResolvedElement } from "./resolved-element.ts";
import type { SessionPage } from "./session-page.ts";
import type { SessionStates } from "./session-states.ts";
import { ShownElement } from "./shown-element.ts";
import { ShownPage } from "./shown-page.ts";

export class ToolKit {
  public static readonly lowRiskOptions: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny,
    PermissionOption.DenyAlways];
  private static readonly ACTING_OPTIONS: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny];
  private static readonly TAKING_OVER_OPTIONS: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.TakeOver, PermissionOption.Deny];
  private static readonly HIGH_OPTIONS: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.Deny];
  private readonly recordAgent: (page: SessionPage) => void;
  public readonly webViews: IRuntimeWebViews;
  public readonly sessions: SessionStates;
  public readonly origins: WorkspaceOrigins;
  public readonly pages: SessionPages;
  public readonly calls: ViewCalls;
  public readonly consoles: ConsoleBuffers;
  public readonly domains: RuntimeDomains;
  public readonly changes: PageChanges;
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
      if (handOverAsync !== null && error instanceof HandedOverException) {
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

  public async readBoxAsync(viewId: string, backendNodeId: number, options: CallOptions): Promise<PageBox | null> {
    const quad: readonly number[] | null = ContentQuads.readFirst(await this.calls.sendAsync(viewId, Resources.getContentQuadsMethod, { backendNodeId }, options));
    return quad === null ? null : ContentQuads.toBox(quad);
  }

  public async readFrameAsync(viewId: string, options: CallOptions): Promise<FrameFacts> {
    return FrameTreeReader.read(await this.calls.sendAsync(viewId, Resources.getFrameTreeMethod, {}, options));
  }

  public async confirmDocumentAsync(viewId: string, documentId: string, options: CallOptions): Promise<void> {
    if ((await this.readFrameAsync(viewId, options)).documentId !== documentId)
      throw new PageChangedAfterGrantException();
  }

  public async confirmRiskAsync(viewId: string, backendNodeId: number, granted: ElementFacts, risk: ToolRisk, classify: (facts: ElementFacts) => ToolRisk,
    options: CallOptions, rose: () => CallFailureException = () => new RiskRoseException()): Promise<void> {
    const now: ElementFacts = await this.readElementAsync(viewId, backendNodeId, options);
    if (granted.path !== null && now.path === null)
      throw new PageChangedAfterGrantException();
    if (risk !== ToolRisk.High && classify(now) === ToolRisk.High)
      throw rose();
  }

  public async readElementAsync(viewId: string, backendNodeId: number, options: CallOptions): Promise<ElementFacts> {
    const element: ResolvedElement = await this.changes.resolveElementAsync(viewId, backendNodeId, options);
    try {
      const reply: JsonObject = await this.changes.readElementAsync(viewId, element.objectId, options);
      const path: readonly NodeFacts[] | null = NodeFactsReader.readPath(reply);
      // Only a submit is rated by its form, so only then is the form read, which on a page wrapped in one form is the whole page.
      const isSubmitting: boolean = path !== null && (RiskClassifier.submitsClick(path) || RiskClassifier.submitsEnter(path));
      const form: JsonObject | null = isSubmitting ? await this.changes.readFormAsync(viewId, element.objectId, options) : null;
      // The world is found by its context number, which a navigation can pass to the new document's own world, whose script could change
      // what the function reads, so the facts count only from the document the world was found in.
      if ((await this.readFrameAsync(viewId, options)).documentId !== element.documentId)
        throw new StaleReferenceException();
      return NodeFactsReader.readElement(reply, form === null ? null : NodeFactsReader.readSubtree(form));
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
    if (node === undefined)
      throw new MalformedReplyException();
    const target: NodeFacts | undefined = facts.path?.at(-1);
    return new ShownElement(node.role, node.name, target === undefined || RiskClassifier.isSecret(target));
  }

  public async doneAsync(viewId: string, message: string, element: ShownElement | null, options: CallOptions): Promise<ToolResult> {
    const frame: FrameFacts = await this.readFrameAsync(viewId, options);
    return ToolResults.done(message, frame.origin, new ShownPage(frame.url, await this.readTitleOfAsync(viewId, frame.documentId, options)), element);
  }

  // The view keeps drawing while hidden only while it is marked, and a document it loads hidden takes no press until it draws, so a call
  // that can't mark it does nothing rather than report an input that never arrived. An earlier view of the page that the control marked
  // stops being marked first, and the control holds the new mark from its request, so a control that ends meanwhile still ends it.
  private async controlAsync(activity: PageActivity, viewId: string): Promise<void> {
    const marked: string | null = activity.markedViewId;
    if (marked !== null && marked !== viewId)
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
