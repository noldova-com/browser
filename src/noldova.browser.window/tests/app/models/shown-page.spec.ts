/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { PagePlace } from "../../../src/app/models/page-place.ts";
import { PaneTab } from "../../../src/app/models/pane-tab.ts";
import { ShownPage } from "../../../src/app/models/shown-page.ts";

describe("ShownPage", () => {
  it("keeps the tab, the page's place and what stops following it", () => {
    const tab: PaneTab = new PaneTab("1", null);
    const place: PagePlace = new PagePlace("workspace-1", "https://docs.example.com/");
    const stops: string[] = [];
    const shown: ShownPage = new ShownPage(tab, place, () => stops.push("stopped"));

    shown.stop();

    expect([shown.tab, shown.place, stops]).toEqual([tab, place, ["stopped"]]);
  });
});
