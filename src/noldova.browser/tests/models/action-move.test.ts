/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewAction } from "@noldova/desktop.protocol";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MalformedReplyException } from "../../src/exceptions/malformed-reply.exception.ts";
import { NoHistoryException } from "../../src/exceptions/no-history.exception.ts";
import { ActionMove } from "../../src/models/action-move.ts";
import { ActionProgress } from "../../src/models/action-progress.ts";
import { CallOptions } from "../../src/models/call-options.ts";
import { FrameFacts } from "../../src/models/frame-facts.ts";
import { HistoryTarget } from "../../src/models/history-target.ts";
import { NavigationMove } from "../../src/models/navigation-move.ts";
import { WithinDocumentMove } from "../../src/models/within-document-move.ts";
import type { JsonObject } from "../../src/types/json-value.ts";
import { ToolBench } from "../fixtures/tool-bench.fixture.ts";

describe("ActionMove", () => {
  const FRAME: FrameFacts = new FrameFacts("https://docs.example/guide", "https://docs.example", "L1", "F1", null);
  const HISTORY: JsonObject = { currentIndex: 1, entries: [{ url: "https://docs.example/" }, { url: "https://docs.example/guide" }, { url: "https://docs.example/next" }] };
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

  it("targets the page's own address for a reload, with no history entry to check again, without reading the history", async () => {
    const move: ActionMove = new ActionMove(WebViewAction.Reload);

    expect(move).toBeInstanceOf(NavigationMove);
    expect(await move.readTargetAsync(bench.kit.calls, ToolBench.VIEW, FRAME, options())).toStrictEqual(new HistoryTarget(null, "https://docs.example/guide"));
    expect(bench.methods).toEqual([]);
  });

  it("targets the history entry before or after the current one for back and forward", async () => {
    bench.surface.answer("Page.getNavigationHistory", HISTORY);

    const back: HistoryTarget = await new ActionMove(WebViewAction.Back).readTargetAsync(bench.kit.calls, ToolBench.VIEW, FRAME, options());
    const forward: HistoryTarget = await new ActionMove(WebViewAction.Forward).readTargetAsync(bench.kit.calls, ToolBench.VIEW, FRAME, options());

    expect([back, forward]).toStrictEqual([new HistoryTarget(0, "https://docs.example/"), new HistoryTarget(2, "https://docs.example/next")]);
    expect(bench.methods).toEqual(["Page.getNavigationHistory", "Page.getNavigationHistory"]);
  });

  it("may stay in the frame's document at its history entry's URL going back or forward, and never on a reload", () => {
    const target: HistoryTarget = new HistoryTarget(0, "https://docs.example/");

    expect([WebViewAction.Back, WebViewAction.Forward, WebViewAction.Reload].map(action => new ActionMove(action).readWithinDocument(FRAME, target)))
      .toStrictEqual([new WithinDocumentMove("F1", "https://docs.example/"), new WithinDocumentMove("F1", "https://docs.example/"), null]);
  });

  it("refuses a move past the history's end as no history", async () => {
    bench.surface.answer("Page.getNavigationHistory", { currentIndex: 0, entries: [{ url: "https://docs.example/" }] });

    await expect(new ActionMove(WebViewAction.Back).readTargetAsync(bench.kit.calls, ToolBench.VIEW, FRAME, options())).rejects.toBeInstanceOf(NoHistoryException);
  });

  it.each<[string, WebViewAction, JsonObject]>([
    ["no current index", WebViewAction.Back, { entries: [] }],
    ["no entry list", WebViewAction.Back, { currentIndex: 0, entries: {} }],
    ["an entry with no address", WebViewAction.Back, { currentIndex: 1, entries: [{}, {}, 7] }],
    ["an entry that isn't an object", WebViewAction.Forward, { currentIndex: 1, entries: [{}, {}, 7] }]
  ])("refuses a history with %s as a malformed reply", async (_name, action, history) => {
    bench.surface.answer("Page.getNavigationHistory", history);

    await expect(new ActionMove(action).readTargetAsync(bench.kit.calls, ToolBench.VIEW, FRAME, options())).rejects.toBeInstanceOf(MalformedReplyException);
  });

  it("targets the address that failed to load for a reload of the engine's error page", async () => {
    const failed: FrameFacts = new FrameFacts("chrome-error://chromewebdata/", "browser:opaque", "L1", "F1", "https://docs.example/guide");

    expect(await new ActionMove(WebViewAction.Reload).readTargetAsync(bench.kit.calls, ToolBench.VIEW, failed, options())).toStrictEqual(new HistoryTarget(null, "https://docs.example/guide"));
  });

  it("says a move landed at its target's address, a reload's being the address it left or failed to load, without reading the history", async () => {
    function isLandedAsync(action: WebViewAction, target: string, url: string): Promise<boolean> {
      return new ActionMove(action).isLandedAsync(bench.kit.calls, ToolBench.VIEW, FRAME, new HistoryTarget(null, target), new FrameFacts(url, "https://docs.example", "L2", "F1", null));
    }

    expect(await Promise.all([
      isLandedAsync(WebViewAction.Reload, "https://docs.example/guide", "https://docs.example/guide"),
      isLandedAsync(WebViewAction.Reload, "https://docs.example/guide", "https://docs.example/moved"),
      isLandedAsync(WebViewAction.Back, "https://docs.example/", "https://docs.example/"),
      isLandedAsync(WebViewAction.Back, "https://docs.example/", "https://docs.example/guide")
    ])).toEqual([true, false, true, false]);
    expect(bench.methods).toEqual([]);
  });

  it("takes its action in the view, with the view's answer", async () => {
    const move: ActionMove = new ActionMove(WebViewAction.Back);

    expect(await move.goAsync(bench.kit.webViews, ToolBench.VIEW)).toBe(bench.surface.navigationOutcome);
    expect(bench.surface.navigations).toEqual([{ viewId: ToolBench.VIEW, target: WebViewAction.Back }]);
  });
});
