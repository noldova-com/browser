/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { PaneTab } from "../../../src/app/models/pane-tab.ts";
import { ViewStateEvent } from "../../../src/app/models/view-state-event.ts";
import { FakeWebViews } from "../../fixtures/fake-web-views.fixture.ts";

describe("PaneTab", () => {
  it("is titled with the page's title, its address while it has none, and New tab before its first page", () => {
    const view = new FakeWebViews().open("workspace-1");
    const tab = new PaneTab("1", view);
    const titles: string[] = [tab.title];

    view.emit(new ViewStateEvent("https://example.test/", "", true, false, false));
    titles.push(tab.title);
    view.emit(new ViewStateEvent("https://example.test/", "Example", false, false, false));
    titles.push(tab.title);

    expect(titles).toEqual(["New tab", "https://example.test/", "Example"]);
  });

  it("shows its page while it loads or has loaded, and a message in every other state", () => {
    const view = new FakeWebViews().open("workspace-1");
    const tab = new PaneTab("3", view);
    const shows: boolean[] = [tab.showsPage];

    view.emit(new ViewStateEvent("https://example.test/", "", true, false, false));
    shows.push(tab.showsPage);
    view.emit(new ViewStateEvent("https://example.test/", "Example", false, false, false));
    shows.push(tab.showsPage);
    view.crash();
    shows.push(tab.showsPage, new PaneTab("4", null).showsPage);

    expect(shows).toEqual([false, true, true, false, false]);
  });

  it("drives its own view through its own controller", () => {
    const view = new FakeWebViews().open("workspace-1");
    const tab = new PaneTab("2", view);

    tab.controller.close();

    expect([tab.id, tab.view, view.isClosed]).toEqual(["2", view, true]);
  });
});
