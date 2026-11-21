/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";
import { PermissionDecision, PermissionDetailKind, PermissionOption, ToolFailure, ToolFailureCode, type ToolResult, ToolRisk } from "@noldova/desktop.runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ArgumentNotFlagException } from "../../src/exceptions/argument-not-flag.exception.ts";
import { ArgumentTooLongException } from "../../src/exceptions/argument-too-long.exception.ts";
import { CallStoppedException } from "../../src/exceptions/call-stopped.exception.ts";
import { HandedOverException } from "../../src/exceptions/handed-over.exception.ts";
import { NotSubmittedException } from "../../src/exceptions/not-submitted.exception.ts";
import { PageAnswerTimedOutException } from "../../src/exceptions/page-answer-timed-out.exception.ts";
import { PageChangedAfterGrantException } from "../../src/exceptions/page-changed-after-grant.exception.ts";
import { PermissionDeniedException } from "../../src/exceptions/permission-denied.exception.ts";
import { RiskRoseException } from "../../src/exceptions/risk-rose.exception.ts";
import { ActionProgress } from "../../src/models/action-progress.ts";
import { FieldSelectScript } from "../../src/models/field-select-script.ts";
import { SnapshotReference } from "../../src/models/snapshot-reference.ts";
import { ToolFailures } from "../../src/services/tool-failures.ts";
import { TypeTool } from "../../src/tools/type.tool.ts";
import type { JsonObject } from "../../src/types/json-value.ts";
import { CallFailures } from "../fixtures/call-failures.fixture.ts";
import { ShopPage } from "../fixtures/shop-page.fixture.ts";
import { ToolBench } from "../fixtures/tool-bench.fixture.ts";

describe("TypeTool", () => {
  let bench: ToolBench;
  let tool: TypeTool;

  function reference(backendNodeId: number): string {
    return bench.sessions.issueReference(ToolBench.SESSION, new SnapshotReference(ToolBench.VIEW, "L1", backendNodeId));
  }

  function sent(method: string): readonly JsonObject[] {
    return bench.surface.calls.filter(t => t.method === method).map(t => t.params);
  }

  afterEach(() => {
    vi.useRealTimers();
    bench[Symbol.dispose]();
  });

  beforeEach(() => {
    bench = new ToolBench();
    ShopPage.serve(bench, ShopPage.SEARCH);
    tool = new TypeTool(bench.kit);
  });

  it("types into a search field as medium risk: it focuses the field, selects what it holds, inserts the text in its place, and returns the URL after it", async () => {
    bench.failHearing();
    const result: ToolResult = await bench.runAsync(tool, bench.call({ reference: reference(ShopPage.SEARCH), text: "red shoes" }));

    expect(bench.permissions.requests).toEqual([{
      action: "browser.type",
      subject: ShopPage.ORIGIN,
      title: "Type into the Search field on shop.test",
      details: [
        { label: "Page", kind: PermissionDetailKind.Text, value: "https://shop.test/cart/, \"Cart\"" },
        { label: "Field", kind: PermissionDetailKind.Text, value: "\"Search\", searchbox" },
        { label: "Text", kind: PermissionDetailKind.AgentText, value: "red shoes" }
      ],
      risk: ToolRisk.Medium,
      isAsking: true,
      options: [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny],
      labels: { [PermissionOption.AllowAlways]: "Allow for this chat" }
    }]);
    expect(bench.methods.slice(17, 33)).toEqual(["Accessibility.getPartialAXTree", "DOM.getContentQuads", "Page.getFrameTree", "DOM.focus", "Page.getFrameTree", "Page.createIsolatedWorld", "DOM.resolveNode", "Runtime.callFunctionOn", "Page.getFrameTree", "Runtime.releaseObject",
      "Page.getFrameTree", "Page.createIsolatedWorld", "DOM.resolveNode", "Runtime.callFunctionOn", "Runtime.releaseObject", "Input.insertText"]);
    expect(sent("Runtime.callFunctionOn").filter(t => t["functionDeclaration"] === FieldSelectScript.functionDeclaration))
      .toEqual([{ functionDeclaration: FieldSelectScript.functionDeclaration, objectId: `node-${String(ShopPage.SEARCH)}`, returnByValue: true, silent: true }]);
    expect(sent("Runtime.releaseObject").at(-1)).toEqual({ objectId: `node-${String(ShopPage.SEARCH)}` });
    expect([sent("DOM.focus"), sent("Input.insertText"), sent("Input.dispatchKeyEvent")]).toEqual([[{ backendNodeId: ShopPage.SEARCH }], [{ text: "red shoes" }], []]);
    expect(result.content[0]?.value).toBe("Typed.");
    expect(result.structured).toEqual({ page: { url: "https://shop.test/cart/", title: "Cart" }, element: { role: "searchbox", name: "Search", isSecret: false } });
    expect(bench.sendingMarks).toBe(1);
  });

  it("marks a secret field as one for the app, and never gives it the typed text", async () => {
    const result: ToolResult = await bench.runAsync(tool, bench.call({ reference: reference(ShopPage.PASSWORD), text: "4321" }));

    expect(result.structured).toEqual({ page: { url: "https://shop.test/cart/", title: "Cart" }, element: { role: "textbox", name: "PIN", isSecret: true } });
    expect(JSON.stringify(result.toJson())).not.toContain("4321");
  });

  it("asks as high risk for a secret field, says only how long the text is, and offers to allow it once, type it themself or deny it", async () => {
    await bench.runAsync(tool, bench.call({ reference: reference(ShopPage.PASSWORD), text: "4321" }));

    expect(bench.permissions.requests[0]).toMatchObject({
      action: "browser.typeSecret",
      title: "Type into the PIN field on shop.test",
      risk: ToolRisk.High,
      isAsking: true,
      options: [PermissionOption.AllowOnce, PermissionOption.TakeOver, PermissionOption.Deny],
      labels: { [PermissionOption.TakeOver]: "I'll type it myself" },
      details: [{ label: "Page" }, { label: "Field", value: "\"PIN\", textbox" }, { label: "Text", kind: PermissionDetailKind.Text, value: "4 characters, hidden" }]
    });
    expect(JSON.stringify(bench.permissions.requests)).not.toContain("4321");
  });

  it("offers only allow once or deny for a secret field it also submits, since the person's own typing wouldn't submit the form", async () => {
    await bench.runAsync(tool, bench.call({ reference: reference(ShopPage.PASSWORD), text: "4321", submit: true }));

    expect(bench.permissions.requests[0]).toMatchObject({ action: "browser.typeSecret", risk: ToolRisk.High, options: [PermissionOption.AllowOnce, PermissionOption.Deny],
      labels: {} });
  });

  it("asks as high risk, with no take-over, to submit any field of a form that holds a secret field, and as medium risk to type into it alone", async () => {
    await bench.runAsync(tool, bench.call({ reference: reference(ShopPage.EMAIL), text: "kim@shop.test", submit: true }));
    await bench.runAsync(tool, bench.call({ reference: reference(ShopPage.EMAIL), text: "kim@shop.test" }));

    expect(bench.permissions.requests.map(t => [t.action, t.risk, t.options, t.labels])).toEqual([
      ["browser.typeSecret", ToolRisk.High, [PermissionOption.AllowOnce, PermissionOption.Deny], {}],
      ["browser.type", ToolRisk.Medium, [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny], { [PermissionOption.AllowAlways]: "Allow for this chat" }]
    ]);
  });

  it("asks for high-risk typing every time, even after the person allowed the tool's medium-risk typing on the site for the chat", async () => {
    bench.permissions.automaticDecision = PermissionDecision.AllowedAlways;
    await bench.runAsync(tool, bench.call({ reference: reference(99), text: "red shoes" }));
    bench.permissions.automaticDecision = PermissionDecision.Denied;
    await bench.runAsync(tool, bench.call({ reference: reference(99), text: "blue shoes" }));

    await CallFailures.expectAsync(bench.runAsync(tool, bench.call({ reference: reference(ShopPage.EMAIL), text: "kim@shop.test", submit: true })), PermissionDeniedException, { reason: "Denied" });
    expect(bench.permissions.requests.map(t => [t.action, t.risk])).toEqual([["browser.type", ToolRisk.Medium], ["browser.typeSecret", ToolRisk.High]]);
    expect(sent("Input.insertText")).toEqual([{ text: "red shoes" }, { text: "blue shoes" }]);
  });

  it("hands the page to the person who takes the typing over: it focuses the field, types nothing, and ends denied as handed over", async () => {
    bench.permissions.automaticDecision = PermissionDecision.TakenOver;

    await CallFailures.expectAsync(bench.runAsync(tool, bench.call({ reference: reference(ShopPage.PASSWORD), text: "4321" })), HandedOverException, { reason: "Denied", message: "The person is doing it themself; the page is theirs, focused on the element." });

    expect([sent("DOM.focus"), sent("Input.insertText"), sent("Input.dispatchKeyEvent")]).toEqual([[{ backendNodeId: ShopPage.PASSWORD }], [], []]);
    expect(bench.activities.at(-1)).toMatchObject({ state: "Ended", isHandedOver: true });
    expect([bench.sendingMarks, bench.permissions.requests.length]).toEqual([0, 1]);
  });

  it("moves the ring with the field while its card waits, and reads nothing once the person takes the typing over and the page is handed to them", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    bench.permissions.automaticDecision = null;
    bench.surface.answer("DOM.getNodeForLocation", { backendNodeId: ShopPage.PASSWORD, frameId: "F1" });
    const typing: Promise<ToolResult> = bench.runAsync(tool, bench.call({ reference: reference(ShopPage.PASSWORD), text: "4321" }));
    await bench.permissions.raised;
    await ToolBench.settleAsync();
    bench.surface.answer("DOM.getContentQuads", { quads: [[10, 210, 30, 210, 30, 220, 10, 220]] });
    bench.surface.reportChange(ToolBench.VIEW);
    await vi.advanceTimersByTimeAsync(100);
    await ToolBench.settleAsync();
    bench.permissions.answerNext(PermissionDecision.TakenOver);
    await CallFailures.expectAsync(typing, HandedOverException, { reason: "Denied", message: "The person is doing it themself; the page is theirs, focused on the element." });
    const reads: number = bench.surface.calls.length;
    bench.surface.reportChange(ToolBench.VIEW);
    await ToolBench.settleAsync();

    expect(bench.activities.filter(t => t["state"] === "Asking").map(t => t["box"])).toEqual([{ x: 10, y: 10, width: 20, height: 10 }, { x: 10, y: 210, width: 20, height: 10 }]);
    expect([sent("DOM.focus"), sent("Input.insertText"), bench.surface.calls.length]).toEqual([[{ backendNodeId: ShopPage.PASSWORD }], [], reads]);
    expect(bench.activities.at(-1)).toMatchObject({ state: "Ended", isHandedOver: true });
  });

  it("still hands the page over and ends denied as handed over when the field can't take the focus", async () => {
    bench.permissions.automaticDecision = PermissionDecision.TakenOver;
    bench.surface.fail("DOM.focus", new WebViewFailure(WebViewFailureKind.Protocol, -32000, "No node with given id found"));

    await CallFailures.expectAsync(bench.runAsync(tool, bench.call({ reference: reference(ShopPage.PASSWORD), text: "4321" })), HandedOverException, { reason: "Denied", message: "The person is doing it themself; the page is theirs, focused on the element." });

    expect([sent("Input.insertText"), bench.activities.at(-1)?.["isHandedOver"]]).toEqual([[], true]);
  });

  it("rings the field while it waits for the person's answer, then acts, and rests with no mark", async () => {
    await bench.runAsync(tool, bench.call({ reference: reference(ShopPage.PASSWORD), text: "4321" }));

    const box: JsonObject = { x: 10, y: 10, width: 20, height: 10 };
    expect(bench.activities.map(t => [t["action"], t["state"], t["box"], t["point"]])).toEqual([
      ["Typing", "Acting", null, null],
      ["Typing", "Acting", box, null],
      ["Typing", "Asking", box, null],
      ["Typing", "Acting", box, null],
      ["Typing", "Idle", null, null]
    ]);
  });

  it("keeps a GET form's typed value and a fragment's token out of the structured fields, which give the page's origin and path", async () => {
    bench.failHearing();
    let reads: number = 0;
    const search: JsonObject = { frameTree: { frame: { id: "F1", loaderId: "L1", url: "https://buyer:pin@shop.test/search?q=red+shoes#token=abc", securityOrigin: ShopPage.ORIGIN } } };
    bench.surface.answerWith("Page.getFrameTree", () => ++reads < 3 ? ShopPage.frame() : search);

    const result: ToolResult = await bench.runAsync(tool, bench.call({ reference: reference(ShopPage.SEARCH), text: "red shoes", submit: true }));

    expect(result.structured).toEqual({ page: { url: "https://shop.test/search", title: "Cart" }, element: { role: "searchbox", name: "Search", isSecret: false } });
    expect(JSON.stringify(result.structured)).not.toMatch(/red|abc|buyer|pin/u);
  });

  it("marks a field the document doesn't hold, such as one in a cross-origin frame, as one that may hold a secret", async () => {
    const result: ToolResult = await bench.runAsync(tool, bench.call({ reference: reference(99), text: "red shoes" }));

    expect(result.structured).toEqual({ page: { url: "https://shop.test/cart/", title: "Cart" }, element: { role: "generic", name: "", isSecret: true } });
  });

  it("clears the field for an empty text: it selects what the field holds and presses Delete, inserting nothing", async () => {
    await bench.runAsync(tool, bench.call({ reference: reference(ShopPage.SEARCH), text: "" }));

    const pressed: number = bench.methods.indexOf("Input.dispatchKeyEvent");
    expect([bench.methods.slice(pressed - 2, pressed + 2), sent("Input.insertText"), sent("Input.dispatchKeyEvent").map(t => [t["type"], t["key"], t["windowsVirtualKeyCode"]])]).toEqual([
      ["Runtime.callFunctionOn", "Runtime.releaseObject", "Input.dispatchKeyEvent", "Input.dispatchKeyEvent"], [], [["keyDown", "Delete", 46], ["keyUp", "Delete", 46]]
    ]);
  });

  it("inserts the text at the caret, and deletes nothing for an empty text, when the element isn't a field it can select in", async () => {
    ShopPage.treatAsNoField(bench);

    await bench.runAsync(tool, bench.call({ reference: reference(ShopPage.SEARCH), text: "red" }));
    await bench.runAsync(tool, bench.call({ reference: reference(ShopPage.SEARCH), text: "" }));

    expect([sent("Input.insertText"), sent("Input.dispatchKeyEvent")]).toEqual([[{ text: "red" }], []]);
  });

  it("types into a field with no box on the page, with no ring", async () => {
    bench.surface.answer("DOM.getContentQuads", { quads: [] });

    await bench.runAsync(tool, bench.call({ reference: reference(ShopPage.SEARCH), text: "red shoes" }));

    expect([bench.activities.map(t => t["box"]), sent("Input.insertText")]).toEqual([[null, null, null, null], [{ text: "red shoes" }]]);
  });

  it("names the form its Enter submits, and the fields the form sends", async () => {
    await bench.runAsync(tool, bench.call({ reference: reference(ShopPage.COUPON), text: "SAVE10", submit: true }));

    expect(bench.permissions.requests[0]).toMatchObject({ title: "Submit a form on shop.test", details: [{ label: "Page" }, { label: "Field", value: "\"Coupon\", textbox" },
      { label: "Text", value: "SAVE10" }, { label: "Then" }, { label: "Sends", value: "coupon" }] });
  });

  it("submits with Enter after the text when asked, and says so in the request", async () => {
    await bench.runAsync(tool, bench.call({ reference: reference(ShopPage.SEARCH), text: "red", submit: true }));

    expect(bench.permissions.requests[0]?.details.slice(3)).toEqual([{ label: "Then", kind: PermissionDetailKind.Text, value: "Press Enter to submit" }]);
    expect(sent("Input.dispatchKeyEvent").map(t => [t["type"], t["key"]])).toEqual([["keyDown", "Enter"], ["keyUp", "Enter"]]);
  });

  it("releases Enter when the person stops the page during the submit", async () => {
    bench.surface.answerWith("Input.dispatchKeyEvent", params => {
      if (params["type"] === "keyDown")
        bench.kit.stops.stop("page-1", false);
      return {};
    });

    await CallFailures.expectAsync(bench.runAsync(tool, bench.call({ reference: reference(ShopPage.SEARCH), text: "red", submit: true })), CallStoppedException, { reason: "Stopped" });
    expect(bench.surface.calls.filter(t => t.method === "Input.dispatchKeyEvent").map(t => t.params["type"])).toEqual(["keyDown", "keyUp"]);
  });

  it("releases Enter when its press spends the call's deadline, and ends as timed out", async () => {
    const now: number = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    bench.surface.answerWith("Input.dispatchKeyEvent", params => {
      if (params["type"] === "keyDown")
        clock.mockReturnValue(now + 60_000);
      return {};
    });

    try {
      await CallFailures.expectAsync(bench.runAsync(tool, bench.call({ reference: reference(ShopPage.SEARCH), text: "red", submit: true })), PageAnswerTimedOutException, { reason: ToolFailureCode.TimedOut });
    }
    finally {
      clock.mockRestore();
    }
    expect(sent("Input.dispatchKeyEvent").map(t => t["type"])).toEqual(["keyDown", "keyUp"]);
  });

  it("releases Enter when its press's reply comes after the call's deadline, and ends as timed out", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    bench.surface.answerWith("Input.dispatchKeyEvent", params => params["type"] === "keyDown" ? new Promise<never>(() => undefined) : {});

    try {
      const failing: Promise<void> = CallFailures.expectAsync(bench.runAsync(tool, bench.call({ reference: reference(ShopPage.SEARCH), text: "red", submit: true }, new AbortController(), ToolBench.SESSION, 50)), PageAnswerTimedOutException, { reason: ToolFailureCode.TimedOut });
      await ToolBench.settleAsync();
      await vi.advanceTimersByTimeAsync(50);
      await failing;
    }
    finally {
      vi.useRealTimers();
    }
    expect(sent("Input.dispatchKeyEvent").map(t => t["type"])).toEqual(["keyDown", "keyUp"]);
  });

  it("refuses a text over its limit, or a submit that isn't a flag, before it sends anything", async () => {
    await CallFailures.expectAsync(bench.runAsync(tool, bench.call({ reference: "e1", text: "x".repeat(10_001) })), ArgumentTooLongException, { reason: "Refused" });
    await CallFailures.expectAsync(bench.runAsync(tool, bench.call({ reference: "e1", text: "x", submit: "yes" })), ArgumentNotFlagException, { reason: "Refused", message: "The argument \"submit\" must be true or false." });
    expect(bench.surface.calls).toEqual([]);
  });

  it.each<[string, number, boolean, () => void]>([
    ["the field turned into a password field", ShopPage.SEARCH, false, () => ShopPage.describe(bench, ShopPage.SEARCH)],
    ["the form it submits gained a password field", ShopPage.COUPON, true, () => ShopPage.showDocument(bench, ShopPage.document(true))]
  ])("types nothing and fails as stale when, while the medium-risk card waited, %s", async (_case: string, field: number, submit: boolean, change: () => void) => {
    bench.permissions.automaticDecision = null;
    const running: Promise<unknown> = bench.runAsync(tool, bench.call({ reference: reference(field), text: "SAVE10", submit }));
    await bench.permissions.raised;
    change();
    bench.permissions.answerNext(PermissionDecision.AllowedOnce);

    await CallFailures.expectAsync(running, RiskRoseException, { reason: "Stale", message: "The page made this element secret, or gave its form a secret field, after the action was allowed, so it wasn't done; call it again to ask at high risk.", moduleCode: "browser.riskRose" });
    expect([bench.permissions.requests.map(t => t.risk), sent("DOM.focus").length, sent("Input.insertText"), sent("Input.dispatchKeyEvent")]).toEqual([[ToolRisk.Medium], 1, [], []]);
  });

  it.each<[string, readonly string[]]>([
    ["a password field", ["type", "password"]],
    ["a one-time code's autocomplete hint", ["type", "text", "autocomplete", "one-time-code"]],
    ["a card number's autocomplete hint", ["type", "text", "autocomplete", "cc-number"]]
  ])("types nothing when the field's focus handler turns it into %s, since the risk is read again after the focus", async (_case: string, attributes: readonly string[]) => {
    bench.surface.answerWith("DOM.focus", () => {
      ShopPage.describe(bench, ShopPage.SEARCH, attributes);
      return {};
    });

    await CallFailures.expectAsync(bench.runAsync(tool, bench.call({ reference: reference(ShopPage.SEARCH), text: "1234" })), RiskRoseException, { reason: "Stale", moduleCode: "browser.riskRose" });
    expect([sent("Input.insertText"), bench.permissions.requests.map(t => t.risk)]).toEqual([[], [ToolRisk.Medium]]);
  });

  it("types the text but sends no Enter, and says it wasn't submitted, when the typing gives the form a secret field", async () => {
    bench.surface.answerWith("Input.insertText", () => {
      ShopPage.showDocument(bench, ShopPage.document(true));
      return {};
    });

    await CallFailures.expectAsync(bench.runAsync(tool, bench.call({ reference: reference(ShopPage.COUPON), text: "SAVE10", submit: true })), NotSubmittedException, { reason: "Stale", message: "The text was typed, but the page gave its form a secret field, so it wasn't submitted; call it again with submit to ask at high risk.", moduleCode: "browser.notSubmitted" });
    expect([sent("Input.insertText"), sent("Input.dispatchKeyEvent")]).toEqual([[{ text: "SAVE10" }], []]);
  });

  it("types into a secret field whose risk fell while its high-risk card waited, at the risk the person allowed", async () => {
    bench.permissions.automaticDecision = null;
    const running: Promise<unknown> = bench.runAsync(tool, bench.call({ reference: reference(ShopPage.PASSWORD), text: "1234" }));
    await bench.permissions.raised;
    ShopPage.describe(bench, ShopPage.PASSWORD, ["type", "text"]);
    bench.permissions.answerNext(PermissionDecision.AllowedOnce);
    await running;

    expect([bench.permissions.requests.map(t => t.risk), sent("Input.insertText")]).toEqual([[ToolRisk.High], [{ text: "1234" }]]);
  });

  it("types nothing and fails as stale when the page removed the field while the card waited", async () => {
    bench.permissions.automaticDecision = null;
    const running: Promise<unknown> = bench.runAsync(tool, bench.call({ reference: reference(ShopPage.SEARCH), text: "red" }));
    await bench.permissions.raised;
    ShopPage.showDocument(bench, { root: { backendNodeId: 1, nodeName: "#document", baseURL: "https://shop.test/cart/", children: [] } });
    bench.permissions.answerNext(PermissionDecision.AllowedOnce);

    await CallFailures.expectAsync(running, PageChangedAfterGrantException, { reason: "Stale", message: "The page changed after the action was allowed, so nothing ran; take a new snapshot." });
    expect(sent("Input.insertText")).toEqual([]);
  });

  it.each<[string, () => void]>([
    ["the old field stays in the engine, out of the document", () => ShopPage.showDocument(bench, { root: { backendNodeId: 1, nodeName: "#document", baseURL: "https://shop.test/cart/", children: [] } })],
    ["the engine no longer knows the old field", () => bench.surface.fail("DOM.resolveNode", new WebViewFailure(WebViewFailureKind.Protocol, -32000, "No node with given id found"))]
  ])("types nothing and fails as a changed page, not an uncertain outcome, when the field's focus handler replaces it and %s", async (_case: string, replace: () => void) => {
    bench.checkAs(tool.descriptor);
    bench.surface.answerWith("DOM.focus", () => {
      replace();
      return {};
    });
    const progress: ActionProgress = new ActionProgress(() => undefined);

    const failure: ToolFailure | null = await tool.callAsync(bench.call({ reference: reference(ShopPage.SEARCH), text: "red" }), progress)
      .then(() => null, (error: unknown) => ToolFailures.forCall(error, progress, tool.descriptor.isResumable !== true));

    expect([failure, sent("DOM.focus").length, sent("Input.insertText")])
      .toEqual([new ToolFailure(ToolFailureCode.Stale, "The page changed after the action was allowed, so nothing ran; take a new snapshot."), 1, []]);
  });
});
