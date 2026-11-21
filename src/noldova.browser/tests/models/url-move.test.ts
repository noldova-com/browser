/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MalformedReplyException } from "../../src/exceptions/malformed-reply.exception.ts";
import { ActionProgress } from "../../src/models/action-progress.ts";
import { CallOptions } from "../../src/models/call-options.ts";
import { FrameFacts } from "../../src/models/frame-facts.ts";
import { HistoryTarget } from "../../src/models/history-target.ts";
import { NavigationMove } from "../../src/models/navigation-move.ts";
import { UrlMove } from "../../src/models/url-move.ts";
import { WithinDocumentMove } from "../../src/models/within-document-move.ts";
import type { JsonObject } from "../../src/types/json-value.ts";
import { ToolBench } from "../fixtures/tool-bench.fixture.ts";

describe("UrlMove", () => {
  const LEFT: FrameFacts = new FrameFacts("https://docs.example/guide", "https://docs.example", "L1", "F1", null);
  let bench: ToolBench;

  beforeEach(() => {
    bench = new ToolBench();
  });

  afterEach(() => {
    bench[Symbol.dispose]();
  });

  function options(): CallOptions {
    return new CallOptions(new AbortController().signal, Date.now() + 60_000, 100_000, true, new ActionProgress(() => undefined));
  }

  function isLandedAsync(url: string): Promise<boolean> {
    return new UrlMove(url).isLandedAsync(bench.kit.calls, ToolBench.VIEW, LEFT, new HistoryTarget(null, url), new FrameFacts(url, "https://docs.example", "L2", "F1", null), options());
  }

  it("targets its URL, with no history entry to check again, without asking the page", async () => {
    const move: UrlMove = new UrlMove("https://docs.example/next");

    expect(move).toBeInstanceOf(NavigationMove);
    expect(await move.readTargetAsync()).toStrictEqual(new HistoryTarget(null, "https://docs.example/next"));
    expect(bench.methods).toEqual([]);
  });

  it("may stay in the frame's document, at its target's URL", () => {
    const frame: FrameFacts = new FrameFacts("https://docs.example/guide", "https://docs.example", "L1", "F1", null);

    expect(new UrlMove("https://docs.example/guide#setup").readWithinDocument(frame, new HistoryTarget(null, "https://docs.example/guide#setup")))
      .toStrictEqual(new WithinDocumentMove("F1", "https://docs.example/guide#setup"));
  });

  it.each<[string, JsonObject, string, boolean]>([
    ["the entry before it is the page it left", { currentIndex: 2, entries: [{ url: "https://docs.example/" }, { url: "https://docs.example/guide" }, { url: "https://docs.example/next" }] },
      "https://docs.example/next", true],
    ["the entry before it is another page", { currentIndex: 2, entries: [{ url: "https://docs.example/guide" }, { url: "https://docs.example/moved" }, { url: "https://docs.example/next" }] },
      "https://docs.example/next", false],
    ["it replaced the history's first entry", { currentIndex: 0, entries: [{ url: "https://docs.example/next" }] }, "https://docs.example/next", true],
    ["it went to the address it left, which replaced that entry", { currentIndex: 1, entries: [{ url: "https://docs.example/" }, { url: "https://docs.example/guide" }] },
      "https://docs.example/guide", true]
  ])("says whether it landed as asked when %s", async (_case: string, history: JsonObject, url: string, expected: boolean) => {
    bench.surface.answer("Page.getNavigationHistory", history);

    expect(await isLandedAsync(url)).toBe(expected);
    expect(bench.methods).toEqual(["Page.getNavigationHistory"]);
  });

  it.each<[string, JsonObject]>([
    ["no entry list", { currentIndex: 1 }],
    ["an entry before it with no address", { currentIndex: 1, entries: [{}, { url: "https://docs.example/next" }] }]
  ])("refuses a history with %s as a malformed reply", async (_case: string, history: JsonObject) => {
    bench.surface.answer("Page.getNavigationHistory", history);

    await expect(isLandedAsync("https://docs.example/next")).rejects.toBeInstanceOf(MalformedReplyException);
  });

  it("goes to its URL in the view, with the view's answer", async () => {
    const move: UrlMove = new UrlMove("https://docs.example/next");

    expect(await move.goAsync(bench.kit.webViews, ToolBench.VIEW)).toBe(bench.surface.navigationOutcome);
    expect(bench.surface.navigations).toEqual([{ viewId: ToolBench.VIEW, target: "https://docs.example/next" }]);
  });
});
