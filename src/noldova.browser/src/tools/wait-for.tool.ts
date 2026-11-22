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
import { HistoryPageReader } from "../services/history-page.reader.ts";
import { InputValidator } from "../services/input.validator.ts";
import { JsonShapes } from "../services/json-shapes.ts";
import { LoadWaiter } from "../services/load-waiter.ts";
import { ToolResults } from "../services/tool-results.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";

export class WaitForTool implements IBrowserTool {
  private readonly kit: ToolKit;
  public readonly descriptor: IToolDescriptor = ToolDescriptors.waitFor;

  public constructor(kit: ToolKit) {
    this.kit = kit;
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
      const loads: LoadWaiter = new LoadWaiter(this.kit.webViews.relay, page.viewId, null, null);
      try {
        // The page sends its load only once its events are on, as navigate turns them on; a navigation pending in the page says they are,
        // and the call would wait for its next document.
        if (choice === Resources.loadField && !this.kit.navigations.isPending(page.viewId))
          await this.kit.calls.sendAsync(page.viewId, Resources.enableMethod, {}, options);
        // The call's deadline can cut the wait short of its time limit, so a wait that isn't met says how long it waited.
        const started: number = Date.now();
        const until: number = Math.min(started + timeout, call.deadline - Resources.answerMarginMilliseconds);
        const frame: FrameFacts | null = await this.kit.readSettledAsync(page.viewId, until, activity.signal, () => this.kit.readFrameAsync(page.viewId, options));
        const isMet: boolean = !Object.isNull(frame) && (choice === Resources.loadField
          ? await loads.waitAsync(until, activity.signal)
          : await this.whenAsync(page.viewId, options, until, this.settled(page.viewId, until, options, choice === Resources.textField
            ? this.checkText(page.viewId, text, options)
            : await this.checkShownAsync(call.session, reference, page.viewId, frame.documentId, options))));
        return ToolResults.text(isMet ? Resources.waitMet : Resources.formatWaitNotMet(Math.max(0, until - started)), await this.readShownAsync(page.viewId, until, options));
      }
      finally {
        loads[Symbol.dispose]();
      }
    });
  }

  // The page the wait ends on, or the one the view's history still shows while the page waits for its next document at `until`.
  private async readShownAsync(viewId: string, until: number, options: CallOptions): Promise<ShownPage> {
    const shown: ShownPage | null = await this.kit.readSettledAsync(viewId, until, options.signal, async () => {
      const now: FrameFacts = await this.kit.readFrameAsync(viewId, options);
      return new ShownPage(now.url, await this.kit.readTitleOfAsync(viewId, now.documentId, options));
    });
    return shown ?? (await HistoryPageReader.readAsync(this.kit.calls, viewId, options)).page;
  }

  // A check that runs once the page has its next document, and isn't met when the page still waits for it at `until`.
  private settled(viewId: string, until: number, options: CallOptions, isMetAsync: () => Promise<boolean>): () => Promise<boolean> {
    return async () => await this.kit.readSettledAsync(viewId, until, options.signal, isMetAsync) ?? false;
  }

  // The check that the referenced element is shown, which finds its node once, before the wait.
  private async checkShownAsync(session: string, reference: string, viewId: string, documentId: string, options: CallOptions): Promise<() => Promise<boolean>> {
    const element: ElementReference = await this.kit.findReferencedNodeAsync(session, reference, viewId, documentId, options);
    return async () => this.isShownAsync(viewId, element, options);
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
    const stopHearing: (() => void) | null = await this.kit.changes.hearAsync(viewId, () => options.withDeadline(until), () => heard.add())
      .catch((error: unknown) => WaitForTool.ignoreUnheard(error));
    if (Object.isNull(stopHearing)) {
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
    // The last change before the limit may have come during a check, or while the hearing started again in a new document, so the wait reads once more.
    return await isMetAsync();
  }

  // Reads the whole tree for the text until it is too large for one reply, then only the page's shown text, for the rest of the wait.
  private checkText(viewId: string, text: string, options: CallOptions): () => Promise<boolean> {
    let isTooLarge: boolean = false;
    return async () => {
      if (isTooLarge)
        return this.kit.changes.hasTextAsync(viewId, text, options);
      let nodes: JsonObject;
      try {
        nodes = await this.kit.calls.sendAsync(viewId, Resources.getFullAXTreeMethod, {}, options.withMaximumReplyBytes(BrowserLimits.maximumTreeReplyBytes));
      }
      catch (error) {
        if (!(error instanceof ReplyTooLargeException))
          throw error;
        isTooLarge = true;
        return this.kit.changes.hasTextAsync(viewId, text, options);
      }
      return AccessibilitySnapshot.readMaskedNames(AccessibilitySnapshot.readNodes(nodes)).some(t => !t.node.isIgnored && t.name.includes(text));
    };
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
