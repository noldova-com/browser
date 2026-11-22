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
import { ReplyTooLargeException } from "../exceptions/reply-too-large.exception.ts";
import { UnknownKeyException } from "../exceptions/unknown-key.exception.ts";
import type { IBrowserTool } from "../interfaces/i-browser-tool.ts";
import type { AccessibilityNode } from "../models/accessibility-node.ts";
import type { ActionProgress } from "../models/action-progress.ts";
import { BrowserLimits } from "../models/browser-limits.ts";
import type { CallOptions } from "../models/call-options.ts";
import type { ElementFacts } from "../models/element-facts.ts";
import { FocusRead } from "../models/focus-read.ts";
import type { FrameFacts } from "../models/frame-facts.ts";
import type { KeyDefinition } from "../models/key-definition.ts";
import type { KeyPress } from "../models/key-press.ts";
import type { SessionPage } from "../models/session-page.ts";
import { ShownElement } from "../models/shown-element.ts";
import { ToolDescriptors } from "../models/tool-descriptors.ts";
import { ToolKit } from "../models/tool-kit.ts";
import { Resources } from "../resources.ts";
import { AccessibilitySnapshot } from "../services/accessibility-snapshot.ts";
import { DomLookup } from "../services/dom-lookup.ts";
import { InputValidator } from "../services/input.validator.ts";
import { JsonShapes } from "../services/json-shapes.ts";
import { KeyEvents } from "../services/key-events.ts";
import { PermissionCards } from "../services/permission-cards.ts";
import { RiskClassifier } from "../services/risk-classifier.ts";
import { ViewCalls } from "../services/view-calls.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";

export class PressKeyTool implements IBrowserTool {
  private readonly kit: ToolKit;
  private readonly lookup: DomLookup;
  public readonly descriptor: IToolDescriptor = ToolDescriptors.pressKey;

  public constructor(kit: ToolKit) {
    this.kit = kit;
    this.lookup = new DomLookup(kit.calls);
  }

  public async callAsync(call: ToolCall, progress: ActionProgress): Promise<ToolResult> {
    const input: JsonObject = InputValidator.readObject(call.arguments);
    const key: string = InputValidator.readText(input, Resources.keyField, Resources.maximumKeyLength);
    const definition: KeyDefinition | null = KeyEvents.find(key);
    if (Object.isNull(definition))
      throw new UnknownKeyException(key);
    const modifiers: readonly string[] = PressKeyTool.readModifiers(input[Resources.modifiersField] ?? []);
    const page: SessionPage = this.kit.pages.find(call);
    return this.kit.actAsync(call, page, PageAction.PressingKey, async activity => {
      const options: CallOptions = ToolKit.optionsFor(activity, call, progress, false);
      const frame: FrameFacts = await this.kit.readActingFrameAsync(page.viewId, options);
      const keys: KeyPress = KeyEvents.press(definition, KeyEvents.readBits(modifiers));
      const read: FocusRead = await this.readFocusedAsync(page.viewId, options);
      const node: AccessibilityNode | null = read.node;
      const focused: number | null = node?.backendNodeId ?? null;
      const facts: ElementFacts | null = Object.isNull(focused) ? null : await this.kit.readElementAsync(page.viewId, focused, options);
      const risk: ToolRisk = Object.isNull(facts) ? PressKeyTool.classifyUnseen(read, key, keys) : RiskClassifier.classifyKey(key, facts.path, facts.form);
      const chord: string = [...modifiers, key].join(Resources.keyChordSeparator);
      const details: IPermissionDetail[] = [
        PermissionCards.page(frame.url, facts?.page.title ?? ""),
        { label: Resources.keyLabel, kind: PermissionDetailKind.Text, value: chord }
      ];
      if (!Object.isNull(node) && !Object.isNull(facts))
        details.push(...PermissionCards.element(facts, new ShownElement(node.role, await this.kit.readNameAsync(page.viewId, node, options),
          RiskClassifier.isSecretField(facts.path))));
      if (!Object.isNull(facts) && RiskClassifier.submitsKey(key, facts.path))
        details.push(...PermissionCards.sends(facts));
      const canTakeOver: boolean = RiskClassifier.isSecretField(facts?.path ?? null) && !RiskClassifier.isSubmittingKey(key);
      await this.kit.askAsync(activity, call, ToolKit.request(Resources.pressKeyAction, PermissionCards.keyTitle(facts, key, chord, frame.origin), frame.origin, details, risk,
        ToolKit.actingOptions(risk, canTakeOver)), progress, Object.isNull(focused) ? null : async () => {
        const handing: CallOptions = ToolKit.handingOver(options);
        await this.kit.confirmDocumentAsync(page.viewId, frame.documentId, handing);
        await this.kit.calls.sendAsync(page.viewId, Resources.focusMethod, { backendNodeId: focused }, handing);
      });
      await this.kit.confirmDocumentAsync(page.viewId, frame.documentId, options);
      if (((await this.readFocusedAsync(page.viewId, options)).node?.backendNodeId ?? null) !== focused)
        throw new PageChangedAfterGrantException();
      if (!Object.isNull(focused) && !Object.isNull(facts))
        await this.kit.confirmRiskAsync(page.viewId, focused, facts, risk, now => RiskClassifier.classifyKey(key, now.path, now.form), options);

      return this.kit.doneAsync(page.viewId, frame.frameId, Resources.pressed, null, options, async () => {
        await this.kit.calls.pressAsync(page.viewId, Resources.dispatchKeyEventMethod, keys.down, keys.up, ViewCalls.holding(options));
        // A key other than Enter or Space submits no form and follows no link by itself, so a document changed by now ends the call as
        // uncertain, even when the page's own handler of the key navigated.
        if (!Resources.activatingKeys.includes(key))
          await this.kit.confirmDocumentAsync(page.viewId, frame.documentId, options);
      });
    });
  }

  private static readModifiers(value: JsonValue): readonly string[] {
    if (!JsonShapes.isArray(value))
      throw new ArgumentNotOneOfException(Resources.modifiersField, Resources.keyModifiers);
    const modifiers: string[] = [];
    for (const modifier of value) {
      if (!Object.isString(modifier) || !Resources.keyModifiers.includes(modifier) || modifiers.includes(modifier))
        throw new ArgumentNotOneOfException(Resources.modifiersField, Resources.keyModifiers);
      modifiers.push(modifier);
    }
    return modifiers;
  }

  // With no focused element found through the document, a key that types or submits could reach a password field or submit a form unseen.
  private static classifyUnseen(read: FocusRead, key: string, keys: KeyPress): ToolRisk {
    return read.isFromDocument && (keys.down.type === Resources.keyDownType || Resources.activatingKeys.includes(key)) ? ToolRisk.High : ToolRisk.Medium;
  }

  private async readFocusedAsync(viewId: string, options: CallOptions): Promise<FocusRead> {
    try {
      return new FocusRead(AccessibilitySnapshot.findFocused(AccessibilitySnapshot.readNodes(
        await this.kit.calls.sendAsync(viewId, Resources.getFullAXTreeMethod, {}, options.withMaximumReplyBytes(BrowserLimits.maximumTreeReplyBytes))).nodes), false);
    }
    catch (error) {
      if (!(error instanceof ReplyTooLargeException))
        throw error;
      return new FocusRead(await this.lookup.findFocusedAsync(viewId, options), true);
    }
  }
}
