/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { HistoryTarget } from "../../src/models/history-target.ts";
import { NavigationMove } from "../../src/models/navigation-move.ts";
import { UrlMove } from "../../src/models/url-move.ts";
import { ToolBench } from "../fixtures/tool-bench.fixture.ts";

describe("UrlMove", () => {
  let bench: ToolBench;

  beforeEach(() => {
    bench = new ToolBench();
  });

  afterEach(() => {
    bench[Symbol.dispose]();
  });

  it("targets its URL, with no history entry to check again, without asking the page", async () => {
    const move: UrlMove = new UrlMove("https://docs.example/next");

    expect(move).toBeInstanceOf(NavigationMove);
    expect(await move.readTargetAsync()).toStrictEqual(new HistoryTarget(null, "https://docs.example/next"));
    expect(bench.methods).toEqual([]);
  });

  it("goes to its URL in the view, with the view's answer", async () => {
    const move: UrlMove = new UrlMove("https://docs.example/next");

    expect(await move.goAsync(bench.kit.webViews, ToolBench.VIEW)).toBe(bench.surface.navigationOutcome);
    expect(bench.surface.navigations).toEqual([{ viewId: ToolBench.VIEW, target: "https://docs.example/next" }]);
  });
});
