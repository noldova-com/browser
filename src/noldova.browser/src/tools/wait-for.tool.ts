/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageAction } from "@noldova/browser.protocol";
import type { IToolDescriptor, ToolCall, ToolResult } from "@noldova/desktop.runtime";

import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import { PageAnswerTimedOutException } from "../exceptions/page-answer-timed-out.exception.ts";
import { PageChangesContextMissingException } from "../exceptions/page-changes-context-missing.exception.ts";
import { PageChangesNotSwitchedException } from "../exceptions/page-changes-not-switched.exception.ts";
import { ProtocolFailedException } from "../exceptions/protocol-failed.exception.ts";
import { ReplyTooLargeException } from "../exceptions/reply-too-large.exception.ts";
import type { IBrowserTool } from "../interfaces/i-browser-tool.ts";
import type { ActionProgress } from "../models/action-progress.ts";
import { BrowserLimits } from "../models/browser-limits.ts";
import type { CallOptions } from "../models/call-options.ts";
import { ChangeQueue } from "../models/change-queue.ts";
import type { ElementReference } from "../models/element-reference.ts";
import type { FrameFacts } from "../models/frame-facts.ts";
import type { SessionPage } from "../models/session-page.ts";
import { ShownPage } from "../models/shown-page.ts";
import { ToolDescriptors } from "../models/tool-descriptors.ts";
import { ToolKit } from "../models/tool-kit.ts";
import { Resources } from "../resources.ts";
import { AccessibilitySnapshot } from "../services/accessibility-snapshot.ts";
import { DomLookup } from "../services/dom-lookup.ts";
import { InputValidator } from "../services/input.validator.ts";
import { JsonShapes } from "../services/json-shapes.ts";
import { LoadWaiter } from "../services/load-waiter.ts";
import { ToolResults } from "../services/tool-results.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";

export class WaitForTool implements IBrowserTool {
  private readonly kit: ToolKit;
  private readonly lookup: DomLookup;
  public readonly descriptor: IToolDescriptor = ToolDescriptors.waitFor;

  public constructor(kit: ToolKit) {
    this.kit = kit;
    this.lookup = new DomLookup(kit.calls);
  }

  public async callAsync(call: ToolCall, progress: ActionProgress): Promise<ToolResult> {
    const input: JsonObject = InputValidator.readObject(call.arguments);
    const choice: string = InputValidator.readExactlyOne(input, ToolDescriptors.waitForChoices);
    const text: string = choice === Resources.textField ? InputValidator.readText(input, Resources.textField, BrowserLimits.maximumTypedTextLength) : "";
    const reference: string = choice === Resources.referenceField ? InputValidator.readText(input, Resources.referenceField, BrowserLimits.maximumReferenceLength) : "";
    const timeout: number = InputValidator.readMilliseconds(input, Resources.timeoutMillisecondsField);
    const page: SessionPage = this.kit.pages.find(call);
    return this.kit.actAsync(call, page, PageAction.Waiting, async activity => {
      const options: CallOptions = ToolKit.optionsFor(activity, call, progress, choice === Resources.referenceField);
      const loads: LoadWaiter = new LoadWaiter(this.kit.webViews.relay, page.viewId);
      try {
        const frame: FrameFacts = await this.kit.readFrameAsync(page.viewId, options);
        const until: number = Math.min(Date.now() + timeout, call.deadline - Resources.answerMarginMilliseconds);
        const isMet: boolean = choice === Resources.loadField
          ? await loads.waitAsync(until, activity.signal)
          : await this.whenAsync(page.viewId, options, until, choice === Resources.textField
            ? async () => this.hasTextAsync(page.viewId, text, options)
            : async () => this.isShownAsync(page.viewId, this.kit.sessions.resolveReference(call.session, reference, page.viewId, frame.documentId), options));
        const now: FrameFacts = await this.kit.readFrameAsync(page.viewId, options);
        return ToolResults.text(isMet ? Resources.waitMet : Resources.formatWaitNotMet(timeout), new ShownPage(now.url, await this.kit.readTitleOfAsync(page.viewId, now.documentId, options)));
      }
      finally {
        loads[Symbol.dispose]();
      }
    });
  }

  private static ignoreUnheard(error: unknown): null {
    if (error instanceof PageChangesContextMissingException || error instanceof PageChangesNotSwitchedException || error instanceof PageAnswerTimedOutException
      || error instanceof ProtocolFailedException)
      return null;
    throw error;
  }

  private async whenAsync(viewId: string, options: CallOptions, until: number, isMetAsync: () => Promise<boolean>): Promise<boolean> {
    if (await isMetAsync())
      return true;
    const limit: AbortController = new AbortController();
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => limit.abort(), Math.max(0, until - Date.now()));
    try {
      return await this.hearUntilAsync(viewId, options, until, AbortSignal.any([options.signal, limit.signal]), isMetAsync);
    }
    finally {
      clearTimeout(timer);
    }
  }

  private async hearUntilAsync(viewId: string, options: CallOptions, until: number, ended: AbortSignal, isMetAsync: () => Promise<boolean>): Promise<boolean> {
    const heard: ChangeQueue = new ChangeQueue(ended);
    const stopHearing: (() => void) | null = await this.kit.changes.hearAsync(viewId, options.withDeadline(until), () => heard.add())
      .catch((error: unknown) => WaitForTool.ignoreUnheard(error));
    if (stopHearing === null) {
      if (!ended.aborted)
        await new Promise<void>(resolve => ended.addEventListener("abort", () => resolve(), { once: true }));
    }
    else {
      try {
        while (await heard.nextAsync())
          if (await isMetAsync())
            return true;
      }
      finally {
        stopHearing();
      }
    }
    return stopHearing === null && await isMetAsync();
  }

  private async hasTextAsync(viewId: string, text: string, options: CallOptions): Promise<boolean> {
    let nodes: JsonObject;
    try {
      nodes = await this.kit.calls.sendAsync(viewId, Resources.getFullAXTreeMethod, {}, options.withMaximumReplyBytes(BrowserLimits.maximumTreeReplyBytes));
    }
    catch (error) {
      if (!(error instanceof ReplyTooLargeException))
        throw error;
      return this.lookup.hasTextAsync(viewId, text, options);
    }
    return AccessibilitySnapshot.readNodes(nodes).nodes.some(t => !t.isIgnored && t.name.includes(text));
  }

  private async isShownAsync(viewId: string, element: ElementReference, options: CallOptions): Promise<boolean> {
    let reply: JsonObject;
    try {
      reply = await this.kit.calls.sendAsync(viewId, Resources.getContentQuadsMethod, { backendNodeId: element.backendNodeId }, options);
    }
    catch (error) {
      if (error instanceof ProtocolFailedException)
        return false;
      throw error;
    }
    const quads: JsonValue | undefined = reply[Resources.quadsField];
    if (!JsonShapes.isArray(quads))
      throw new MalformedReplyException();
    return quads.length > 0;
  }
}
