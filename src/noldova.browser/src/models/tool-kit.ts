/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PageAction, PageBox } from "@noldova/browser.protocol";
import { type IModuleLog, type IPermissionDetail, type IPermissionRequest, type IRuntimeWebViews, PermissionDetailKind, PermissionOption, ToolAbortReason,
  type ToolCall, type ToolResult, ToolRisk } from "@noldova/desktop.runtime";

import { CallFailureException } from "../exceptions/call-failure.exception.ts";
import { HandedOverException } from "../exceptions/handed-over.exception.ts";
import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import { PageChangedAfterGrantException } from "../exceptions/page-changed-after-grant.exception.ts";
import { RiskRoseException } from "../exceptions/risk-rose.exception.ts";
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
import { PageActivity } from "./page-activity.ts";
import { PageFacts } from "./page-facts.ts";
import { PageStops } from "./page-stops.ts";
import { PaneQueue } from "./pane-queue.ts";
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
  private readonly publish: (payload: JsonObject) => void;
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
  public readonly stops: PageStops = new PageStops();
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
    this.publish = publish;
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
      details: [...details, { label: Resources.originLabel, kind: PermissionDetailKind.Text, value: origin }],
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
      if (this.stops.isTakenOver(page.instance, call.session))
        throw new TakenOverException();
      if (this.stops.generationOf(page.instance) !== generation)
        throw ToolFailures.interrupted(ToolAbortReason.Stopped);
      this.recordAgent(page);
      if (this.origins.isPassing(page.viewId))
        await this.origins.stopPassingAsync(page.viewId, page.profileKey);
      const activity: PageActivity = new PageActivity(page, call.session, action, call.signal, this.publish);
      this.stops.add(activity);
      try {
        return await work(activity);
      }
      finally {
        this.stops.remove(activity);
        activity[Symbol.dispose]();
      }
    });
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
    const document: JsonObject = await this.calls.sendAsync(viewId, Resources.getDocumentMethod, { depth: Resources.wholeSubtreeDepth, pierce: true }, options.withMaximumReplyBytes(BrowserLimits.maximumTreeReplyBytes));
    const node: NodeFacts = NodeFactsReader.readNode(await this.calls.sendAsync(viewId, Resources.describeNodeMethod, { backendNodeId }, options));
    const ancestors: readonly NodeFacts[] | null = NodeFactsReader.readAncestors(document, backendNodeId);
    return new ElementFacts(ancestors === null ? null : [...ancestors, node], NodeFactsReader.readFormNodes(document, backendNodeId),
      new PageFacts(NodeFactsReader.readBaseUrl(document)));
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
}
