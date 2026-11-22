/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ToolResult } from "@noldova/desktop.runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PageLoadingException } from "../../src/exceptions/page-loading.exception.ts";
import { Resources } from "../../src/resources.ts";
import { ClickTool } from "../../src/tools/click.tool.ts";
import { ConsoleTool } from "../../src/tools/console.tool.ts";
import { NavigateTool } from "../../src/tools/navigate.tool.ts";
import { ScreenshotTool } from "../../src/tools/screenshot.tool.ts";
import { SnapshotTool } from "../../src/tools/snapshot.tool.ts";
import { WaitForTool } from "../../src/tools/wait-for.tool.ts";
import type { JsonObject, JsonValue } from "../../src/types/json-value.ts";
import { CallFailures } from "../fixtures/call-failures.fixture.ts";
import { ScriptedViews } from "../fixtures/scripted-views.fixture.ts";
import { ToolBench } from "../fixtures/tool-bench.fixture.ts";

// A call while the view's main frame waits for a navigation's next document, when every call the page answers waits for that document,
// waits for it until its time ends: a read then answers with the page the view's history still shows, and an input fails before it's sent.
describe("a call while a navigation is pending", () => {
  const FRAME: JsonObject = { frameTree: { frame: { id: "F1", loaderId: "L1", url: "https://shop.test/cart/", securityOrigin: "https://shop.test" } } };
  const HISTORY: JsonObject = { currentIndex: 0, entries: [{ url: "https://shop.test/cart/", title: "Cart" }] };
  const LINES: readonly JsonValue[] = [[1, "button", "Pay", "", false, 4]];

  let bench: ToolBench;

  function startNavigation(): void {
    bench.surface.emitProtocolEvent(ToolBench.VIEW, "Page.frameStartedNavigating", { frameId: "F1", url: "https://shop.test/help", loaderId: "L2", navigationType: "differentDocument" });
  }

  function commit(): void {
    bench.surface.emitProtocolEvent(ToolBench.VIEW, "Page.frameNavigated", { frame: { id: "F1", loaderId: "L2", url: "https://shop.test/help" } });
  }

  function texts(result: ToolResult): (string | undefined)[] {
    return result.content.map(t => Object.isString(t.value) ? t.value : undefined);
  }

  // A first read, which has the module watch the view's navigations from then on.
  async function watchAsync(): Promise<void> {
    await bench.runAsync(new SnapshotTool(bench.kit), bench.call({}));
  }

  afterEach(() => {
    vi.useRealTimers();
    bench[Symbol.dispose]();
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    bench = new ToolBench();
    bench.surface.answer("Page.getFrameTree", FRAME);
    bench.surface.answer("Page.getNavigationHistory", HISTORY);
    bench.surface.snapshot = () => ScriptedViews.snapshotOf("Cart", LINES);
  });

  it("waits for the next document before it reads the page, and reads it once the frame committed it", async () => {
    await watchAsync();
    startNavigation();
    const running: Promise<ToolResult> = bench.runAsync(new SnapshotTool(bench.kit), bench.call({}));
    await vi.advanceTimersByTimeAsync(1_000);
    const sent: number = bench.surface.snapshotRequests.length;
    commit();

    const result: ToolResult = await running;

    expect([sent, bench.surface.snapshotRequests.length, texts(result).includes(Resources.stillLoading)]).toEqual([1, 2, false]);
  });

  it("answers a snapshot with the page the view's history shows and the still-loading note when the next document doesn't come in time, reading nothing", async () => {
    await watchAsync();
    startNavigation();
    const running: Promise<ToolResult> = bench.runAsync(new SnapshotTool(bench.kit), bench.call({}));
    await vi.advanceTimersByTimeAsync(5_000 - Resources.readMarginMilliseconds);

    const result: ToolResult = await running;

    expect([texts(result).slice(-2), result.structured, bench.surface.snapshotRequests.length]).toEqual([[Resources.formatNavigated("https://shop.test/cart/", "Cart"), Resources.stillLoading],
      { page: { url: "https://shop.test/cart/", title: "Cart" } }, 1]);
  });

  it("sends a read back to the wait when a navigation starts during it, and reads the next document once the frame committed it", async () => {
    await watchAsync();
    let release: (value: JsonValue) => void = () => undefined;
    bench.surface.snapshot = () => {
      bench.surface.snapshot = () => ScriptedViews.snapshotOf("Help", LINES);
      startNavigation();
      return new Promise<JsonValue>(resolve => release = resolve);
    };
    const running: Promise<ToolResult> = bench.runAsync(new SnapshotTool(bench.kit), bench.call({}));
    await vi.advanceTimersByTimeAsync(1_000);
    const sent: number = bench.surface.snapshotRequests.length;
    commit();
    release(ScriptedViews.snapshotOf("Cart", LINES));

    const result: ToolResult = await running;

    expect([sent, bench.surface.snapshotRequests.length, texts(result).some(t => t?.includes("Title: Help") === true)]).toEqual([2, 3, true]);
  });

  it("answers a read sent back by a navigation that starts during it with the still-loading note when the next document doesn't come in time", async () => {
    await watchAsync();
    bench.surface.snapshot = () => {
      startNavigation();
      return new Promise<JsonValue>(() => undefined);
    };
    const running: Promise<ToolResult> = bench.runAsync(new SnapshotTool(bench.kit), bench.call({}));
    await vi.advanceTimersByTimeAsync(5_000 - Resources.readMarginMilliseconds);

    const result: ToolResult = await running;

    expect([texts(result).slice(-2), bench.surface.snapshotRequests.length]).toEqual([[Resources.formatNavigated("https://shop.test/cart/", "Cart"), Resources.stillLoading], 2]);
  });

  it("answers a screenshot with the page the view's history shows and the still-loading note when the next document doesn't come in time, capturing nothing", async () => {
    await watchAsync();
    startNavigation();
    const running: Promise<ToolResult> = bench.runAsync(new ScreenshotTool(bench.kit), bench.call({}));
    await vi.advanceTimersByTimeAsync(5_000 - Resources.readMarginMilliseconds);

    const result: ToolResult = await running;

    expect([texts(result).slice(-2), bench.methods.includes("Page.captureScreenshot")]).toEqual([[Resources.formatNavigated("https://shop.test/cart/", "Cart"), Resources.stillLoading], false]);
  });

  it("reads the console at once, naming the page the view's history shows, and starts no console for the next document", async () => {
    await watchAsync();
    startNavigation();
    const before: number = bench.methods.length;
    const running: Promise<ToolResult> = bench.runAsync(new ConsoleTool(bench.kit), bench.call({}));
    await vi.advanceTimersByTimeAsync(0);

    const result: ToolResult = await running;

    expect([result.structured, bench.methods.slice(before)]).toEqual([{ page: { url: "https://shop.test/cart/", title: "Cart" } }, ["Page.getNavigationHistory"]]);
  });

  it("ends a wait for text unmet when the next document doesn't come in its time, with the page the view's history shows", async () => {
    await watchAsync();
    startNavigation();
    const before: number = bench.methods.length;
    const running: Promise<ToolResult> = bench.runAsync(new WaitForTool(bench.kit), bench.call({ text: "Help", timeoutMilliseconds: 1_000 }));
    await vi.advanceTimersByTimeAsync(1_000);

    const result: ToolResult = await running;

    expect([texts(result).at(-1), result.structured, bench.methods.slice(before)]).toEqual([Resources.formatWaitNotMet(1_000),
      { page: { url: "https://shop.test/cart/", title: "Cart" } }, ["Page.getNavigationHistory"]]);
  });

  it("ends a wait for text unmet when a navigation that starts during it is still pending at its time, reading no text meanwhile", async () => {
    await watchAsync();
    bench.surface.answer("Accessibility.getFullAXTree", { nodes: [{ nodeId: "1", role: { value: "RootWebArea" }, name: { value: "Cart" } }] });
    const running: Promise<ToolResult> = bench.runAsync(new WaitForTool(bench.kit), bench.call({ text: "Help", timeoutMilliseconds: 1_000 }));
    await vi.advanceTimersByTimeAsync(100);
    startNavigation();
    const before: number = bench.methods.length;
    await vi.advanceTimersByTimeAsync(900);

    const result: ToolResult = await running;

    expect([texts(result).at(-1), result.structured, bench.methods.slice(before).includes("Accessibility.getFullAXTree"), bench.methods.at(-1)])
      .toEqual([Resources.formatWaitNotMet(1_000), { page: { url: "https://shop.test/cart/", title: "Cart" } }, false, "Page.getNavigationHistory"]);
  });

  it("waits for the load of a pending navigation without a call the page holds, and meets it at the next document's load", async () => {
    await watchAsync();
    startNavigation();
    const before: number = bench.methods.length;
    const running: Promise<ToolResult> = bench.runAsync(new WaitForTool(bench.kit), bench.call({ load: true, timeoutMilliseconds: 1_000 }));
    await vi.advanceTimersByTimeAsync(100);
    const sent: readonly string[] = bench.methods.slice(before);
    commit();
    bench.surface.emitProtocolEvent(ToolBench.VIEW, "Page.loadEventFired", { timestamp: 2 });

    const result: ToolResult = await running;

    expect([sent, texts(result).at(-1)]).toEqual([[], Resources.waitMet]);
  });

  it("fails a click as the page still loading when the next document doesn't come in time, finding no element and pressing nothing", async () => {
    await watchAsync();
    startNavigation();
    const before: number = bench.methods.length;
    const failing: Promise<void> = CallFailures.expectAsync(bench.runAsync(new ClickTool(bench.kit), bench.call({ reference: "e1" })), PageLoadingException,
      { reason: "Unavailable", moduleCode: "browser.pageLoading" });
    await vi.advanceTimersByTimeAsync(5_000 - Resources.readMarginMilliseconds);

    await failing;
    expect(bench.methods.slice(before)).toEqual([]);
  });

  it("fails a navigation as the page still loading when the next document doesn't come in time, and sends no enable, which would wait for it", async () => {
    await watchAsync();
    startNavigation();
    const before: number = bench.methods.length;
    const failing: Promise<void> = CallFailures.expectAsync(bench.runAsync(new NavigateTool(bench.kit), bench.call({ url: "https://shop.test/" })), PageLoadingException,
      { reason: "Unavailable" });
    await vi.advanceTimersByTimeAsync(5_000 - Resources.readMarginMilliseconds);

    await failing;
    expect(bench.methods.slice(before)).toEqual([]);
  });
});
