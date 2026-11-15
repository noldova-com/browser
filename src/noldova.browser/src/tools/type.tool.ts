/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageAction, type PageBox } from "@noldova/browser.protocol";
import { type IPermissionDetail, type IPermissionRequest, type IToolDescriptor, PermissionDetailKind, type ToolCall, type ToolResult, ToolRisk }
  from "@noldova/desktop.runtime";

import { NotSubmittedException } from "../exceptions/not-submitted.exception.ts";
import type { IBrowserTool } from "../interfaces/i-browser-tool.ts";
import type { ActionProgress } from "../models/action-progress.ts";
import { BrowserLimits } from "../models/browser-limits.ts";
import type { CallOptions } from "../models/call-options.ts";
import type { ElementFacts } from "../models/element-facts.ts";
import type { ElementReference } from "../models/element-reference.ts";
import type { FrameFacts } from "../models/frame-facts.ts";
import type { KeyPress } from "../models/key-press.ts";
import type { SessionPage } from "../models/session-page.ts";
import type { ShownElement } from "../models/shown-element.ts";
import { ToolDescriptors } from "../models/tool-descriptors.ts";
import { ToolKit } from "../models/tool-kit.ts";
import { Resources } from "../resources.ts";
import { ElementDetails } from "../services/element-details.ts";
import { InputValidator } from "../services/input.validator.ts";
import { KeyEvents } from "../services/key-events.ts";
import { RiskClassifier } from "../services/risk-classifier.ts";
import { ViewCalls } from "../services/view-calls.ts";
import type { JsonObject } from "../types/json-value.ts";

export class TypeTool implements IBrowserTool {
  private readonly kit: ToolKit;
  public readonly descriptor: IToolDescriptor = ToolDescriptors.type;

  public constructor(kit: ToolKit) {
    this.kit = kit;
  }

  public async callAsync(call: ToolCall, progress: ActionProgress): Promise<ToolResult> {
    const input: JsonObject = InputValidator.readObject(call.arguments);
    const reference: string = InputValidator.readText(input, Resources.referenceField, BrowserLimits.maximumReferenceLength);
    const text: string = InputValidator.readText(input, Resources.textField, BrowserLimits.maximumTypedTextLength);
    const isSubmitting: boolean = InputValidator.readFlag(input, Resources.submitField);
    const page: SessionPage = this.kit.pages.find(call);
    return this.kit.actAsync(call, page, PageAction.Typing, async activity => {
      const options: CallOptions = ToolKit.optionsFor(activity, call, progress, true);
      const frame: FrameFacts = await this.kit.readFrameAsync(page.viewId, options);
      const element: ElementReference = this.kit.sessions.resolveReference(call.session, reference, page.viewId, frame.documentId);
      const facts: ElementFacts = await this.kit.readElementAsync(page.viewId, element.backendNodeId, options);
      const shown: ShownElement = await this.kit.readShownElementAsync(page.viewId, element.backendNodeId, facts, options);
      const risk: ToolRisk = RiskClassifier.classifyTyping(facts.path, isSubmitting, facts.form);
      const details: IPermissionDetail[] = [...ElementDetails.describe(facts), {
        label: Resources.textLabel,
        kind: risk === ToolRisk.High ? PermissionDetailKind.Secret : PermissionDetailKind.AgentText,
        value: text
      }];
      if (isSubmitting)
        details.push({ label: Resources.submitLabel, kind: PermissionDetailKind.Text, value: Resources.submitValue });
      const box: PageBox | null = await this.kit.readBoxAsync(page.viewId, element.backendNodeId, options);
      if (box !== null)
        activity.aim(box, null);
      const request: IPermissionRequest = ToolKit.request(Resources.typeAction, Resources.typeTitle, frame.origin, details, risk, ToolKit.actingOptions(risk, !isSubmitting));
      await this.kit.followAsync(activity, element, request, options, () => this.kit.askAsync(activity, call, request, progress, async () => {
          const handing: CallOptions = ToolKit.handingOver(options);
          await this.kit.confirmDocumentAsync(page.viewId, frame.documentId, handing);
          await this.kit.calls.sendAsync(page.viewId, Resources.focusMethod, { backendNodeId: element.backendNodeId }, handing);
        }));
      await this.kit.confirmDocumentAsync(page.viewId, frame.documentId, options);

      const classify = (now: ElementFacts): ToolRisk => RiskClassifier.classifyTyping(now.path, isSubmitting, now.form);
      await this.kit.calls.sendAsync(page.viewId, Resources.focusMethod, { backendNodeId: element.backendNodeId }, options);
      await this.kit.confirmRiskAsync(page.viewId, element.backendNodeId, facts, risk, classify, options);
      await this.kit.calls.sendAsync(page.viewId, Resources.insertTextMethod, { text }, options);
      if (isSubmitting) {
        await this.kit.confirmRiskAsync(page.viewId, element.backendNodeId, facts, risk, classify, options, () => new NotSubmittedException());
        const keys: KeyPress = KeyEvents.press(Resources.enterKey, 0);
        await this.kit.calls.pressAsync(page.viewId, Resources.dispatchKeyEventMethod, keys.down, keys.up, ViewCalls.holding(options));
      }
      return this.kit.doneAsync(page.viewId, Resources.typed, shown, options);
    });
  }
}
