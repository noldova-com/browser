/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";
import { PermissionDecision, PermissionDetailKind, PermissionOption, ToolFailureCode, type ToolResult, ToolRisk, WebViewFailureException } from "@noldova/desktop.runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ArgumentNotOneOfException } from "../../src/exceptions/argument-not-one-of.exception.ts";
import { CallStoppedException } from "../../src/exceptions/call-stopped.exception.ts";
import { HandedOverException } from "../../src/exceptions/handed-over.exception.ts";
import { PageAnswerTimedOutException } from "../../src/exceptions/page-answer-timed-out.exception.ts";
import { PageChangedAfterGrantException } from "../../src/exceptions/page-changed-after-grant.exception.ts";
import { PermissionDeniedException } from "../../src/exceptions/permission-denied.exception.ts";
import { ProtocolFailedException } from "../../src/exceptions/protocol-failed.exception.ts";
import { RiskRoseException } from "../../src/exceptions/risk-rose.exception.ts";
import { UnknownKeyException } from "../../src/exceptions/unknown-key.exception.ts";
import { PressKeyTool } from "../../src/tools/press-key.tool.ts";
import type { JsonObject } from "../../src/types/json-value.ts";
import { CallFailures } from "../fixtures/call-failures.fixture.ts";
import { ShopPage } from "../fixtures/shop-page.fixture.ts";
import { ToolBench } from "../fixtures/tool-bench.fixture.ts";

function focusedTree(backendNodeId: number | null): JsonObject {
  const focused: JsonObject = { name: "focused", value: { type: "booleanOrUndefined", value: true } };
  return { nodes: [
    { nodeId: "1", role: { value: "RootWebArea" }, properties: [focused], childIds: ["2"] },
    { nodeId: "2", role: { value: "textbox" }, properties: backendNodeId === null ? [] : [focused], backendDOMNodeId: backendNodeId ?? 50 }
  ] };
}

describe("PressKeyTool", () => {
  let bench: ToolBench;
  let tool: PressKeyTool;

  function keyEvents(): readonly JsonObject[] {
    return bench.surface.calls.filter(t => t.method === "Input.dispatchKeyEvent").map(t => t.params);
  }

  afterEach(() => {
    bench[Symbol.dispose]();
  });

  beforeEach(() => {
    bench = new ToolBench();
    ShopPage.serve(bench, ShopPage.SEARCH);
    bench.surface.answer("Accessibility.getFullAXTree", focusedTree(ShopPage.SEARCH));
    tool = new PressKeyTool(bench.kit);
  });

  it("presses a key on the focused field as medium risk, with the text it types, and returns the URL after it", async () => {
    const result: ToolResult = await bench.runAsync(tool, bench.call({ key: "a" }));

    expect(bench.permissions.requests[0]).toMatchObject({
      action: "browser.pressKey",
      title: "Press a on shop.test",
      details: [{ label: "Page", value: "https://shop.test/cart/, \"Cart\"" }, { label: "Key", kind: PermissionDetailKind.Text, value: "a" }, { label: "Field", value: "textbox" }],
      risk: ToolRisk.Medium
    });
    expect(keyEvents()).toEqual([
      { type: "keyDown", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 0, text: "a", unmodifiedText: "a" },
      { type: "keyUp", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 0 }
    ]);
    expect(result.structured).toEqual({ page: { url: "https://shop.test/cart/", title: "" } });
    expect(bench.sendingMarks).toBe(1);
  });

  it("names the form an Enter in its field submits, and the fields the form sends", async () => {
    bench.surface.answer("Accessibility.getFullAXTree", focusedTree(ShopPage.COUPON));

    await bench.runAsync(tool, bench.call({ key: "Enter" }));

    expect(bench.permissions.requests[0]).toMatchObject({ title: "Submit a form on shop.test",
      details: [{ label: "Page" }, { label: "Key", value: "Enter" }, { label: "Field", value: "textbox" }, { label: "Sends", value: "coupon" }] });
  });

  it("sends a shortcut with its modifiers and no text", async () => {
    await bench.runAsync(tool, bench.call({ key: "a", modifiers: ["Control", "Shift"] }));

    expect([bench.permissions.requests[0]?.title, bench.permissions.requests[0]?.details[1]?.value]).toEqual(["Press Control+Shift+a on shop.test", "Control+Shift+a"]);
    expect(keyEvents()[0]).toEqual({ type: "rawKeyDown", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 10 });
  });

  it("releases the key it pressed when the person stops the page during the press", async () => {
    bench.surface.answerWith("Input.dispatchKeyEvent", params => {
      if (params["type"] === "keyDown")
        bench.kit.stops.stop("page-1", false);
      return {};
    });

    await CallFailures.expectAsync(bench.runAsync(tool, bench.call({ key: "a" })), CallStoppedException, { reason: "Stopped" });
    expect(keyEvents().map(t => t["type"])).toEqual(["keyDown", "keyUp"]);
  });

  it("releases the key it pressed when the press spends the call's deadline, and ends as timed out", async () => {
    const now: number = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    bench.surface.answerWith("Input.dispatchKeyEvent", params => {
      if (params["type"] === "keyDown")
        clock.mockReturnValue(now + 60_000);
      return {};
    });

    try {
      await CallFailures.expectAsync(bench.runAsync(tool, bench.call({ key: "a" })), PageAnswerTimedOutException, { reason: ToolFailureCode.TimedOut });
    }
    finally {
      clock.mockRestore();
    }
    expect(keyEvents().map(t => t["type"])).toEqual(["keyDown", "keyUp"]);
  });

  it("releases the key it pressed when the press's reply comes after the call's deadline, and ends as timed out", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    bench.surface.answerWith("Input.dispatchKeyEvent", params => params["type"] === "keyDown" ? new Promise<never>(() => undefined) : {});

    try {
      const failing: Promise<void> = CallFailures.expectAsync(bench.runAsync(tool, bench.call({ key: "a" }, new AbortController(), ToolBench.SESSION, 50)), PageAnswerTimedOutException, { reason: ToolFailureCode.TimedOut });
      await ToolBench.settleAsync();
      await vi.advanceTimersByTimeAsync(50);
      await failing;
    }
    finally {
      vi.useRealTimers();
    }
    expect(keyEvents().map(t => t["type"])).toEqual(["keyDown", "keyUp"]);
  });

  it("asks as high risk for any key in a secret field, offering the person to type it themself, except Enter, which submits its form", async () => {
    bench.surface.answer("Accessibility.getFullAXTree", focusedTree(ShopPage.PASSWORD));

    await bench.runAsync(tool, bench.call({ key: "Tab" }));
    await bench.runAsync(tool, bench.call({ key: "Enter" }));

    expect(bench.permissions.requests.map(t => [t.action, t.risk, t.isAsking, t.options, t.labels])).toEqual([
      ["browser.pressKeySecret", ToolRisk.High, true, [PermissionOption.AllowOnce, PermissionOption.TakeOver, PermissionOption.Deny],
        { [PermissionOption.TakeOver]: "I'll type it myself" }],
      ["browser.pressKeySecret", ToolRisk.High, true, [PermissionOption.AllowOnce, PermissionOption.Deny], {}]
    ]);
  });

  it("asks as high risk, with no take-over, for Enter in a field or Space on a submit button of a form that holds a secret field", async () => {
    bench.surface.answer("Accessibility.getFullAXTree", focusedTree(ShopPage.EMAIL));
    await bench.runAsync(tool, bench.call({ key: "Enter" }));
    bench.surface.answer("Accessibility.getFullAXTree", focusedTree(ShopPage.SIGN_IN));
    await bench.runAsync(tool, bench.call({ key: " " }));
    bench.surface.answer("Accessibility.getFullAXTree", focusedTree(ShopPage.FORM_BUTTON));
    await bench.runAsync(tool, bench.call({ key: " " }));

    expect(bench.permissions.requests.map(t => [t.action, t.risk, t.options])).toEqual([
      ["browser.pressKeySecret", ToolRisk.High, [PermissionOption.AllowOnce, PermissionOption.Deny]],
      ["browser.pressKeySecret", ToolRisk.High, [PermissionOption.AllowOnce, PermissionOption.Deny]],
      ["browser.pressKey", ToolRisk.Medium, [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny]]
    ]);
  });

  it("asks for a high-risk key every time, even after the person allowed the tool's medium-risk keys on the site for the chat", async () => {
    bench.surface.answer("Accessibility.getFullAXTree", focusedTree(ShopPage.FORM_BUTTON));
    bench.permissions.automaticDecision = PermissionDecision.AllowedAlways;
    await bench.runAsync(tool, bench.call({ key: " " }));
    bench.permissions.automaticDecision = PermissionDecision.Denied;
    await bench.runAsync(tool, bench.call({ key: " " }));
    bench.surface.answer("Accessibility.getFullAXTree", focusedTree(ShopPage.EMAIL));

    await CallFailures.expectAsync(bench.runAsync(tool, bench.call({ key: "Enter" })), PermissionDeniedException, { reason: "Denied" });
    expect(bench.permissions.requests.map(t => t.action)).toEqual(["browser.pressKey", "browser.pressKeySecret"]);
    expect(keyEvents().map(t => t["type"])).toEqual(["keyDown", "keyUp", "keyDown", "keyUp"]);
  });

  it("hands the page to the person who takes a secret field's key over: it focuses the field again, presses nothing and ends denied as handed over", async () => {
    bench.surface.answer("Accessibility.getFullAXTree", focusedTree(ShopPage.PASSWORD));
    bench.permissions.automaticDecision = null;
    const running: Promise<unknown> = bench.runAsync(tool, bench.call({ key: "Tab" }));
    await bench.permissions.raised;
    bench.surface.answer("Accessibility.getFullAXTree", focusedTree(ShopPage.SEARCH));
    bench.permissions.answerNext(PermissionDecision.TakenOver);

    await CallFailures.expectAsync(running, HandedOverException, { reason: "Denied", message: "The person is doing it themself; the page is theirs, focused on the element." });
    expect([keyEvents(), bench.activities.at(-1)?.["state"], bench.activities.at(-1)?.["isHandedOver"]]).toEqual([[], "Ended", true]);
    expect([bench.surface.calls.filter(t => t.method === "DOM.focus").map(t => t.params), bench.sendingMarks]).toEqual([[{ backendNodeId: ShopPage.PASSWORD }], 0]);
  });

  it("asks as medium risk when nothing has the focus, or the focused element is outside the document", async () => {
    bench.surface.answer("Accessibility.getFullAXTree", focusedTree(null));
    await bench.runAsync(tool, bench.call({ key: "Escape" }));
    bench.surface.answer("Accessibility.getFullAXTree", focusedTree(99));
    await bench.runAsync(tool, bench.call({ key: "Escape" }));

    expect(bench.permissions.requests.map(t => [t.risk, t.details.length])).toEqual([[ToolRisk.Medium, 2], [ToolRisk.Medium, 3]]);
    expect(bench.permissions.requests.map(t => [t.options, t.labels])).toEqual(Array(2).fill([[PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny],
      { [PermissionOption.AllowAlways]: "Allow for this chat" }]));
  });

  it("finds the focused element through the document when the page's whole tree is too large for one reply", async () => {
    bench.surface.answerWith("Accessibility.getFullAXTree", (params: JsonObject) => {
      if (params["depth"] === undefined)
        throw new WebViewFailureException(new WebViewFailure(WebViewFailureKind.TooLarge));
      return { nodes: [{ nodeId: "1", role: { value: "RootWebArea" }, name: { value: "Long" } }] };
    });
    bench.surface.answerWith("DOM.getDocument", (params: JsonObject) => params["depth"] === 0 ? { root: { nodeId: 1, backendNodeId: 1, nodeName: "#document" } } : ShopPage.document());
    bench.surface.answer("DOM.querySelector", { nodeId: 70 });
    bench.surface.answerWith("Accessibility.getPartialAXTree", (params: JsonObject) => params["nodeId"] === 70
      ? focusedTree(ShopPage.SEARCH)
      : { nodes: [{ nodeId: "ax-2", role: { value: "textbox" }, backendDOMNodeId: params["backendNodeId"] ?? 0 }] });
    await bench.runAsync(tool, bench.call({ key: "a" }));
    bench.surface.answer("DOM.querySelector", { nodeId: 0 });
    await bench.runAsync(tool, bench.call({ key: "Escape" }));

    expect(bench.permissions.requests.map(t => [t.risk, t.details.at(-1)])).toEqual([[ToolRisk.Medium, { label: "Field", value: "textbox" }],
      [ToolRisk.Medium, { label: "Key", kind: PermissionDetailKind.Text, value: "Escape" }]]);
    expect(bench.surface.calls.filter(t => t.method === "DOM.querySelector").map(t => t.params)).toContainEqual({ nodeId: 1, selector: ":focus" });
  });

  it("fails on any other failure reading the whole tree, and looks for the focus no other way", async () => {
    bench.surface.fail("Accessibility.getFullAXTree", new WebViewFailure(WebViewFailureKind.Protocol, -32000, "Engine busy"));

    await CallFailures.expectAsync(bench.runAsync(tool, bench.call({ key: "a" })), ProtocolFailedException);
    expect(bench.methods).not.toContain("DOM.querySelector");
  });

  it("presses nothing and fails as stale when the page moves the focus while the person answers", async () => {
    bench.permissions.automaticDecision = null;
    const running: Promise<unknown> = bench.runAsync(tool, bench.call({ key: "Enter" }));
    await bench.permissions.raised;
    bench.surface.answer("Accessibility.getFullAXTree", focusedTree(ShopPage.PASSWORD));
    bench.permissions.answerNext(PermissionDecision.AllowedOnce);

    await CallFailures.expectAsync(running, PageChangedAfterGrantException, { reason: "Stale" });
    expect([keyEvents(), bench.sendingMarks]).toEqual([[], 0]);
  });

  it("presses the key when the focus stayed where it was while the person answered", async () => {
    bench.permissions.automaticDecision = null;
    const running: Promise<unknown> = bench.runAsync(tool, bench.call({ key: "Enter" }));
    await bench.permissions.raised;
    bench.permissions.answerNext(PermissionDecision.AllowedOnce);
    await running;

    expect(keyEvents().map(t => t["type"])).toEqual(["keyDown", "keyUp"]);
  });

  it.each<[string, JsonObject, abstract new (...args: never[]) => Error]>([
    ["a key that is neither named nor one character", { key: "Hello" }, UnknownKeyException],
    ["modifiers that aren't a list", { key: "a", modifiers: "Shift" }, ArgumentNotOneOfException],
    ["a modifier it doesn't know", { key: "a", modifiers: ["Hyper"] }, ArgumentNotOneOfException],
    ["a modifier given twice", { key: "a", modifiers: ["Shift", "Shift"] }, ArgumentNotOneOfException]
  ])("refuses %s before it sends anything", async (_case: string, input: JsonObject, type: abstract new (...args: never[]) => Error) => {
    await CallFailures.expectAsync(bench.runAsync(tool, bench.call(input)), type, { reason: "Refused" });
    expect(bench.surface.calls).toEqual([]);
  });

  it.each<[string, number, string, () => void]>([
    ["the focused field turned into a password field", ShopPage.SEARCH, "a", () => ShopPage.describe(bench, ShopPage.SEARCH)],
    ["the form Enter submits gained a password field", ShopPage.COUPON, "Enter", () => bench.surface.answer("DOM.getDocument", ShopPage.document(true))],
    ["the form Space's button submits gained a password field", ShopPage.FORM_BUTTON, " ", () => bench.surface.answer("DOM.getDocument", ShopPage.document(true))]
  ])("presses nothing and fails as stale when, while the medium-risk card waited, %s", async (_case: string, focused: number, key: string, change: () => void) => {
    bench.surface.answer("Accessibility.getFullAXTree", focusedTree(focused));
    bench.permissions.automaticDecision = null;
    const running: Promise<unknown> = bench.runAsync(tool, bench.call({ key }));
    await bench.permissions.raised;
    change();
    bench.permissions.answerNext(PermissionDecision.AllowedOnce);

    await CallFailures.expectAsync(running, RiskRoseException, { reason: "Stale", message: "The page made this element secret, or gave its form a secret field, after the action was allowed, so it wasn't done; call it again to ask at high risk.", moduleCode: "browser.riskRose" });
    expect([bench.permissions.requests.map(t => t.risk), keyEvents(), bench.sendingMarks]).toEqual([[ToolRisk.Medium], [], 0]);
  });
});
