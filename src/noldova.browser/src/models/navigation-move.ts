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
import type { CallOptions } from "./call-options.ts";
import type { FrameFacts } from "./frame-facts.ts";
import type { HistoryTarget } from "./history-target.ts";

export abstract class NavigationMove {
  public abstract readTargetAsync(calls: ViewCalls, viewId: string, frame: FrameFacts, options: CallOptions): Promise<HistoryTarget>;

  public abstract goAsync(webViews: IRuntimeWebViews, viewId: string): Promise<WebViewNavigation>;
}
