/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageAction, PageRefusal, type TypedAddressAllowed, TypedAddressAnswerKind, type TypedAddressRefused, TypedAddressRequest } from "@noldova/browser.protocol";
import { WebViewAction, type WebViewNavigation } from "@noldova/desktop.protocol";
import { type IPermissionDetail, type IToolDescriptor, PermissionOption, type ToolCall, ToolContent, type ToolResult,
  ToolRisk } from "@noldova/desktop.runtime";

import { AddressRefusedException } from "../exceptions/address-refused.exception.ts";
import { ArgumentNotOneOfException } from "../exceptions/argument-not-one-of.exception.ts";
import { CallDeniedException } from "../exceptions/call-denied.exception.ts";
import type { CallFailureException } from "../exceptions/call-failure.exception.ts";
import { LandedElsewhereException } from "../exceptions/landed-elsewhere.exception.ts";
import { PageChangedAfterGrantException } from "../exceptions/page-changed-after-grant.exception.ts";
import type { IBrowserTool } from "../interfaces/i-browser-tool.ts";
import { ActionMove } from "../models/action-move.ts";
import type { ActionProgress } from "../models/action-progress.ts";
import { BrowserLimits } from "../models/browser-limits.ts";
import type { CallOptions } from "../models/call-options.ts";
import type { FrameFacts } from "../models/frame-facts.ts";
import type { HistoryTarget } from "../models/history-target.ts";
import type { NavigationMove } from "../models/navigation-move.ts";
import type { PageActivity } from "../models/page-activity.ts";
import type { SessionPage } from "../models/session-page.ts";
import { ShownPage } from "../models/shown-page.ts";
import { ToolDescriptors } from "../models/tool-descriptors.ts";
import { ToolKit } from "../models/tool-kit.ts";
import { UrlMove } from "../models/url-move.ts";
import { Resources } from "../resources.ts";
import { InputValidator } from "../services/input.validator.ts";
import { LoadWaiter } from "../services/load-waiter.ts";
import { PermissionCards } from "../services/permission-cards.ts";
import { ToolFailures } from "../services/tool-failures.ts";
import { ToolResults } from "../services/tool-results.ts";
import type { JsonObject } from "../types/json-value.ts";

export class NavigateTool implements IBrowserTool {
  private static readonly ACTIONS: ReadonlyMap<string, WebViewAction> = new Map([
    [Resources.backAction, WebViewAction.Back], [Resources.forwardAction, WebViewAction.Forward], [Resources.reloadAction, WebViewAction.Reload]
  ]);
  private readonly kit: ToolKit;
  public readonly descriptor: IToolDescriptor = ToolDescriptors.navigate;

  public constructor(kit: ToolKit) {
    this.kit = kit;
  }

  public async callAsync(call: ToolCall, progress: ActionProgress): Promise<ToolResult> {
    const input: JsonObject = InputValidator.readObject(call.arguments);
    const move: NavigationMove = InputValidator.readExactlyOne(input, ToolDescriptors.navigateChoices) === Resources.urlField
      ? new UrlMove(InputValidator.readUrl(input, Resources.urlField))
      : new ActionMove(NavigateTool.readAction(input));
    const page: SessionPage = this.kit.pages.find(call);
    return this.kit.actAsync(call, page, PageAction.Navigating, async activity => {
      const options: CallOptions = ToolKit.optionsFor(activity, call, progress, false);
      await this.kit.calls.sendAsync(page.viewId, Resources.enableMethod, {}, options);
      const frame: FrameFacts = await this.kit.readFrameAsync(page.viewId, options);
      const target: HistoryTarget = await move.readTargetAsync(this.kit.calls, page.viewId, frame, options);
      await this.askAsync(activity, call, page, frame.url, target.url, progress);
      const granted: FrameFacts = await this.kit.readFrameAsync(page.viewId, options);
      if (granted.documentId !== frame.documentId || granted.url !== frame.url)
        throw new PageChangedAfterGrantException();
      if (target.index !== null) {
        const now: HistoryTarget = await move.readTargetAsync(this.kit.calls, page.viewId, frame, options);
        if (now.index !== target.index || now.url !== target.url)
          throw new PageChangedAfterGrantException();
      }

      const loads: LoadWaiter = new LoadWaiter(this.kit.webViews.relay, page.viewId, move.readWithinDocument(frame, target), granted.frameId);
      let isLoaded: boolean;
      try {
        progress.markInputSent();
        const outcome: WebViewNavigation = await move.goAsync(this.kit.webViews, page.viewId);
        const refusal: CallFailureException | null = ToolFailures.fromNavigation(outcome);
        if (refusal !== null)
          throw refusal;
        isLoaded = await loads.waitAsync(call.deadline - Resources.readMarginMilliseconds, activity.signal);
      }
      finally {
        loads[Symbol.dispose]();
      }

      const now: FrameFacts = await this.kit.readFrameAsync(page.viewId, options);
      if (isLoaded && !await move.isLandedAsync(this.kit.calls, page.viewId, granted, target, now, options))
        throw new LandedElsewhereException();
      const title: string = await this.kit.readTitleOfAsync(page.viewId, now.documentId, options);
      const content: ToolContent[] = [ToolContent.fromText(Resources.formatNavigated(now.url, title), now.origin)];
      if (!isLoaded)
        content.push(ToolContent.fromText(Resources.stillLoading, null));
      return ToolResults.page(now.origin, content, new ShownPage(now.url, title));
    });
  }

  private static readAction(input: JsonObject): WebViewAction {
    const action: WebViewAction | undefined = NavigateTool.ACTIONS.get(InputValidator.readText(input, Resources.actionField, BrowserLimits.maximumUrlLength));
    if (action === undefined)
      throw new ArgumentNotOneOfException(Resources.actionField, [...NavigateTool.ACTIONS.keys()]);
    return action;
  }

  private async askAsync(activity: PageActivity, call: ToolCall, page: SessionPage, from: string, target: string, progress: ActionProgress): Promise<void> {
    const details: readonly IPermissionDetail[] = PermissionCards.move(from, target);
    if (target === Resources.blank) {
      await this.kit.askAsync(activity, call, ToolKit.request(Resources.navigateAction, Resources.formatOpenTitle(target), target, details, ToolRisk.Low, ToolKit.lowRiskOptions), progress);
      return;
    }
    const judged: TypedAddressAllowed | TypedAddressRefused = this.kit.origins.judge(target);
    if (judged.kind === TypedAddressAnswerKind.Refused)
      throw new AddressRefusedException(judged.reason);
    if (await this.kit.origins.isAllowedAsync(page.profileKey, judged.origin)) {
      await this.kit.askAsync(activity, call, ToolKit.request(Resources.navigateAction, Resources.formatOpenTitle(Resources.formatHost(judged.origin)), judged.origin, details, ToolRisk.Low,
        ToolKit.lowRiskOptions), progress);
      return;
    }

    const choices: readonly PermissionOption[] = [PermissionOption.AllowAlways, PermissionOption.Deny, PermissionOption.DenyAlways];
    try {
      await this.kit.askAsync(activity, call, ToolKit.request(Resources.navigateAction, Resources.formatLeaveTitle(Resources.formatHost(judged.origin)), judged.origin, details, ToolRisk.Medium,
        choices, Resources.allowSiteLabel), progress);
    }
    catch (error) {
      if (error instanceof CallDeniedException)
        activity.refuse(new PageRefusal(target, judged.origin));
      throw error;
    }
    await this.kit.origins.allowTypedAsync(new TypedAddressRequest(page.profileKey, target));
    if (activity.signal.aborted)
      throw ToolFailures.fromAbort(activity.signal.reason);
  }
}
