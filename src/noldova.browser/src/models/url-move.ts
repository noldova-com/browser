/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { WebViewNavigation } from "@noldova/desktop.protocol";
import type { IRuntimeWebViews } from "@noldova/desktop.runtime";

import type { ViewCalls } from "../services/view-calls.ts";
import type { JsonValue } from "../types/json-value.ts";
import type { CallOptions } from "./call-options.ts";
import type { FrameFacts } from "./frame-facts.ts";
import { HistoryTarget } from "./history-target.ts";
import { NavigationMove } from "./navigation-move.ts";
import { WithinDocumentMove } from "./within-document-move.ts";

export class UrlMove extends NavigationMove {
  public readonly url: string;

  public constructor(url: string) {
    super();
    this.url = url;
  }

  public readTargetAsync(): Promise<HistoryTarget> {
    return Promise.resolve(new HistoryTarget(null, this.url));
  }

  public readWithinDocument(frame: FrameFacts, target: HistoryTarget): WithinDocumentMove {
    return new WithinDocumentMove(frame.frameId, target.url);
  }

  public async goAsync(webViews: IRuntimeWebViews, viewId: string): Promise<WebViewNavigation> {
    return await webViews.navigateAsync(viewId, this.url);
  }

  public async isLandedAsync(calls: ViewCalls, viewId: string, left: FrameFacts, _target: HistoryTarget, landed: FrameFacts, options: CallOptions): Promise<boolean> {
    const [current, entries]: [number, readonly JsonValue[]] = await NavigationMove.readHistoryAsync(calls, viewId, options);
    const before: JsonValue | undefined = entries[current - 1];
    return before === undefined || landed.url === left.url || NavigationMove.readEntryUrl(before) === left.url;
  }
}
