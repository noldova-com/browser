/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageAction } from "@noldova/browser.protocol";
import { type IPermissionDetail, type IToolDescriptor, PermissionDetailKind, type ToolCall, type ToolResult,
  ToolRisk } from "@noldova/desktop.runtime";

import { ArgumentNotOneOfException } from "../exceptions/argument-not-one-of.exception.ts";
import { PageChangedAfterGrantException } from "../exceptions/page-changed-after-grant.exception.ts";
import { UnknownKeyException } from "../exceptions/unknown-key.exception.ts";
import type { IBrowserTool } from "../interfaces/i-browser-tool.ts";
import type { ActionProgress } from "../models/action-progress.ts";
import { BrowserLimits } from "../models/browser-limits.ts";
import type { CallOptions } from "../models/call-options.ts";
import type { ElementFacts } from "../models/element-facts.ts";
import type { FrameFacts } from "../models/frame-facts.ts";
import type { KeyDefinition } from "../models/key-definition.ts";
import type { KeyPress } from "../models/key-press.ts";
import type { SessionPage } from "../models/session-page.ts";
import { ToolDescriptors } from "../models/tool-descriptors.ts";
import { ToolKit } from "../models/tool-kit.ts";
import { Resources } from "../resources.ts";
import { AccessibilitySnapshot } from "../services/accessibility-snapshot.ts";
import { ElementDetails } from "../services/element-details.ts";
import { InputValidator } from "../services/input.validator.ts";
import { JsonShapes } from "../services/json-shapes.ts";
import { KeyEvents } from "../services/key-events.ts";
import { RiskClassifier } from "../services/risk-classifier.ts";
import { ViewCalls } from "../services/view-calls.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";

export class PressKeyTool implements IBrowserTool {
  private readonly kit: ToolKit;
  public readonly descriptor: IToolDescriptor = ToolDescriptors.pressKey;

  public constructor(kit: ToolKit) {
    this.kit = kit;
  }

  public async callAsync(call: ToolCall, progress: ActionProgress): Promise<ToolResult> {
    const input: JsonObject = InputValidator.readObject(call.arguments);
    const key: string = InputValidator.readText(input, Resources.keyField, Resources.maximumKeyLength);
    const definition: KeyDefinition | null = KeyEvents.find(key);
    if (definition === null)
      throw new UnknownKeyException(key);
    const modifiers: readonly string[] = PressKeyTool.readModifiers(input[Resources.modifiersField] ?? []);
    const page: SessionPage = this.kit.pages.find(call);
    return this.kit.actAsync(call, page, PageAction.PressingKey, async activity => {
      const options: CallOptions = ToolKit.optionsFor(activity, call, progress, false);
      const frame: FrameFacts = await this.kit.readFrameAsync(page.viewId, options);
      const focused: number | null = await this.readFocusedAsync(page.viewId, options);
      const facts: ElementFacts | null = focused === null ? null : await this.kit.readElementAsync(page.viewId, focused, options);
      const risk: ToolRisk = facts === null ? ToolRisk.Medium : RiskClassifier.classifyKey(key, facts.path, facts.form);
      const details: IPermissionDetail[] = [
        { label: Resources.keyLabel, kind: PermissionDetailKind.Text, value: [...modifiers, key].join(Resources.keyChordSeparator) },
        ...facts === null ? [] : ElementDetails.describe(facts)
      ];
      const canTakeOver: boolean = RiskClassifier.isSecretField(facts?.path ?? null) && !RiskClassifier.isSubmittingKey(key);
      await this.kit.askAsync(activity, call, ToolKit.request(Resources.pressKeyAction, Resources.pressKeyTitle, frame.origin, details, risk,
        ToolKit.actingOptions(risk, canTakeOver)), progress, focused === null ? null : async () => {
        const handing: CallOptions = ToolKit.handingOver(options);
        await this.kit.confirmDocumentAsync(page.viewId, frame.documentId, handing);
        await this.kit.calls.sendAsync(page.viewId, Resources.focusMethod, { backendNodeId: focused }, handing);
      });
      await this.kit.confirmDocumentAsync(page.viewId, frame.documentId, options);
      if (await this.readFocusedAsync(page.viewId, options) !== focused)
        throw new PageChangedAfterGrantException();
      if (focused !== null && facts !== null)
        await this.kit.confirmRiskAsync(page.viewId, focused, facts, risk, now => RiskClassifier.classifyKey(key, now.path, now.form), options);

      const keys: KeyPress = KeyEvents.press(definition, KeyEvents.readBits(modifiers));
      await this.kit.calls.pressAsync(page.viewId, Resources.dispatchKeyEventMethod, keys.down, keys.up, ViewCalls.holding(options));
      return this.kit.doneAsync(page.viewId, Resources.pressed, null, options);
    });
  }

  private static readModifiers(value: JsonValue): readonly string[] {
    if (!JsonShapes.isArray(value))
      throw new ArgumentNotOneOfException(Resources.modifiersField, Resources.keyModifiers);
    const modifiers: string[] = [];
    for (const modifier of value) {
      if (typeof modifier !== "string" || !Resources.keyModifiers.includes(modifier) || modifiers.includes(modifier))
        throw new ArgumentNotOneOfException(Resources.modifiersField, Resources.keyModifiers);
      modifiers.push(modifier);
    }
    return modifiers;
  }

  private async readFocusedAsync(viewId: string, options: CallOptions): Promise<number | null> {
    return AccessibilitySnapshot.findFocused(AccessibilitySnapshot.readNodes(
      await this.kit.calls.sendAsync(viewId, Resources.getFullAXTreeMethod, {}, options.withMaximumReplyBytes(BrowserLimits.maximumTreeReplyBytes))));
  }
}
