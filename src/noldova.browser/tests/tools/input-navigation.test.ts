/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ToolResult } from "@noldova/desktop.runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SnapshotReference } from "../../src/models/snapshot-reference.ts";
import { Resources } from "../../src/resources.ts";
import { ClickTool } from "../../src/tools/click.tool.ts";
import { PressKeyTool } from "../../src/tools/press-key.tool.ts";
import { TypeTool } from "../../src/tools/type.tool.ts";
import type { JsonObject } from "../../src/types/json-value.ts";
import { RequestedNavigation } from "../fixtures/requested-navigation.fixture.ts";
import { ShopPage } from "../fixtures/shop-page.fixture.ts";
import { ToolBench } from "../fixtures/tool-bench.fixture.ts";

// An input that makes the page navigate in place, as a link's click or a form's Enter does, is reported with the page it loaded.
describe("an input that navigates", () => {
  let bench: ToolBench;

  function reference(backendNodeId: number): string {
    return bench.sessions.issueReference(ToolBench.SESSION, new SnapshotReference(ToolBench.VIEW, "L1", backendNodeId));
  }

  // The page's tree, with the field the key goes to focused.
  function focusedTree(backendNodeId: number): JsonObject {
    const focused: JsonObject = { name: "focused", value: { type: "booleanOrUndefined", value: true } };
    return { nodes: [
      { nodeId: "1", role: { value: "RootWebArea" }, properties: [focused], childIds: ["2"] },
      { nodeId: "2", role: { value: "textbox" }, properties: [focused], backendDOMNodeId: backendNodeId }
    ] };
  }

  // The history of a view at the shop's cart.
  const CART_HISTORY: JsonObject = { currentIndex: 1, entries: [{ url: "https://shop.test/", title: "Shop" }, { url: "https://shop.test/cart/", title: "Cart" }] };

  function lastText(result: ToolResult): string | undefined {
    return result.content.map(t => t.value).at(-1);
  }

  afterEach(() => {
    vi.useRealTimers();
    bench[Symbol.dispose]();
  });

  // The call's end, with the fake clock moved on to the help page's load.
  async function loadedAsync(running: Promise<ToolResult>): Promise<ToolResult> {
    await vi.advanceTimersByTimeAsync(RequestedNavigation.LOAD_MILLISECONDS);
    return running;
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    bench = new ToolBench();
  });

  it("by a click is reported with the page it loaded", async () => {
    ShopPage.serve(bench, ShopPage.LINK);
    RequestedNavigation.serve(bench, "Input.dispatchMouseEvent", "mouseReleased");

    const result: ToolResult = await loadedAsync(bench.runAsync(new ClickTool(bench.kit), bench.call({ reference: reference(ShopPage.LINK) })));

    expect([lastText(result), result.structured]).toEqual([`URL: ${RequestedNavigation.URL}`,
      { page: { url: RequestedNavigation.URL, title: RequestedNavigation.TITLE }, element: { role: "link", name: "Help", isSecret: false } }]);
  });

  it("by the Enter that submits typed text is reported with the page it loaded", async () => {
    ShopPage.serve(bench, ShopPage.SEARCH);
    RequestedNavigation.serve(bench, "Input.dispatchKeyEvent", "keyUp");

    const result: ToolResult = await loadedAsync(bench.runAsync(new TypeTool(bench.kit), bench.call({ reference: reference(ShopPage.SEARCH), text: "lamp", submit: true })));

    expect([lastText(result), result.structured]).toMatchObject([`URL: ${RequestedNavigation.URL}`,
      { page: { url: RequestedNavigation.URL, title: RequestedNavigation.TITLE } }]);
  });

  it("by a pressed Enter is reported with the page it loaded", async () => {
    ShopPage.serve(bench, ShopPage.SEARCH);
    bench.surface.answer("Accessibility.getFullAXTree", focusedTree(ShopPage.SEARCH));
    RequestedNavigation.serve(bench, "Input.dispatchKeyEvent", "keyUp");

    const result: ToolResult = await loadedAsync(bench.runAsync(new PressKeyTool(bench.kit), bench.call({ key: "Enter" })));

    expect([lastText(result), result.structured]).toEqual([`URL: ${RequestedNavigation.URL}`, { page: { url: RequestedNavigation.URL, title: RequestedNavigation.TITLE } }]);
  });

  it("is reported as still loading, with the page it left as the view's history holds it, when the call's time ends before the load", async () => {
    ShopPage.serve(bench, ShopPage.LINK);
    RequestedNavigation.serve(bench, "Input.dispatchMouseEvent", "mouseReleased", true);
    bench.surface.answer("Page.getNavigationHistory", CART_HISTORY);

    const running: Promise<ToolResult> = bench.runAsync(new ClickTool(bench.kit), bench.call({ reference: reference(ShopPage.LINK) }));
    await vi.advanceTimersByTimeAsync(5_000 - Resources.readMarginMilliseconds);
    const result: ToolResult = await running;

    expect([result.content.map(t => t.value).slice(-2), result.structured]).toEqual([["URL: https://shop.test/cart/", Resources.stillLoading],
      { page: { url: "https://shop.test/cart/", title: "Cart" }, element: { role: "link", name: "Help", isSecret: false } }]);
  });

  it("goes on once the page asked for the navigation, though the call after the input waits for the next document's answer, and reads no frame", async () => {
    ShopPage.serve(bench, ShopPage.LINK);
    RequestedNavigation.serve(bench, "Input.dispatchMouseEvent", "mouseReleased", true);
    bench.surface.answer("Page.getNavigationHistory", CART_HISTORY);
    bench.surface.answerWith("Page.enable", () => bench.methods.includes("Input.dispatchMouseEvent") ? new Promise<JsonObject>(() => undefined) : {});

    const running: Promise<ToolResult> = bench.runAsync(new ClickTool(bench.kit), bench.call({ reference: reference(ShopPage.LINK) }));
    await vi.advanceTimersByTimeAsync(5_000 - Resources.readMarginMilliseconds);
    const result: ToolResult = await running;
    await vi.advanceTimersByTimeAsync(Resources.readMarginMilliseconds);

    expect(result.content.map(t => t.value).slice(-2)).toEqual(["URL: https://shop.test/cart/", Resources.stillLoading]);
    expect(bench.methods.slice(bench.methods.lastIndexOf("Input.dispatchMouseEvent") + 1)).toEqual(["Page.enable", "Page.getNavigationHistory"]);
  });

  it("isn't waited for when the page asked for no navigation", async () => {
    ShopPage.serve(bench, ShopPage.LINK);

    const result: ToolResult = await bench.runAsync(new ClickTool(bench.kit), bench.call({ reference: reference(ShopPage.LINK) }));

    expect(lastText(result)).toBe("URL: https://shop.test/cart/");
  });
});
