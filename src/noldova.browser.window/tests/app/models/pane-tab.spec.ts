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

  it("is titled New tab at about:blank, whether or not it heard the view's start there, and its address once it goes on", () => {
    const heard = new FakeWebViews().open("workspace-1");
    const unheard = new FakeWebViews().open("workspace-1");
    const heardTab = new PaneTab("1", heard);
    const unheardTab = new PaneTab("2", unheard);

    heard.emit(new ViewStateEvent("about:blank", "", false, false, false));
    const titles: string[] = [heardTab.title, unheardTab.title];
    for (const view of [heard, unheard])
      view.emit(new ViewStateEvent("https://example.test/", "", true, false, false));
    titles.push(heardTab.title, unheardTab.title);

    expect(titles).toEqual(["New tab", "New tab", "https://example.test/", "https://example.test/"]);
  });

  it("has no settled title before its first page or while a load has no page title, and its title otherwise", () => {
    const view = new FakeWebViews().open("workspace-1");
    const tab = new PaneTab("5", view);
    const titles: (string | null)[] = [tab.settledTitle];

    for (const state of [new ViewStateEvent("https://example.test/", "", true, false, false), new ViewStateEvent("https://example.test/", "", false, false, false),
      new ViewStateEvent("https://example.test/next", "", true, false, false), new ViewStateEvent("https://example.test/next", "Next", true, false, false)]) {
      view.emit(state);
      titles.push(tab.settledTitle);
    }

    expect(titles).toEqual([null, null, "https://example.test/", null, "Next"]);
  });

  it("takes the engine's address title for no title while a load is under way, and as the title once the load ends", () => {
    const view = new FakeWebViews().open("workspace-1");
    const tab = new PaneTab("6", view);
    const titles: (string | null)[] = [];

    for (const state of [new ViewStateEvent("http://127.0.0.1:43443/three", "127.0.0.1:43443/three", true, false, false),
      new ViewStateEvent("https://example.test/", "example.test", true, false, false), new ViewStateEvent("https://example.test/", "https://example.test/", true, false, false),
      new ViewStateEvent("https://example.test/", "https://example.test", true, false, false),
      new ViewStateEvent("https://example.test/", "example.test/news", true, false, false), new ViewStateEvent("https://example.test/", "example.test", false, false, false)]) {
      view.emit(state);
      titles.push(tab.settledTitle);
    }

    expect(titles).toEqual([null, null, null, null, "example.test/news", "example.test"]);
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
