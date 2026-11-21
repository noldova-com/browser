/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { WebViewNavigation } from "@noldova/desktop.protocol";
import type { IRuntimeWebViews } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { HistoryTarget } from "../../src/models/history-target.ts";
import { NavigationMove } from "../../src/models/navigation-move.ts";
import type { WithinDocumentMove } from "../../src/models/within-document-move.ts";

describe("NavigationMove", () => {
  it("is the base of each way the navigate tool moves the page, which reads its target, whether it may stay in its document, goes there, and says whether it landed as asked", async () => {
    class StayMove extends NavigationMove {
      public readTargetAsync(): Promise<HistoryTarget> {
        return Promise.resolve(new HistoryTarget(null, "about:blank"));
      }

      public readWithinDocument(): WithinDocumentMove | null {
        return null;
      }

      public goAsync(webViews: IRuntimeWebViews, viewId: string): Promise<WebViewNavigation> {
        return webViews.navigateAsync(viewId, "about:blank");
      }

      public isLandedAsync(): Promise<boolean> {
        return Promise.resolve(true);
      }
    }

    const move: StayMove = new StayMove();

    expect([move instanceof NavigationMove, await move.readTargetAsync(), move.readWithinDocument(), await move.isLandedAsync()])
      .toStrictEqual([true, new HistoryTarget(null, "about:blank"), null, true]);
  });
});
