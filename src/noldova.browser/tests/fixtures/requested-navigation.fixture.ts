/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "../../src/types/json-value.ts";
import { ShopPage } from "./shop-page.fixture.ts";
import { ToolBench } from "./tool-bench.fixture.ts";

// A page that, while it handles an input, asks to navigate its main frame to its help page, as a link's click or a form's Enter does.
export class RequestedNavigation {
  public static readonly URL: string = "https://shop.test/help/";
  public static readonly TITLE: string = "Help";
  public static readonly LOAD_MILLISECONDS: number = 1_000;

  // The input is the call of `method` whose `type` is `type`. The help page commits and loads `LOAD_MILLISECONDS` after it on the test's
  // fake clock, after the call's own reads, unless `isLoading` keeps it loading.
  public static serve(bench: ToolBench, method: string, type: string, isLoading: boolean = false): void {
    let isRequested: boolean = false;
    bench.surface.answerWith(method, (params: JsonObject) => {
      if (params["type"] === type && !isRequested) {
        isRequested = true;
        bench.surface.emitProtocolEvent(ToolBench.VIEW, "Page.frameRequestedNavigation",
          { frameId: "F1", reason: "anchorClick", url: RequestedNavigation.URL, disposition: "currentTab" });
        if (!isLoading)
          setTimeout(() => RequestedNavigation.load(bench), RequestedNavigation.LOAD_MILLISECONDS);
      }
      return {};
    });
  }

  private static load(bench: ToolBench): void {
    bench.surface.answer("Page.getFrameTree", { frameTree: { frame: { id: "F1", loaderId: "L2", url: RequestedNavigation.URL, securityOrigin: ShopPage.ORIGIN } } });
    bench.surface.answer("Accessibility.getFullAXTree", { nodes: [{ nodeId: "1", role: { value: "RootWebArea" }, name: { value: RequestedNavigation.TITLE } }] });
    bench.surface.emitProtocolEvent(ToolBench.VIEW, "Page.frameStartedNavigating",
      { frameId: "F1", url: RequestedNavigation.URL, loaderId: "L2", navigationType: "differentDocument" });
    bench.surface.emitProtocolEvent(ToolBench.VIEW, "Page.frameNavigated", { frame: { id: "F1", loaderId: "L2", url: RequestedNavigation.URL } });
    bench.surface.emitProtocolEvent(ToolBench.VIEW, "Page.loadEventFired", { timestamp: 2 });
  }
}
