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
      const element: ElementReference = this.kit.sessions.resolveReference(call.session, reference, page.viewId, frame.documentId);
      const facts: ElementFacts = await this.kit.readElementAsync(page.viewId, element.backendNodeId, options);
      const shown: ShownElement = await this.kit.readShownElementAsync(page.viewId, element.backendNodeId, facts, options);
      const risk: ToolRisk = RiskClassifier.classifyClick(facts.path, facts.form);
      const box: PageBox | null = await this.kit.readBoxAsync(page.viewId, element.backendNodeId, options);
      if (box !== null)
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
      await this.layout.holdAsync(page.viewId, options,
        () => this.pressAsync(page.viewId, element.backendNodeId, button, clickCount, activity, options, confirmRiskAsync));
      return this.kit.doneAsync(page.viewId, Resources.clicked, shown, options);
    });
  }

  private static readScroll(reply: JsonObject): PagePoint {
    const viewport: JsonValue | undefined = reply[Resources.cssVisualViewportField];
    if (!JsonShapes.isObject(viewport))
      throw new MalformedReplyException();
    const { pageX: x, pageY: y }: JsonObject = viewport;
    if (typeof x !== "number" || typeof y !== "number")
      throw new MalformedReplyException();
    return new PagePoint(x, y);
  }

  private static readButton(name: string): MouseButton {
    if (name === Resources.mouseButtonNames[MouseButton.Middle])
      return MouseButton.Middle;
    return name === Resources.mouseButtonNames[MouseButton.Right] ? MouseButton.Right : MouseButton.Left;
  }

  private async pressAsync(viewId: string, backendNodeId: number, button: MouseButton, clickCount: number, activity: PageActivity, options: CallOptions,
    confirmRiskAsync: () => Promise<void>): Promise<void> {
    await this.kit.calls.sendAsync(viewId, Resources.scrollIntoViewIfNeededMethod, { backendNodeId }, options);
    const quad: readonly number[] | null = ContentQuads.readFirst(await this.kit.calls.sendAsync(viewId, Resources.getContentQuadsMethod, { backendNodeId }, options));
    if (quad === null)
      throw new ElementNotVisibleException();
    const centre: PagePoint = ContentQuads.toCentre(quad);
    const { x, y }: PagePoint = centre;
    activity.aim(ContentQuads.toBox(quad), centre);
    const scroll: PagePoint = await this.readScrollAsync(viewId, options);
    await this.confirmTopmostAsync(viewId, backendNodeId, x + scroll.x, y + scroll.y, options);
    const mouse: { x: number; y: number; button: "left" | "middle" | "right" } = { x, y, button: Resources.mouseButtonNames[button] };
    await this.kit.calls.sendAsync(viewId, Resources.dispatchMouseEventMethod, { type: Resources.mouseMovedType, x, y }, options);
    for (let count: number = 1; count <= clickCount; count++) {
      await this.confirmUnmovedAsync(viewId, backendNodeId, quad, scroll, options);
      await confirmRiskAsync();
      await this.kit.calls.pressAsync(viewId, Resources.dispatchMouseEventMethod, { type: Resources.mousePressedType, ...mouse, clickCount: count },
        { type: Resources.mouseReleasedType, ...mouse, clickCount: count }, ViewCalls.holding(options));
    }
  }

  private async confirmUnmovedAsync(viewId: string, backendNodeId: number, quad: readonly number[], scroll: PagePoint, options: CallOptions): Promise<void> {
    const now: readonly number[] | null = ContentQuads.readFirst(await this.kit.calls.sendAsync(viewId, Resources.getContentQuadsMethod, { backendNodeId }, options));
    const scrolled: PagePoint = await this.readScrollAsync(viewId, options);
    if (now === null || now.some((t, index) => t !== quad[index]) || scrolled.x !== scroll.x || scrolled.y !== scroll.y)
      throw new PageChangedAfterGrantException();
    const { x, y }: PagePoint = ContentQuads.toCentre(quad);
    await this.confirmTopmostAsync(viewId, backendNodeId, x + scroll.x, y + scroll.y, options);
  }

  private async readScrollAsync(viewId: string, options: CallOptions): Promise<PagePoint> {
    return ClickTool.readScroll(await this.kit.calls.sendAsync(viewId, Resources.getLayoutMetricsMethod, {}, options));
  }

  private async confirmTopmostAsync(viewId: string, backendNodeId: number, documentX: number, documentY: number, options: CallOptions): Promise<void> {
    const hit: JsonObject = await this.kit.calls.sendAsync(viewId, Resources.getNodeForLocationMethod,
      { x: Math.round(documentX), y: Math.round(documentY), includeUserAgentShadowDOM: false }, options);
    const topmost: JsonValue | undefined = hit[Resources.backendNodeIdField];
    if (typeof topmost !== "number")
      throw new MalformedReplyException();
    if (topmost === backendNodeId)
      return;
    const subtree: JsonObject = await this.kit.calls.sendAsync(viewId, Resources.describeNodeMethod, { backendNodeId, depth: Resources.wholeSubtreeDepth, pierce: true },
      options.withMaximumReplyBytes(BrowserLimits.maximumTreeReplyBytes));
    if (!NodeFactsReader.holds(subtree, topmost))
      throw new ElementCoveredException();
  }
}
