/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";
import { ToolAbortReason, ToolFailure, ToolFailureCode, WebViewFailureException } from "@noldova/desktop.runtime";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CallCancelledException } from "../../src/exceptions/call-cancelled.exception.ts";
import type { CallFailureException } from "../../src/exceptions/call-failure.exception.ts";
import { CallStoppedException } from "../../src/exceptions/call-stopped.exception.ts";
import { MalformedReplyException } from "../../src/exceptions/malformed-reply.exception.ts";
import { PageAnswerTimedOutException } from "../../src/exceptions/page-answer-timed-out.exception.ts";
import { ProtocolFailedException } from "../../src/exceptions/protocol-failed.exception.ts";
import { ReplyTooLargeException } from "../../src/exceptions/reply-too-large.exception.ts";
import { StaleReferenceException } from "../../src/exceptions/stale-reference.exception.ts";
import { ViewClosedException } from "../../src/exceptions/view-closed.exception.ts";
import { ActionProgress } from "../../src/models/action-progress.ts";
import { CallOptions } from "../../src/models/call-options.ts";
import { ViewCalls } from "../../src/services/view-calls.ts";
import { ScriptedViews } from "../fixtures/scripted-views.fixture.ts";

function options(changes: Partial<CallOptions> = {}): CallOptions {
  return new CallOptions(changes.signal ?? new AbortController().signal, changes.deadline ?? Date.now() + 5_000, changes.maximumReplyBytes ?? 1_000,
    changes.isReferenced ?? false, changes.progress ?? new ActionProgress(() => undefined));
}

async function failureOfAsync(promise: Promise<unknown>): Promise<CallFailureException> {
  return promise.then(() => expect.fail("The call succeeded."), (error: CallFailureException) => error);
}

describe("ViewCalls", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns the reply and passes the time left to the relay", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view"]);
    surface.answer("DOM.describeNode", { node: { nodeName: "A" } });

    const reply: object = await new ViewCalls(surface.relay).sendAsync("view", "DOM.describeNode", { backendNodeId: 7 }, options());

    expect(reply).toEqual({ node: { nodeName: "A" } });
    expect(surface.calls[0]?.params).toEqual({ backendNodeId: 7 });
    expect(surface.calls[0]?.timeoutMilliseconds).toBeGreaterThan(0);
    expect(surface.calls[0]?.timeoutMilliseconds).toBeLessThanOrEqual(5_000);
  });

  it("holds a press on a signal that a later stop or cancel doesn't abort, and starts no press after one", () => {
    const controller: AbortController = new AbortController();
    const holding: CallOptions = ViewCalls.holding(options({ signal: controller.signal }));
    controller.abort(ToolAbortReason.Stopped);

    expect(holding.signal.aborted).toBe(false);
    expect(() => ViewCalls.holding(options({ signal: controller.signal }))).toThrow(CallStoppedException);
  });

  it("gives a release a signal nothing aborts and two seconds of its own, past a spent deadline", () => {
    const controller: AbortController = new AbortController();
    controller.abort(ToolAbortReason.Stopped);
    const now: number = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);

    const releasing: CallOptions = ViewCalls.releasing(options({ signal: controller.signal, deadline: now - 1 }));

    expect([releasing.signal.aborted, releasing.deadline]).toEqual([false, now + 2_000]);
  });

  it("sends a press's release once the press went out, and keeps the press's failure when its reply comes after the deadline", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view"]);
    surface.answerWith("Input.dispatchKeyEvent", params => params["type"] === "keyDown" ? new Promise<never>(() => undefined) : {});
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });

    const pending: Promise<CallFailureException> = failureOfAsync(new ViewCalls(surface.relay).pressAsync("view", "Input.dispatchKeyEvent", { type: "keyDown", key: "a" },
      { type: "keyUp", key: "a" }, options({ deadline: Date.now() + 20 })));
    await vi.advanceTimersByTimeAsync(20);

    const failure: CallFailureException = await pending;

    expect(failure).toBeInstanceOf(PageAnswerTimedOutException);
    expect([failure.reason, surface.calls.map(t => t.params["type"])]).toEqual(["TimedOut", ["keyDown", "keyUp"]]);
  });

  it("keeps a failed press's failure over its release's, and sends no release for a press that never went out", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view"]);
    surface.answerWith("Input.dispatchMouseEvent", params => {
      throw new WebViewFailureException(new WebViewFailure(params["type"] === "mousePressed" ? WebViewFailureKind.ViewClosed : WebViewFailureKind.Crashed));
    });
    const calls: ViewCalls = new ViewCalls(surface.relay);

    const failed: CallFailureException = await failureOfAsync(calls.pressAsync("view", "Input.dispatchMouseEvent", { type: "mousePressed", x: 1, y: 1 },
      { type: "mouseReleased", x: 1, y: 1 }, options()));
    const unsent: CallFailureException = await failureOfAsync(calls.pressAsync("view", "Input.dispatchMouseEvent", { type: "mousePressed", x: 1, y: 1 },
      { type: "mouseReleased", x: 1, y: 1 }, options({ deadline: Date.now() - 1 })));

    expect([failed, unsent]).toEqual([expect.any(ViewClosedException), expect.any(PageAnswerTimedOutException)]);
    expect([failed.moduleCode, unsent.reason, surface.calls.map(t => t.params["type"])]).toEqual(["browser.viewClosed", "TimedOut", ["mousePressed", "mouseReleased"]]);
  });

  it("ends a failed press with its release's failure when that isn't a call's failure, since it is the module's own bug", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view"]);
    const bug: TypeError = new TypeError("The release broke.");
    surface.answerWith("Input.dispatchMouseEvent", params => {
      if (params["type"] === "mousePressed")
        throw new WebViewFailureException(new WebViewFailure(WebViewFailureKind.ViewClosed));
      throw bug;
    });

    await expect(new ViewCalls(surface.relay).pressAsync("view", "Input.dispatchMouseEvent", { type: "mousePressed", x: 1, y: 1 }, { type: "mouseReleased", x: 1, y: 1 },
      options())).rejects.toBe(bug);
  });

  it("ends a press whose release fails with the release's failure", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view"]);
    surface.answerWith("Input.dispatchKeyEvent", params => {
      if (params["type"] === "keyUp")
        throw new WebViewFailureException(new WebViewFailure(WebViewFailureKind.ViewClosed));
      return {};
    });

    const failure: CallFailureException = await failureOfAsync(new ViewCalls(surface.relay).pressAsync("view", "Input.dispatchKeyEvent", { type: "keyDown", key: "a" }, { type: "keyUp", key: "a" }, options()));

    expect(failure).toBeInstanceOf(ViewClosedException);
    expect([failure.moduleCode, surface.calls.map(t => t.params["type"])]).toEqual(["browser.viewClosed", ["keyDown", "keyUp"]]);
  });

  it("refuses a call already aborted, by the base's reason, without sending it", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view"]);
    const controller: AbortController = new AbortController();
    controller.abort(ToolAbortReason.Stopped);

    const failure: CallFailureException = await failureOfAsync(new ViewCalls(surface.relay).sendAsync("view", "Page.enable", {}, options({ signal: controller.signal })));

    expect(failure).toBeInstanceOf(CallStoppedException);
    expect(failure.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Stopped, "The call was stopped."));
    expect(surface.calls).toHaveLength(0);
  });

  it("times out at once when the deadline has passed, without sending", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view"]);

    const failure: CallFailureException = await failureOfAsync(new ViewCalls(surface.relay).sendAsync("view", "Page.enable", {}, options({ deadline: Date.now() - 1 })));

    expect(failure).toBeInstanceOf(PageAnswerTimedOutException);
    expect(failure.reason).toBe("TimedOut");
    expect(surface.calls).toHaveLength(0);
  });

  it("times out when the page doesn't answer by the deadline", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view"]);
    surface.hang("Accessibility.getFullAXTree");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });

    const pending: Promise<CallFailureException> = failureOfAsync(new ViewCalls(surface.relay).sendAsync("view", "Accessibility.getFullAXTree", {},
      options({ deadline: Date.now() + 20 })));
    let isSettled: boolean = false;
    void pending.then(() => {
      isSettled = true;
    });
    await vi.advanceTimersByTimeAsync(19);
    const isSettledBefore: boolean = isSettled;
    await vi.advanceTimersByTimeAsync(1);

    const failure: CallFailureException = await pending;
    expect(isSettledBefore).toBe(false);

    expect(failure).toBeInstanceOf(PageAnswerTimedOutException);
    expect(failure.reason).toBe("TimedOut");
  });

  it("reports a cancel when the host aborts the call while it waits", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view"]);
    surface.hang("Accessibility.getFullAXTree");
    const controller: AbortController = new AbortController();

    const pending: Promise<CallFailureException> = failureOfAsync(new ViewCalls(surface.relay).sendAsync("view", "Accessibility.getFullAXTree", {}, options({ signal: controller.signal })));
    expect(surface.pendingCount).toBe(1);
    controller.abort();

    const failure: CallFailureException = await pending;
    expect(failure).toBeInstanceOf(CallCancelledException);
    expect(failure.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Cancelled, "The call was cancelled."));
  });

  it("maps the relay's failure, by reference or not", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view"]);
    surface.fail("DOM.focus", new WebViewFailure(WebViewFailureKind.Protocol, -32000, "No node with given id found"));
    const calls: ViewCalls = new ViewCalls(surface.relay);

    const referenced: CallFailureException = await failureOfAsync(calls.sendAsync("view", "DOM.focus", { backendNodeId: 1 }, options({ isReferenced: true })));
    const plain: CallFailureException = await failureOfAsync(calls.sendAsync("view", "DOM.focus", { backendNodeId: 1 }, options()));

    expect([referenced, plain]).toEqual([expect.any(StaleReferenceException), expect.any(ProtocolFailedException)]);
    expect([referenced.moduleCode, plain.moduleCode]).toEqual(["browser.staleReference", "browser.protocol"]);
  });

  it("maps a pane that closes while the call waits", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view"]);
    surface.hang("Page.captureScreenshot");

    const pending: Promise<CallFailureException> = failureOfAsync(new ViewCalls(surface.relay).sendAsync("view", "Page.captureScreenshot",
      { format: "png", clip: { x: 0, y: 0, width: 1, height: 1, scale: 1 } }, options()));
    expect(surface.pendingCount).toBe(1);
    surface.close("view");

    const failure: CallFailureException = await pending;
    expect(failure).toBeInstanceOf(ViewClosedException);
    expect(failure.moduleCode).toBe("browser.viewClosed");
  });

  it("reports a cancel when the host aborts the call as it is sent, before its wait starts", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view"]);
    const controller: AbortController = new AbortController();
    surface.answerWith("Accessibility.getFullAXTree", () => {
      controller.abort();
      return new Promise<never>(() => undefined);
    });

    const failure: CallFailureException = await failureOfAsync(new ViewCalls(surface.relay).sendAsync("view", "Accessibility.getFullAXTree", {},
      options({ signal: controller.signal })));

    expect(failure).toBeInstanceOf(CallCancelledException);
  });

  it("passes on a failure that isn't the relay's", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view"]);
    const bug: Error = new Error("bug");
    vi.spyOn(surface.relay, "sendAsync").mockRejectedValue(bug);

    await expect(new ViewCalls(surface.relay).sendAsync("view", "Page.enable", {}, options())).rejects.toBe(bug);
  });

  it("refuses a reply over the size limit", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view"]);
    surface.answer("Accessibility.getFullAXTree", { nodes: "x".repeat(2_000) });

    const failure: CallFailureException = await failureOfAsync(new ViewCalls(surface.relay).sendAsync("view", "Accessibility.getFullAXTree", {}, options()));

    expect(failure).toBeInstanceOf(ReplyTooLargeException);
    expect(failure.reason).toBe("TooLarge");
  });

  it("marks progress only for calls that can run the page's handlers or change the page", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view"]);
    surface.acknowledge(...ScriptedViews.emptyReplies);
    surface.answer("DOM.describeNode", { node: { nodeName: "INPUT" } });
    const calls: ViewCalls = new ViewCalls(surface.relay);
    const reading: ActionProgress = new ActionProgress(() => undefined);
    await calls.sendAsync("view", "DOM.describeNode", { backendNodeId: 1 }, options({ progress: reading }));
    await calls.sendAsync("view", "Page.enable", {}, options({ progress: reading }));

    expect(reading.isInputSent).toBe(false);
    const focusing: ActionProgress = new ActionProgress(() => undefined);
    await calls.sendAsync("view", "DOM.focus", { backendNodeId: 1 }, options({ progress: focusing }));
    const scrolling: ActionProgress = new ActionProgress(() => undefined);
    await calls.sendAsync("view", "DOM.scrollIntoViewIfNeeded", { backendNodeId: 1 }, options({ progress: scrolling }));
    const clicking: ActionProgress = new ActionProgress(() => undefined);
    await calls.sendAsync("view", "Input.dispatchMouseEvent", { type: "mousePressed", x: 1, y: 1 }, options({ progress: clicking }));
    const pressing: ActionProgress = new ActionProgress(() => undefined);
    await calls.sendAsync("view", "Input.dispatchKeyEvent", { type: "keyDown", key: "a" }, options({ progress: pressing }));
    const typing: ActionProgress = new ActionProgress(() => undefined);
    await calls.sendAsync("view", "Input.insertText", { text: "a" }, options({ progress: typing }));

    expect([focusing, scrolling, clicking, pressing, typing].map(t => t.isInputSent)).toEqual([true, true, true, true, true]);
  });

  it("doesn't mark progress when the call never goes out", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view"]);
    const progress: ActionProgress = new ActionProgress(() => undefined);

    await failureOfAsync(new ViewCalls(surface.relay).sendAsync("view", "Input.insertText", { text: "a" }, options({ deadline: Date.now() - 1, progress })));

    expect(progress.isInputSent).toBe(false);
  });

  it("gives the relay at most Noldova Desktop's limit on one call, while the call keeps its own deadline", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view"]);
    surface.acknowledge("Page.enable");

    await new ViewCalls(surface.relay).sendAsync("view", "Page.enable", {}, options({ deadline: Date.now() + 60_000 }));

    expect(surface.calls[0]?.timeoutMilliseconds).toBe(10_000);
  });

  it("refuses a reply that isn't an object as malformed", async () => {
    for (const reply of [null, "text", 1, [{}]]) {
      const surface: ScriptedViews = new ScriptedViews(["view"]);
      surface.answer("DOM.describeNode", reply);

      const failure: CallFailureException = await failureOfAsync(new ViewCalls(surface.relay).sendAsync("view", "DOM.describeNode", { backendNodeId: 7 }, options()));
      expect(failure, String(reply)).toBeInstanceOf(MalformedReplyException);
      expect(failure.moduleCode, String(reply)).toBe("browser.malformedReply");
    }
  });
});
