/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";
import { type ToolResult, WebViewFailureException } from "@noldova/desktop.runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CallCancelledException } from "../../src/exceptions/call-cancelled.exception.ts";
import { ExactlyOneArgumentException } from "../../src/exceptions/exactly-one-argument.exception.ts";
import { MalformedReplyException } from "../../src/exceptions/malformed-reply.exception.ts";
import { PageCrashedException } from "../../src/exceptions/page-crashed.exception.ts";
import { ProtocolFailedException } from "../../src/exceptions/protocol-failed.exception.ts";
import { ViewClosedException } from "../../src/exceptions/view-closed.exception.ts";
import { PageTextScript } from "../../src/models/page-text-script.ts";
import { SnapshotReference } from "../../src/models/snapshot-reference.ts";
import { WaitForTool } from "../../src/tools/wait-for.tool.ts";
import type { JsonObject } from "../../src/types/json-value.ts";
import { CallFailures } from "../fixtures/call-failures.fixture.ts";
import { ShopPage } from "../fixtures/shop-page.fixture.ts";
import { ToolBench } from "../fixtures/tool-bench.fixture.ts";

const FAKED: { toFake: ("setTimeout" | "clearTimeout" | "Date")[] } = { toFake: ["setTimeout", "clearTimeout", "Date"] };

function nodes(names: readonly string[], ignored: boolean = false): JsonObject[] {
  return [
    { nodeId: "1", role: { value: "RootWebArea" }, childIds: names.map((_name: string, index: number) => `${index + 2}`) },
    ...names.map((name: string, index: number) => ({ nodeId: `${index + 2}`, ignored, role: { value: "StaticText" }, name: { value: name }, value: { value: "secret" } }))
  ];
}

function tree(names: readonly string[]): JsonObject {
  return { nodes: nodes(names) };
}

describe("WaitForTool", () => {
  let bench: ToolBench;
  let tool: WaitForTool;

  beforeEach(() => {
    bench = new ToolBench();
    ShopPage.serve(bench, ShopPage.LINK);
    tool = new WaitForTool(bench.kit);
  });

  afterEach(() => {
    vi.useRealTimers();
    bench[Symbol.dispose]();
  });

  async function waitOutAsync(running: Promise<ToolResult>, milliseconds: number): Promise<ToolResult> {
    await ToolBench.settleAsync();
    await vi.advanceTimersByTimeAsync(milliseconds);
    return running;
  }

  it("is met once a shown node's name holds the text, read again when the page reports a change, raising no request", async () => {
    vi.useFakeTimers(FAKED);
    const trees: JsonObject[] = [tree(["Loading"]), tree(["Order placed"])];
    bench.surface.answerWith("Accessibility.getFullAXTree", () => trees.shift() ?? tree([]));

    const running: Promise<ToolResult> = bench.runAsync(tool, bench.call({ text: "placed", timeoutMilliseconds: 300 }));
    await ToolBench.settleAsync();
    bench.surface.reportChange(ToolBench.VIEW);
    const result: ToolResult = await running;

    expect(result.content[0]?.value).toBe("The wait was met.");
    expect(bench.permissions.requests).toEqual([]);
    expect(bench.methods.filter(t => t === "Accessibility.getFullAXTree").length).toBe(3);
    expect([bench.methods.slice(-3), result.structured]).toEqual([["Page.getFrameTree", "Accessibility.getFullAXTree", "Page.getFrameTree"], { page: { url: "https://shop.test/cart/", title: "" } }]);
  });

  it("matches names only, never values or ignored nodes, and at its limit says the wait wasn't met rather than failing", async () => {
    bench.surface.answerWith("Accessibility.getFullAXTree", () => ({ nodes: [...nodes(["placed"], true), { nodeId: "9", role: { value: "textbox" }, value: { value: "placed" } }] }));

    expect((await bench.runAsync(tool, bench.call({ text: "placed", timeoutMilliseconds: 1 }))).content[0]?.value).toBe("The wait wasn't met in 1 ms.");
  });

  it("checks the page's shown text with the pinned function once the page's whole tree is too large for one reply, and only so when the page reports a change", async () => {
    vi.useFakeTimers(FAKED);
    const shown: boolean[] = [false, true];
    bench.surface.answerWith("Accessibility.getFullAXTree", (params: JsonObject) => {
      if (params["depth"] === undefined)
        throw new WebViewFailureException(new WebViewFailure(WebViewFailureKind.TooLarge));
      return tree([]);
    });
    bench.surface.answerWith("Runtime.callFunctionOn", (params: JsonObject) => ({ result: { type: "boolean",
      value: params["functionDeclaration"] === PageTextScript.functionDeclaration ? shown.shift() ?? false : true } }));

    const running: Promise<ToolResult> = bench.runAsync(tool, bench.call({ text: "placed", timeoutMilliseconds: 300 }));
    await ToolBench.settleAsync();
    bench.surface.reportChange(ToolBench.VIEW);
    const result: ToolResult = await running;

    expect(result.content[0]?.value).toBe("The wait was met.");
    expect(bench.surface.calls.filter(t => t.params["functionDeclaration"] === PageTextScript.functionDeclaration).map(t => t.params["arguments"]))
      .toEqual(Array(2).fill([{ value: "placed" }]));
    expect(bench.surface.calls.filter(t => t.method === "Accessibility.getFullAXTree" && t.params["depth"] === undefined).length).toBe(1);
  });

  it("fails on any other failure reading the whole tree, and checks the page's text no other way", async () => {
    bench.surface.fail("Accessibility.getFullAXTree", new WebViewFailure(WebViewFailureKind.Protocol, -32000, "Engine busy"));

    await CallFailures.expectAsync(bench.runAsync(tool, bench.call({ text: "placed", timeoutMilliseconds: 300 })), ProtocolFailedException);
    expect(bench.surface.calls.filter(t => t.params["functionDeclaration"] === PageTextScript.functionDeclaration)).toEqual([]);
  });

  it("is met once the element has a box, and not while the engine says it has none, reading again only when the page reports a change", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const id: string = bench.sessions.issueReference(ToolBench.SESSION, new SnapshotReference(ToolBench.VIEW, "L1", ShopPage.LINK));
    const replies: (JsonObject | null)[] = [null, { quads: [] }, { quads: [[0, 0, 1, 0, 1, 1, 0, 1]] }];
    bench.surface.answerWith("DOM.getContentQuads", () => {
      const reply: JsonObject | null | undefined = replies.shift();
      if (reply === null)
        throw new WebViewFailureException(new WebViewFailure(WebViewFailureKind.Protocol, -32000, "Could not compute content quads."));
      return reply ?? {};
    });

    const reads = (): number => bench.methods.filter(t => t === "DOM.getContentQuads").length;
    const running: Promise<ToolResult> = bench.runAsync(tool, bench.call({ reference: id, timeoutMilliseconds: 5_000 }));
    await ToolBench.settleAsync();
    const heard: number = reads();
    await vi.advanceTimersByTimeAsync(1_000);
    await ToolBench.settleAsync();
    const unchanged: number = reads();
    bench.surface.reportChange(ToolBench.VIEW);

    expect((await running).content[0]?.value).toBe("The wait was met.");
    expect([heard, unchanged, reads(), bench.methods.filter(t => t === "Runtime.callFunctionOn").length]).toEqual([2, 2, 3, 3]);
  });

  it("reads a page that can't report its changes at once and once more at its limit, never on a timer between", async () => {
    bench.failHearing();
    vi.useFakeTimers(FAKED);
    bench.surface.answerWith("Accessibility.getFullAXTree", () => tree(["Loading"]));

    const result: ToolResult = await waitOutAsync(bench.runAsync(tool, bench.call({ text: "placed", timeoutMilliseconds: 300 })), 300);

    expect([result.content[0]?.value, bench.methods.filter(t => t === "Accessibility.getFullAXTree").length]).toEqual(["The wait wasn't met in 300 ms.", 3]);
  });

  it("reads a heard page that reports no change only as it starts hearing and once more at its limit, then says the wait wasn't met and stops hearing", async () => {
    vi.useFakeTimers(FAKED);
    bench.surface.answerWith("Accessibility.getFullAXTree", () => tree(["Loading"]));

    const result: ToolResult = await waitOutAsync(bench.runAsync(tool, bench.call({ text: "placed", timeoutMilliseconds: 300 })), 300);

    expect(result.content[0]?.value).toBe("The wait wasn't met in 300 ms.");
    expect([bench.methods.filter(t => t === "Accessibility.getFullAXTree").length, bench.methods.filter(t => t === "Runtime.callFunctionOn").length]).toEqual([4, 2]);
  });

  it("is met at its limit by a text the page shows after its last reported change", async () => {
    vi.useFakeTimers(FAKED);
    const trees: JsonObject[] = [tree(["Loading"]), tree(["Loading"])];
    bench.surface.answerWith("Accessibility.getFullAXTree", (params: JsonObject) => params["depth"] === undefined ? trees.shift() ?? tree(["Order placed"]) : tree([]));

    const result: ToolResult = await waitOutAsync(bench.runAsync(tool, bench.call({ text: "placed", timeoutMilliseconds: 300 })), 300);

    expect(result.content[0]?.value).toBe("The wait was met.");
  });

  it("hears the page again in the new document after its main frame navigates, and is met by a text the new document reports", async () => {
    vi.useFakeTimers(FAKED);
    let reads: number = 0;
    bench.surface.answerWith("Accessibility.getFullAXTree", (params: JsonObject) => {
      if (params["depth"] !== undefined)
        return tree([]);
      reads += 1;
      if (reads === 2)
        bench.surface.emitProtocolEvent(ToolBench.VIEW, "Page.frameNavigated", { frame: { id: "F1", url: "https://shop.test/done/" } });
      return tree([reads <= 3 ? "Submit" : "Order confirmed"]);
    });
    const switchedOn = (): number => bench.surface.calls.filter(t => t.method === "Runtime.callFunctionOn" && JSON.stringify(t.params["arguments"]) === '[{"value":true}]').length;

    const running: Promise<ToolResult> = bench.runAsync(tool, bench.call({ text: "confirmed", timeoutMilliseconds: 5_000 }));
    const answers: ToolResult[] = [];
    void running.then(t => answers.push(t));
    await ToolBench.settleAsync();
    await vi.advanceTimersByTimeAsync(500);
    const restarted: [unknown[], number, number] = [bench.surface.calls.filter(t => t.method === "Page.createIsolatedWorld").map(t => t.params["frameId"]), switchedOn(), reads];
    bench.surface.reportChange(ToolBench.VIEW);
    await vi.advanceTimersByTimeAsync(500);

    expect(restarted).toEqual([["F1", "F1"], 2, 3]);
    expect([answers.map(t => t.content[0]?.value), reads]).toEqual([["The wait was met."], 4]);
  });

  it("ends a wait whose hearing the page never answers at the wait's limit, not the call's deadline", async () => {
    vi.useFakeTimers(FAKED);
    bench.surface.hang("Page.createIsolatedWorld");
    bench.surface.answerWith("Accessibility.getFullAXTree", () => tree(["Loading"]));

    const result: ToolResult = await waitOutAsync(bench.runAsync(tool, bench.call({ text: "placed", timeoutMilliseconds: 200 }, new AbortController(), ToolBench.SESSION, 4_000)), 200);

    expect(result.content[0]?.value).toBe("The wait wasn't met in 200 ms.");
  });

  it("reads a page whose world never switches its changes on once more at its limit", async () => {
    vi.useFakeTimers(FAKED);
    bench.surface.answer("Runtime.callFunctionOn", { result: { type: "boolean", value: false } });
    bench.surface.answerWith("Accessibility.getFullAXTree", () => tree(["Loading"]));

    const result: ToolResult = await waitOutAsync(bench.runAsync(tool, bench.call({ text: "placed", timeoutMilliseconds: 300 })), 300);

    expect([result.content[0]?.value, bench.methods.filter(t => t === "Accessibility.getFullAXTree").length]).toEqual(["The wait wasn't met in 300 ms.", 3]);
  });

  it("reads a page whose world the engine refuses as the wait starts hearing once more at its limit, rather than failing", async () => {
    vi.useFakeTimers(FAKED);
    bench.surface.fail("Runtime.callFunctionOn", new WebViewFailure(WebViewFailureKind.Protocol, -32000, "Cannot find context with specified id"));
    const trees: JsonObject[] = [tree(["Loading"])];
    bench.surface.answerWith("Accessibility.getFullAXTree", () => trees.shift() ?? tree(["Order placed"]));

    const result: ToolResult = await waitOutAsync(bench.runAsync(tool, bench.call({ text: "placed", timeoutMilliseconds: 300 })), 300);

    expect([result.content[0]?.value, bench.methods.includes("Runtime.callFunctionOn")]).toEqual(["The wait was met.", true]);
  });

  it("fails at once, rather than waiting out its limit, when the view closes as the wait starts hearing", async () => {
    vi.useFakeTimers(FAKED);
    bench.surface.fail("Page.createIsolatedWorld", new WebViewFailure(WebViewFailureKind.ViewClosed));
    bench.surface.answerWith("Accessibility.getFullAXTree", () => tree(["Loading"]));

    await CallFailures.expectAsync(bench.runAsync(tool, bench.call({ text: "placed", timeoutMilliseconds: 300 })), ViewClosedException,
      { reason: "Unavailable", moduleCode: "browser.viewClosed" });
    expect(bench.methods.filter(t => t === "Accessibility.getFullAXTree").length).toBe(1);
  });

  it("is met by the page's next load", async () => {
    const running: Promise<unknown> = bench.runAsync(tool, bench.call({ load: true, timeoutMilliseconds: 5_000 }));
    await vi.waitFor(() => expect(bench.surface.protocolListenerCount).toBe(1));
    bench.surface.emitProtocolEvent(ToolBench.VIEW, "Page.loadEventFired", {});

    expect(await running).toMatchObject({ content: [{ value: "The wait was met." }] });
    expect(bench.surface.protocolListenerCount).toBe(0);
  });

  it("fails on another failure of the element's boxes, and as malformed on a reply without boxes", async () => {
    const id: string = bench.sessions.issueReference(ToolBench.SESSION, new SnapshotReference(ToolBench.VIEW, "L1", ShopPage.LINK));
    bench.surface.fail("DOM.getContentQuads", new WebViewFailure(WebViewFailureKind.Crashed));
    await CallFailures.expectAsync(bench.runAsync(tool, bench.call({ reference: id, timeoutMilliseconds: 50 })), PageCrashedException, { moduleCode: "browser.pageCrashed" });

    bench.surface.answer("DOM.getContentQuads", {});
    await CallFailures.expectAsync(bench.runAsync(tool, bench.call({ reference: id, timeoutMilliseconds: 50 })), MalformedReplyException, { moduleCode: "browser.malformedReply" });
  });

  it("ends its wait by the call's abort", async () => {
    const controller: AbortController = new AbortController();
    bench.surface.answerWith("Accessibility.getFullAXTree", () => {
      controller.abort("Cancelled");
      return tree([]);
    });

    await CallFailures.expectAsync(bench.runAsync(tool, bench.call({ text: "never", timeoutMilliseconds: 5_000 }, controller)), CallCancelledException, { kind: "Cancelled" });
  });

  it("ends its wait by the call's abort when the abort comes as the page fails to report its changes", async () => {
    const controller: AbortController = new AbortController();
    const child: JsonObject = { frame: { id: "F2", loaderId: "L2", url: "https://shop.test/offers", securityOrigin: "https://shop.test" } };
    bench.surface.answer("Accessibility.getFullAXTree", tree([]));
    bench.surface.answer("Page.getFrameTree", { frameTree: { frame: { id: "F1", loaderId: "L1", url: "https://shop.test/cart/", securityOrigin: "https://shop.test" }, childFrames: [child] } });
    bench.surface.answerWith("Runtime.callFunctionOn", params => {
      if (params["uniqueContextId"] === `${ToolBench.VIEW}.1`)
        throw new WebViewFailureException(new WebViewFailure(WebViewFailureKind.Protocol, -32000, "Cannot find context with specified id"));
      return new Promise<never>(() => undefined);
    });

    const failing: Promise<void> = CallFailures.expectAsync(bench.runAsync(tool, bench.call({ text: "never", timeoutMilliseconds: 5_000 }, controller)), CallCancelledException,
      { kind: "Cancelled" });
    await ToolBench.settleAsync();
    controller.abort("Cancelled");
    await failing;
    expect(bench.surface.calls.filter(t => t.method === "Runtime.callFunctionOn" && JSON.stringify(t.params["arguments"]) === JSON.stringify([{ value: true }]))
      .map(t => t.params["uniqueContextId"])).toEqual([`${ToolBench.VIEW}.1`, `${ToolBench.VIEW}.2`, `${ToolBench.VIEW}.1`]);
  });

  it("ends its wait by the call's abort while it hears the page, rather than saying the wait wasn't met", async () => {
    const controller: AbortController = new AbortController();
    bench.surface.answer("Accessibility.getFullAXTree", tree([]));

    const failing: Promise<void> = CallFailures.expectAsync(bench.runAsync(tool, bench.call({ text: "never", timeoutMilliseconds: 5_000 }, controller)), CallCancelledException,
      { kind: "Cancelled" });
    await ToolBench.settleAsync();
    controller.abort("Cancelled");
    await failing;
    expect(bench.methods.filter(t => t === "Accessibility.getFullAXTree").length).toBe(2);
  });

  it("refuses an input with none or two of a text, a reference and the load", async () => {
    await CallFailures.expectAsync(bench.runAsync(tool, bench.call({ timeoutMilliseconds: 10 })), ExactlyOneArgumentException, { reason: "Refused" });
    await CallFailures.expectAsync(bench.runAsync(tool, bench.call({ text: "a", load: true, timeoutMilliseconds: 10 })), ExactlyOneArgumentException, { reason: "Refused" });
    expect(bench.surface.calls).toEqual([]);
  });
});
