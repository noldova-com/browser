/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, test } from "../fixtures/app-test.ts";
import { TestApp } from "../fixtures/test-app.ts";
import { ToolReply } from "../fixtures/tool-reply.ts";
import { ViewPage } from "../fixtures/view-pages.ts";

const AGENT_BAR = "nol-browser-agent-bar";
const PRESS_LINE = /button "Press" \[(e\d+)\]/;

// A long page that records each scroll, of the page or of the inner pane, and each click; the button is placed against the view's height once
// the page is scrolled to 1000, in the page or, scrolled out of its view, in an inner pane 200 px high and 100 px below the view's top.
const PAGE = "<!doctype html><title>One</title><body style=\"margin:0;height:6000px\">"
  + "<button type=\"button\" id=\"press\" style=\"position:absolute;left:20px;width:200px;top:0;height:40px\">Press</button>"
  + "<div id=\"pane\" style=\"position:absolute;left:300px;width:300px;top:1100px;height:200px;overflow:auto\"><div style=\"height:1200px\"></div></div>"
  + "<script>window.seen = []; addEventListener(\"scroll\", t => seen.push(t.target === document ? \"scroll\" : \"pane-scroll\"), true);"
  + "addEventListener(\"click\", () => seen.push(\"click\"), true);</script>";

// A case's place for the button, from the view's height h, and what it shows before the click: whether the view's top or bottom edge
// crosses it, whether its centre is in the view, and what the click moves to it: nothing, the page or the pane.
class ClickCase {
  public readonly name: string;
  public readonly place: string;
  public readonly isTopCut: boolean;
  public readonly isBottomCut: boolean;
  public readonly isCentreIn: boolean;
  public readonly moves: string;

  public constructor(name: string, place: string, isTopCut: boolean, isBottomCut: boolean, isCentreIn: boolean, moves: string) {
    this.name = name;
    this.place = place;
    this.isTopCut = isTopCut;
    this.isBottomCut = isBottomCut;
    this.isCentreIn = isCentreIn;
    this.moves = moves;
  }
}

// The page's and the pane's scroll, the view's height, the button's top and bottom in the view and what the page recorded.
class PressState {
  public readonly scrollY: number;
  public readonly paneScroll: number;
  public readonly height: number;
  public readonly top: number;
  public readonly bottom: number;
  public readonly seen: readonly string[];

  public constructor(scrollY: number, paneScroll: number, height: number, top: number, bottom: number, seen: readonly string[]) {
    this.scrollY = scrollY;
    this.paneScroll = paneScroll;
    this.height = height;
    this.top = top;
    this.bottom = bottom;
    this.seen = seen;
  }
}

const CASES: readonly ClickCase[] = [
  new ClickCase("cut at the view's bottom edge, its centre in view", "press.style.top = (1000 + h - 50) + \"px\"; press.style.height = \"60px\"",
    false, true, true, "nothing"),
  new ClickCase("taller than the view, cut at both edges, its centre in view", "press.style.top = (1000 - h / 2) + \"px\"; press.style.height = (2 * h) + \"px\"",
    true, true, true, "nothing"),
  new ClickCase("below the view", "press.style.top = (1000 + 2 * h) + \"px\"", false, false, false, "page"),
  new ClickCase("in an inner pane, out of the pane's view, its centre in the page's view", "pane.append(press); press.style.top = \"300px\"", false, false, true, "pane")
];

// The state from the read below.
function stateOf(text: string): PressState {
  const [scrollY = "", paneScroll = "", height = "", top = "", bottom = "", seen = ""] = text.split(" ");
  return new PressState(Number(scrollY), Number(paneScroll), Number(height), Number(top), Number(bottom), seen === "" ? [] : seen.split(","));
}

const READ = "(() => { const box = document.getElementById(\"press\").getBoundingClientRect();"
  + " return [scrollY, document.getElementById(\"pane\").scrollTop, innerHeight, box.top, box.bottom, seen.join(\",\")].join(\" \"); })()";

test.describe("an agent's click on an element in view", () => {
  for (const item of CASES)
    test(`a click on a button ${item.name} moves ${item.moves === "nothing" ? "nothing" : `the ${item.moves} to it`}, and reaches it`, async ({ app, servers }) => {
      const docs = await servers.startAsync("docs.localhost", { "/": PAGE });
      await app.allowLocalSitesAsync([docs.origin]);
      const instance = await app.openPageAsync(docs.url("/"));
      await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/"), "One")]);
      await app.viewPages.runAtAsync(docs.url("/"), "scrollTo(0, 1000); true");
      const bindings = { page: instance, profileKey: TestApp.PROFILE_KEY };
      const snapshot = ToolReply.textOf(await app.requestAsync("agent-double.callTool", { name: "browser_snapshot", input: {}, bindings }));
      const reference = PRESS_LINE.exec(snapshot)?.[1] ?? "";
      // Placed once the agent's bar shows and the view has the height left under it, as the bar comes after the call answers; the page's own
      // scroll is recorded before the count starts.
      await expect(app.window.locator(AGENT_BAR)).toBeVisible();
      const host = app.window.locator(".nol-browser-page-view");
      await expect.poll(async () => Number(await app.viewPages.runAtAsync(docs.url("/"), "innerHeight")) === Math.round((await host.boundingBox())?.height ?? -1),
        { message: "The view never took the height under the agent's bar." }).toBe(true);
      await app.viewPages.runAtAsync(docs.url("/"), `const h = innerHeight; const press = document.getElementById("press"); const pane = document.getElementById("pane");`
        + `${item.place}; true`);
      await expect.poll(() => app.viewPages.runAtAsync(docs.url("/"), "seen.includes(\"scroll\")")).toBe("true");
      const before = stateOf(await app.viewPages.runAtAsync(docs.url("/"), `seen.length = 0; ${READ}`));
      const centre = (before.top + before.bottom) / 2;
      expect([before.top < 0 && before.bottom > 0, before.top < before.height && before.bottom > before.height, centre >= 0 && centre < before.height],
        "The button isn't placed as the case says.")
        .toEqual([item.isTopCut, item.isBottomCut, item.isCentreIn]);
      await app.requestAsync("agent-double.planAnswer", { action: "browser.click", answer: "allowOnce" });

      const result = await app.requestAsync("agent-double.callTool", { name: "browser_click", input: { reference }, bindings });

      expect(result, "The click failed.").toEqual(expect.objectContaining({ isFailure: false }));
      const after = stateOf(await app.viewPages.runAtAsync(docs.url("/"), READ));
      expect([after.height, after.seen.at(-1)], "The view's height changed, or the click didn't reach the button.").toEqual([before.height, "click"]);
      if (item.moves === "nothing")
        expect([after.scrollY, after.paneScroll, after.top, after.seen]).toEqual([before.scrollY, before.paneScroll, before.top, ["click"]]);
      else if (item.moves === "page")
        expect([after.scrollY > before.scrollY, after.seen.includes("scroll")]).toEqual([true, true]);
      else
        expect([after.paneScroll > before.paneScroll, after.seen.includes("pane-scroll")]).toEqual([true, true]);
    });
});
