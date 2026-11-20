/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/context.json";

import { expect, test } from "../fixtures/app-test.ts";
import { ViewPage } from "../fixtures/view-pages.ts";

const AGENT_BAR = "nol-browser-agent-bar";
const PROFILE_KEY = "e2e";
const PRESS_LINE = /button "Press" \[(e\d+)\]/;

// A long page that records each scroll, of the page or of the inner pane, and each click; the button is placed against the view's height once
// the page is scrolled to 1000, in the page or, scrolled out of its view, in an inner pane 200 px high and 100 px below the view's top.
const PAGE = "<!doctype html><title>One</title><body style=\"margin:0;height:6000px\">"
  + "<button type=\"button\" id=\"press\" style=\"position:absolute;left:20px;width:200px;top:0;height:40px\">Press</button>"
  + "<div id=\"pane\" style=\"position:absolute;left:300px;width:300px;top:1100px;height:200px;overflow:auto\"><div style=\"height:1200px\"></div></div>"
  + "<script>window.seen = []; addEventListener(\"scroll\", t => seen.push(t.target === document ? \"scroll\" : \"pane-scroll\"), true);"
  + "addEventListener(\"click\", () => seen.push(\"click\"), true);</script>";

// Each case's place for the button, from the view's height h, and what it shows before the click: whether the view's top or bottom edge
// crosses it, and whether its centre is in the view.
const CASES = [
  { name: "cut at the view's bottom edge, its centre in view", place: "press.style.top = (1000 + h - 50) + \"px\"; press.style.height = \"60px\"",
    isTopCut: false, isBottomCut: true, isCentreIn: true, moves: "nothing" },
  { name: "taller than the view, cut at both edges, its centre in view", place: "press.style.top = (1000 - h / 2) + \"px\"; press.style.height = (2 * h) + \"px\"",
    isTopCut: true, isBottomCut: true, isCentreIn: true, moves: "nothing" },
  { name: "below the view", place: "press.style.top = (1000 + 2 * h) + \"px\"",
    isTopCut: false, isBottomCut: false, isCentreIn: false, moves: "page" },
  { name: "in an inner pane, out of the pane's view, its centre in the page's view", place: "pane.append(press); press.style.top = \"300px\"",
    isTopCut: false, isBottomCut: false, isCentreIn: true, moves: "pane" }
] as const;

interface IState {
  readonly scrollY: number;
  readonly paneScroll: number;
  readonly height: number;
  readonly top: number;
  readonly bottom: number;
  readonly seen: readonly string[];
}

function isObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textOf(result: JsonValue): string {
  const content = isObject(result) ? result["content"] : undefined;
  return (Array.isArray(content) ? content : []).map((t: JsonValue) => {
    const text = isObject(t) ? t["text"] : undefined;
    return typeof text === "string" ? text : "";
  }).join("\n");
}

// The page's and the pane's scroll, the view's height, the button's top and bottom in the view and what the page recorded, from the read below.
function stateOf(text: string): IState {
  const [scrollY = "", paneScroll = "", height = "", top = "", bottom = "", seen = ""] = text.split(" ");
  return { scrollY: Number(scrollY), paneScroll: Number(paneScroll), height: Number(height), top: Number(top), bottom: Number(bottom),
    seen: seen === "" ? [] : seen.split(",") };
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
      const bindings = { page: instance, profileKey: PROFILE_KEY };
      const snapshot = textOf(await app.requestAsync("agent-double.callTool", { name: "browser_snapshot", input: {}, bindings }));
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
