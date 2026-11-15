/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { WebViewNavigation } from "@noldova/desktop.protocol";
import type { IRuntimeWebViews } from "@noldova/desktop.runtime";

import { HistoryTarget } from "./history-target.ts";
import { NavigationMove } from "./navigation-move.ts";

export class UrlMove extends NavigationMove {
  public readonly url: string;

  public constructor(url: string) {
    super();
    this.url = url;
  }

  public readTargetAsync(): Promise<HistoryTarget> {
    return Promise.resolve(new HistoryTarget(null, this.url));
  }

  public async goAsync(webViews: IRuntimeWebViews, viewId: string): Promise<WebViewNavigation> {
    return await webViews.navigateAsync(viewId, this.url);
  }
}
