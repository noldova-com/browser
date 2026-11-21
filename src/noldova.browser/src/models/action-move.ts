/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewAction, type WebViewNavigation } from "@noldova/desktop.protocol";
import type { IRuntimeWebViews } from "@noldova/desktop.runtime";

import { NoHistoryException } from "../exceptions/no-history.exception.ts";
import type { ViewCalls } from "../services/view-calls.ts";
import type { JsonValue } from "../types/json-value.ts";
import type { CallOptions } from "./call-options.ts";
import type { FrameFacts } from "./frame-facts.ts";
import { HistoryTarget } from "./history-target.ts";
import { NavigationMove } from "./navigation-move.ts";
import { WithinDocumentMove } from "./within-document-move.ts";

export class ActionMove extends NavigationMove {
  public readonly action: WebViewAction;

  public constructor(action: WebViewAction) {
    super();
    this.action = action;
  }

  public async readTargetAsync(calls: ViewCalls, viewId: string, frame: FrameFacts, options: CallOptions): Promise<HistoryTarget> {
    if (this.action === WebViewAction.Reload)
      return new HistoryTarget(null, frame.address);
    const [current, entries]: [number, readonly JsonValue[]] = await NavigationMove.readHistoryAsync(calls, viewId, options);
    const index: number = this.action === WebViewAction.Back ? current - 1 : current + 1;
    const entry: JsonValue | undefined = entries[index];
    if (entry === undefined)
      throw new NoHistoryException();
    return new HistoryTarget(index, NavigationMove.readEntryUrl(entry));
  }

  // A reload always takes a new document, so only back and forward may stay in theirs.
  public readWithinDocument(frame: FrameFacts, target: HistoryTarget): WithinDocumentMove | null {
    return this.action === WebViewAction.Reload ? null : new WithinDocumentMove(frame.frameId, target.url);
  }

  public async goAsync(webViews: IRuntimeWebViews, viewId: string): Promise<WebViewNavigation> {
    return await webViews.actAsync(viewId, this.action);
  }

  public isLandedAsync(_calls: ViewCalls, _viewId: string, _left: FrameFacts, target: HistoryTarget, landed: FrameFacts): Promise<boolean> {
    return Promise.resolve(landed.address === target.url);
  }
}
