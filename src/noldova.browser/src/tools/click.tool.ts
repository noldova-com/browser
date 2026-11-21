/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageAction, type PageBox, PagePoint } from "@noldova/browser.protocol";
import type { IPermissionDetail, IPermissionRequest, IToolDescriptor, ToolCall, ToolResult, ToolRisk } from "@noldova/desktop.runtime";

import { MouseButton } from "../enums/mouse-button.ts";
import { ElementCoveredException } from "../exceptions/element-covered.exception.ts";
import { ElementNotVisibleException } from "../exceptions/element-not-visible.exception.ts";
import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import { PageChangedAfterGrantException } from "../exceptions/page-changed-after-grant.exception.ts";
import type { IBrowserTool } from "../interfaces/i-browser-tool.ts";
import type { ActionProgress } from "../models/action-progress.ts";
import { BrowserLimits } from "../models/browser-limits.ts";
import type { CallOptions } from "../models/call-options.ts";
import type { ElementFacts } from "../models/element-facts.ts";
import type { ElementReference } from "../models/element-reference.ts";
import type { FrameFacts } from "../models/frame-facts.ts";
import type { PageActivity } from "../models/page-activity.ts";
import { PointRead } from "../models/point-read.ts";
import type { SessionPage } from "../models/session-page.ts";
import type { ShownElement } from "../models/shown-element.ts";
import { ToolDescriptors } from "../models/tool-descriptors.ts";
import { ToolKit } from "../models/tool-kit.ts";
import { Resources } from "../resources.ts";
import { ContentQuads } from "../services/content-quads.ts";
import { HiddenPageLayout } from "../services/hidden-page-layout.ts";
import { InputValidator } from "../services/input.validator.ts";
import { JsonShapes } from "../services/json-shapes.ts";
import { NodeFactsReader } from "../services/node-facts.reader.ts";
import { PermissionCards } from "../services/permission-cards.ts";
import { RiskClassifier } from "../services/risk-classifier.ts";
import { ViewCalls } from "../services/view-calls.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";

export class ClickTool implements IBrowserTool {
  private readonly kit: ToolKit;
  private readonly layout: HiddenPageLayout;
  public readonly descriptor: IToolDescriptor = ToolDescriptors.click;

  public constructor(kit: ToolKit) {
    this.kit = kit;
    this.layout = new HiddenPageLayout(kit.calls, kit.log);
  }

  public async callAsync(call: ToolCall, progress: ActionProgress): Promise<ToolResult> {
    const input: JsonObject = InputValidator.readObject(call.arguments);
    const reference: string = InputValidator.readText(input, Resources.referenceField, BrowserLimits.maximumReferenceLength);
    const button: MouseButton = ClickTool.readButton(InputValidator.readChoice(input, Resources.buttonField, Object.values(Resources.mouseButtonNames),
      Resources.mouseButtonNames[MouseButton.Left]));
    const clickCount: number = InputValidator.readCount(input, Resources.clickCountField, Resources.maximumClicks, 1);
    const page: SessionPage = this.kit.pages.find(call);
    return this.kit.actAsync(call, page, PageAction.Clicking, async activity => {
      const options: CallOptions = ToolKit.optionsFor(activity, call, progress, true);
      const frame: FrameFacts = await this.kit.readFrameAsync(page.viewId, options);
      const element: ElementReference = await this.kit.findReferencedNodeAsync(call.session, reference, page.viewId, frame.documentId, options);
      const facts: ElementFacts = await this.kit.readElementAsync(page.viewId, element.backendNodeId, options);
      const shown: ShownElement = await this.kit.readShownElementAsync(page.viewId, element.backendNodeId, facts, options);
      const risk: ToolRisk = RiskClassifier.classifyClick(facts.path, facts.form);
      const box: PageBox | null = await this.kit.readBoxAsync(page.viewId, element.backendNodeId, options);
      if (!Object.isNull(box))
        activity.aim(box, null);
      const details: IPermissionDetail[] = [PermissionCards.page(frame.url, facts.page.title), ...PermissionCards.element(facts, shown)];
      if (RiskClassifier.submitsClick(facts.path))
        details.push(...PermissionCards.sends(facts));
      const request: IPermissionRequest = ToolKit.request(Resources.clickAction, PermissionCards.clickTitle(facts, shown, frame.origin), frame.origin, details, risk,
        ToolKit.actingOptions(risk));
      await this.kit.followAsync(activity, element, request, options, () => this.kit.askAsync(activity, call, request, progress));
      await this.kit.confirmDocumentAsync(page.viewId, frame.documentId, options);

      const confirmRiskAsync = (): Promise<void> => this.kit.confirmRiskAsync(page.viewId, element.backendNodeId, facts, risk,
        now => RiskClassifier.classifyClick(now.path, now.form), options);
      return this.kit.doneAsync(page.viewId, frame.frameId, Resources.clicked, shown, options, () => this.layout.holdAsync(page.viewId, options,
        isLaidOut => this.pressAsync(page.viewId, element.backendNodeId, button, clickCount, isLaidOut, activity, options, confirmRiskAsync)));
    });
  }

  private static readScroll(reply: JsonObject): PagePoint {
    const viewport: JsonValue | undefined = reply[Resources.cssVisualViewportField];
    if (!JsonShapes.isObject(viewport))
      throw new MalformedReplyException();
    const { pageX: x, pageY: y }: JsonObject = viewport;
    if (!Object.isNumber(x) || !Object.isNumber(y))
      throw new MalformedReplyException();
    return new PagePoint(x, y);
  }

  // Whether the point, in the viewport's own coordinates, is inside the viewport the metrics give.
  private static isInView(reply: JsonObject, point: PagePoint): boolean {
    const viewport: JsonValue | undefined = reply[Resources.cssVisualViewportField];
    const { clientWidth: width, clientHeight: height }: JsonObject = JsonShapes.isObject(viewport) ? viewport : {};
    if (!Object.isNumber(width) || !Object.isNumber(height))
      throw new MalformedReplyException();
    return point.x >= 0 && point.y >= 0 && point.x < width && point.y < height;
  }

  private static readButton(name: string): MouseButton {
    if (name === Resources.mouseButtonNames[MouseButton.Middle])
      return MouseButton.Middle;
    return name === Resources.mouseButtonNames[MouseButton.Right] ? MouseButton.Right : MouseButton.Left;
  }

  // An element shown at its centre, in the view and topmost there, is pressed where it is, so the page doesn't move; any other is scrolled
  // to first, such as one below the view, out of an inner pane's view or under a sticky header. A page laid out for the press is read
  // once it rests, and after a scroll the point is read again once two reads a moment apart agree, as the page may still move.
  private async pressAsync(viewId: string, backendNodeId: number, button: MouseButton, clickCount: number, isLaidOut: boolean, activity: PageActivity,
    options: CallOptions, confirmRiskAsync: () => Promise<void>): Promise<void> {
    let read: PointRead = isLaidOut
      ? await this.settleAsync(viewId, backendNodeId, options)
      : await this.readPointAsync(viewId, backendNodeId, options);
    // An element with no box has nothing a scroll could bring into view, and the engine refuses to scroll one it doesn't lay out.
    if (Object.isNull(read.quad))
      throw new ElementNotVisibleException();
    const isShown: boolean = await this.isShownAsync(viewId, backendNodeId, read.quad, read.metrics, options);
    if (!isShown) {
      await this.kit.calls.sendAsync(viewId, Resources.scrollIntoViewIfNeededMethod, { backendNodeId }, options);
      read = await this.settleAsync(viewId, backendNodeId, options);
    }
    const quad: readonly number[] | null = read.quad;
    if (Object.isNull(quad))
      throw new ElementNotVisibleException();
    const centre: PagePoint = ContentQuads.toCentre(quad);
    const { x, y }: PagePoint = centre;
    activity.aim(ContentQuads.toBox(quad), centre);
    const scroll: PagePoint = ClickTool.readScroll(read.metrics);
    if (!isShown)
      await this.confirmTopmostAsync(viewId, backendNodeId, x + scroll.x, y + scroll.y, options);
    const buttonName: "left" | "middle" | "right" = Resources.mouseButtonNames[button];
    await this.kit.calls.sendAsync(viewId, Resources.dispatchMouseEventMethod, { type: Resources.mouseMovedType, x, y }, options);
    for (let count: number = 1; count <= clickCount; count++) {
      await this.confirmUnmovedAsync(viewId, backendNodeId, quad, scroll, options);
      await confirmRiskAsync();
      await this.kit.calls.pressAsync(viewId, Resources.dispatchMouseEventMethod, { type: Resources.mousePressedType, x, y, button: buttonName, clickCount: count },
        { type: Resources.mouseReleasedType, x, y, button: buttonName, clickCount: count }, ViewCalls.holding(options));
    }
  }

  private async confirmUnmovedAsync(viewId: string, backendNodeId: number, quad: readonly number[], scroll: PagePoint, options: CallOptions): Promise<void> {
    const now: readonly number[] | null = await this.kit.readQuadAsync(viewId, backendNodeId, options);
    const scrolled: PagePoint = await this.readScrollAsync(viewId, options);
    if (Object.isNull(now) || now.some((t, index) => t !== quad[index]) || scrolled.x !== scroll.x || scrolled.y !== scroll.y)
      throw new PageChangedAfterGrantException();
    const { x, y }: PagePoint = ContentQuads.toCentre(quad);
    await this.confirmTopmostAsync(viewId, backendNodeId, x + scroll.x, y + scroll.y, options);
  }

  // Whether the element shows at its centre: the centre is in the view and the topmost element there is the element or inside it.
  private async isShownAsync(viewId: string, backendNodeId: number, quad: readonly number[], metrics: JsonObject, options: CallOptions): Promise<boolean> {
    const centre: PagePoint = ContentQuads.toCentre(quad);
    if (!ClickTool.isInView(metrics, centre))
      return false;
    const { x, y }: PagePoint = centre;
    const scroll: PagePoint = ClickTool.readScroll(metrics);
    return this.isTopmostAsync(viewId, backendNodeId, x + scroll.x, y + scroll.y, options);
  }

  // The element's first box and the page's metrics, read together.
  private async readPointAsync(viewId: string, backendNodeId: number, options: CallOptions): Promise<PointRead> {
    const quad: readonly number[] | null = await this.kit.readQuadAsync(viewId, backendNodeId, options);
    return new PointRead(quad, await this.kit.calls.sendAsync(viewId, Resources.getLayoutMetricsMethod, {}, options));
  }

  // The element's box and the page's metrics once two reads a moment apart agree, or the last of a few reads; a page still moving then
  // fails the check before the press.
  private async settleAsync(viewId: string, backendNodeId: number, options: CallOptions): Promise<PointRead> {
    let read: PointRead = await this.readPointAsync(viewId, backendNodeId, options);
    for (let count: number = 1; count < Resources.settleReads; count++) {
      await ClickTool.pauseAsync(options.signal);
      const next: PointRead = await this.readPointAsync(viewId, backendNodeId, options);
      const isSame: boolean = JSON.stringify([next.quad, ClickTool.readScroll(next.metrics)]) === JSON.stringify([read.quad, ClickTool.readScroll(read.metrics)]);
      read = next;
      if (isSame)
        break;
    }
    return read;
  }

  // A moment for the page to finish moving, cut short when the call is stopped, which the next call to the view then reports.
  private static pauseAsync(signal: AbortSignal): Promise<void> {
    return new Promise<void>(resolve => {
      const end = (): void => {
        clearTimeout(timer);
        signal.removeEventListener("abort", end);
        resolve();
      };
      const timer: ReturnType<typeof setTimeout> = setTimeout(end, Resources.settleMilliseconds);
      signal.addEventListener("abort", end, { once: true });
    });
  }

  private async readScrollAsync(viewId: string, options: CallOptions): Promise<PagePoint> {
    return ClickTool.readScroll(await this.kit.calls.sendAsync(viewId, Resources.getLayoutMetricsMethod, {}, options));
  }

  private async confirmTopmostAsync(viewId: string, backendNodeId: number, documentX: number, documentY: number, options: CallOptions): Promise<void> {
    if (!await this.isTopmostAsync(viewId, backendNodeId, documentX, documentY, options))
      throw new ElementCoveredException();
  }

  // Whether the topmost element at the point in the document is the element or inside it.
  private async isTopmostAsync(viewId: string, backendNodeId: number, documentX: number, documentY: number, options: CallOptions): Promise<boolean> {
    const hit: JsonObject = await this.kit.calls.sendAsync(viewId, Resources.getNodeForLocationMethod,
      { x: Math.round(documentX), y: Math.round(documentY), includeUserAgentShadowDOM: false }, options);
    const topmost: JsonValue | undefined = hit[Resources.backendNodeIdField];
    if (!Object.isNumber(topmost))
      throw new MalformedReplyException();
    if (topmost === backendNodeId)
      return true;
    const subtree: JsonObject = await this.kit.calls.sendAsync(viewId, Resources.describeNodeMethod, { backendNodeId, depth: Resources.wholeSubtreeDepth, pierce: true },
      options.withMaximumReplyBytes(BrowserLimits.maximumTreeReplyBytes));
    return NodeFactsReader.holds(subtree, topmost);
  }
}
