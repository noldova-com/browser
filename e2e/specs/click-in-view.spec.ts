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

const PROFILE_KEY = "e2e";
const PRESS_LINE = /button "Press" \[(e\d+)\]/;

// A long page that records each scroll and click; the button is placed against the view's height once the page is scrolled.
const PAGE = "<!doctype html><title>One</title><body style=\"margin:0;height:6000px\">"
  + "<button type=\"button\" id=\"press\" style=\"position:absolute;left:20px;width:200px;top:0;height:40px\">Press</button>"
  + "<script>window.seen = []; addEventListener(\"scroll\", () => seen.push(\"scroll\"));"
  + "addEventListener(\"click\", () => seen.push(\"click\"), true);</script>";

// Each case's top and height, from the view's height h, below a scroll of 1000.
const CASES = [
  { name: "cut at the view's bottom edge, its centre in view", top: "h - 50", height: "60", isScrolled: false },
  { name: "taller than the view, cut at both edges, its centre in view", top: "-h / 2", height: "2 * h", isScrolled: false },
  { name: "below the view", top: "2 * h", height: "40", isScrolled: true }
] as const;

interface IState {
  readonly scrollY: number;
  readonly top: number;
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

// The page's scroll, the button's top in the view and what the page recorded, from the read below.
function stateOf(text: string): IState {
  const [scrollY = "", top = "", seen = ""] = text.split(" ");
  return { scrollY: Number(scrollY), top: Number(top), seen: seen === "" ? [] : seen.split(",") };
}

test.describe("an agent's click on an element in view", () => {
  for (const item of CASES)
    test(`a click on a button ${item.name} ${item.isScrolled ? "scrolls to it" : "moves nothing"}, and reaches it`, async ({ app, servers }) => {
      const docs = await servers.startAsync("docs.localhost", { "/": PAGE });
      await app.allowLocalSitesAsync([docs.origin]);
      const instance = await app.openPageAsync(docs.url("/"));
      await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/"), "One")]);
      await app.viewPages.runAtAsync(docs.url("/"), "scrollTo(0, 1000); true");
      const bindings = { page: instance, profileKey: PROFILE_KEY };
      const snapshot = textOf(await app.requestAsync("agent-double.callTool", { name: "browser_snapshot", input: {}, bindings }));
      const reference = PRESS_LINE.exec(snapshot)?.[1] ?? "";
      // Placed once the agent acts, as the pane's bar for it makes the view shorter; the page's own scroll is recorded before the count starts.
      await app.viewPages.runAtAsync(docs.url("/"), `const h = innerHeight; const press = document.getElementById("press");`
        + `press.style.top = (1000 + ${item.top}) + "px"; press.style.height = (${item.height}) + "px"; true`);
      await expect.poll(() => app.viewPages.runAtAsync(docs.url("/"), "seen.includes(\"scroll\")")).toBe("true");
      const read = "[scrollY, document.getElementById(\"press\").getBoundingClientRect().top, seen.join(\",\")].join(\" \")";
      const before = stateOf(await app.viewPages.runAtAsync(docs.url("/"), `seen.length = 0; ${read}`));
      await app.requestAsync("agent-double.planAnswer", { action: "browser.click", answer: "allowOnce" });

      const result = await app.requestAsync("agent-double.callTool", { name: "browser_click", input: { reference }, bindings });

      expect(result, "The click failed.").toEqual(expect.objectContaining({ isFailure: false }));
      const after = stateOf(await app.viewPages.runAtAsync(docs.url("/"), read));
      if (item.isScrolled)
        expect([after.scrollY > before.scrollY, after.seen.includes("scroll"), after.seen.at(-1)]).toEqual([true, true, "click"]);
      else
        expect([after.scrollY, after.top, after.seen]).toEqual([before.scrollY, before.top, ["click"]]);
    });
});
