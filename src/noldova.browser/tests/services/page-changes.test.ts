/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageChangeScript } from "@noldova/browser.protocol";
import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";
import { ToolAbortReason, ToolFailureCode, WebViewFailureException } from "@noldova/desktop.runtime";
import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CallRefusedException } from "../../src/exceptions/call-refused.exception.ts";
import { CallStoppedException } from "../../src/exceptions/call-stopped.exception.ts";
import { MalformedReplyException } from "../../src/exceptions/malformed-reply.exception.ts";
import { PageAnswerTimedOutException } from "../../src/exceptions/page-answer-timed-out.exception.ts";
import { PageChangesContextMissingException } from "../../src/exceptions/page-changes-context-missing.exception.ts";
import { PageChangesNotSwitchedException } from "../../src/exceptions/page-changes-not-switched.exception.ts";
import { ActionProgress } from "../../src/models/action-progress.ts";
import { CallOptions } from "../../src/models/call-options.ts";
import { PageTextScript } from "../../src/models/page-text-script.ts";
import { ConsoleBuffers } from "../../src/services/console-buffers.ts";
import { PageChanges } from "../../src/services/page-changes.ts";
import { RuntimeDomains } from "../../src/services/runtime-domains.ts";
import { ViewCalls } from "../../src/services/view-calls.ts";
import type { JsonObject } from "../../src/types/json-value.ts";
import { writtenTo } from "../fixtures/desktop-fakes.fixture.ts";
import { ScriptedViews } from "../fixtures/scripted-views.fixture.ts";

const TREE: JsonObject = { frameTree: {
  frame: { id: "F1", loaderId: "L1", url: "https://shop.test/", securityOrigin: "https://shop.test" },
  childFrames: [
    { frame: { id: "F2" }, childFrames: [{ frame: { id: "F3" } }] },
    { frame: { id: "F4" } },
    { frame: {}, childFrames: [{ frame: { id: "F5" } }] },
    { childFrames: [{ frame: { id: "F6" } }] },
    "not a frame"
  ]
} };
const ENABLES: readonly string[] = ["Page.enable", "Runtime.disable", "Runtime.enable", "Log.enable", "Runtime.discardConsoleEntries"];
const BINDING: JsonObject = { name: PageChangeScript.bindingName, executionContextName: PageChangeScript.worldName };

describe("PageChanges", () => {
  let surface: ScriptedViews;
  let domains: RuntimeDomains;
  let log: FakeModuleLog;
  let changes: PageChanges;
  let stop: AbortController;
  let options: CallOptions;
  let heard: number;

  beforeEach(() => {
    surface = new ScriptedViews(["view-1"]);
    surface.acknowledge(...ScriptedViews.emptyReplies);
    surface.serveWorlds();
    surface.answer("Page.getFrameTree", TREE);
    domains = new RuntimeDomains(surface.relay, new ConsoleBuffers(surface.relay));
    log = new FakeModuleLog();
    changes = new PageChanges(surface.relay, new ViewCalls(surface.relay), domains, log);
    stop = new AbortController();
    options = new CallOptions(stop.signal, Date.now() + 1_000, 100_000, true, new ActionProgress(() => undefined));
    heard = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function settleAsync(): Promise<void> {
    return new Promise<void>(resolve => setImmediate(resolve));
  }

  function hearAsync(): Promise<() => void> {
    return changes.hearAsync("view-1", options, () => {
      heard += 1;
    });
  }

  function switches(from: number = 0): readonly string[] {
    return surface.calls.filter(t => t.method === "Runtime.callFunctionOn").slice(from)
      .map(t => `${String(t.params["uniqueContextId"])} ${JSON.stringify(t.params["arguments"]) === '[{"value":true}]' ? "on" : "off"}`).sort();
  }

  it("reads whether the main frame shows a text with the pinned function alone, in the same world the page changes use there, by value and silent", async () => {
    const shown: boolean = await changes.hasTextAsync("view-1", "Order placed", options);
    surface.answer("Runtime.callFunctionOn", { result: { type: "boolean", value: false } });
    const hidden: boolean = await changes.hasTextAsync("view-1", "Order placed", options);
    surface.answer("Runtime.callFunctionOn", { result: { type: "boolean", value: true } });
    await hearAsync();

    expect([shown, hidden]).toEqual([true, false]);
    expect(surface.calls.map(t => t.method).slice(0, 8)).toEqual(["Page.getFrameTree", ...ENABLES, "Page.createIsolatedWorld", "Runtime.callFunctionOn"]);
    expect(surface.calls.filter(t => t.method === "Runtime.callFunctionOn").slice(0, 2).map(t => t.params)).toEqual(Array(2).fill({
      functionDeclaration: PageTextScript.functionDeclaration, uniqueContextId: "view-1.1", arguments: [{ value: "Order placed" }], returnByValue: true, silent: true
    }));
    expect(switches(2)[0]).toBe("view-1.1 on");
  });

  it("reads a text check that gives no boolean as malformed, and fails as the hearing does when the frame's world has no context", async () => {
    for (const reply of [{ result: { type: "string", value: "yes" } }, { result: 1 }, {}]) {
      surface.answer("Runtime.callFunctionOn", reply);
      await expect(changes.hasTextAsync("view-1", "Order placed", options)).rejects.toBeInstanceOf(MalformedReplyException);
    }
    surface.answer("Page.createIsolatedWorld", {});

    await expect(changes.hasTextAsync("view-1", "Order placed", options)).rejects.toBeInstanceOf(PageChangesContextMissingException);
  });

  it("starts the view's tracker, adds the binding after it, and starts the function in the world of each frame with an id, the main frame's first", async () => {
    await hearAsync();

    expect(surface.calls.map(t => t.method).filter(t => t !== "Runtime.callFunctionOn" && t !== "Page.createIsolatedWorld"))
      .toEqual(["Page.getFrameTree", ...ENABLES, "Runtime.addBinding"]);
    expect(surface.calls.filter(t => t.method === "Page.createIsolatedWorld").map(t => t.params)).toEqual(["F1", "F2", "F3", "F4"].map(frameId => ({
      frameId, worldName: PageChangeScript.worldName, grantUniveralAccess: false
    })));
    expect(switches()).toEqual(["view-1.1 on", "view-1.2 on", "view-1.3 on", "view-1.4 on"]);
    expect(surface.calls.find(t => t.method === "Runtime.callFunctionOn")?.params).toEqual({
      functionDeclaration: PageChangeScript.functionDeclaration, uniqueContextId: "view-1.1", arguments: [{ value: true }], returnByValue: true, silent: true
    });
  });

  it("calls back on each report of the binding and each navigation of a frame, and on nothing else, until the stop, which stops every frame's function, failed stops included", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const stopHearing: () => void = await hearAsync();
    surface.fail("Runtime.callFunctionOn", new WebViewFailure(WebViewFailureKind.ViewClosed));

    surface.reportChange("view-1");
    surface.emitProtocolEvent("view-1", "Page.frameNavigated", { frame: { id: "F2" } });
    surface.emitProtocolEvent("view-1", "Runtime.bindingCalled", { name: "anotherBinding", payload: "", executionContextId: 1 });
    surface.emitProtocolEvent("view-1", "Runtime.consoleAPICalled", { type: "log", args: [], timestamp: 0 });
    const before: number = heard;
    stop.abort();
    stopHearing();
    surface.reportChange("view-1");
    await settleAsync();

    expect([before, heard]).toEqual([2, 2]);
    expect(switches(4)).toEqual(["view-1.1 off", "view-1.2 off", "view-1.3 off", "view-1.4 off"]);
    expect(surface.calls.at(-1)?.timeoutMilliseconds).toBe(2_000);
    expect(writtenTo(log)).toEqual([]);
  });

  it("logs a stop that fails other than as a call on the view does, and stops the other frames' functions all the same", async () => {
    const stopHearing: () => void = await hearAsync();
    const bug: Error = new Error("The stop broke.");
    surface.answerWith("Runtime.callFunctionOn", params => {
      if (params["uniqueContextId"] === "view-1.2")
        throw bug;
      return { result: { value: false } };
    });

    stopHearing();
    await settleAsync();

    expect(switches(4)).toEqual(["view-1.1 off", "view-1.2 off", "view-1.3 off", "view-1.4 off"]);
    expect(writtenTo(log)).toEqual([`The page changes of view view-1 weren't stopped: ${String(bug)}`]);
  });

  it("adds the binding again when another use restarts the view's tracker while the page is heard, and not once the hearing stopped", async () => {
    const restartAsync = async (): Promise<void> => {
      domains.drop("view-1");
      await domains.startAsync("view-1", "https://shop.test", (method, params) => surface.relay.sendAsync("view-1", method, params, 1_000));
    };
    const bindings = (): readonly JsonObject[] => surface.calls.filter(t => t.method === "Runtime.addBinding").map(t => t.params);
    const stopHearing: () => void = await hearAsync();
    await restartAsync();
    const heardBindings: number = bindings().length;
    stopHearing();
    await restartAsync();

    expect([heardBindings, bindings()]).toEqual([2, [BINDING, BINDING]]);
  });

  it("fails a frame tree without its main frame's id or origin, and calls back on nothing", async () => {
    const trees: readonly JsonObject[] = [{}, { frameTree: {} }, { frameTree: { frame: { id: "F1" } } }, { frameTree: { frame: { securityOrigin: "https://shop.test" } } }];
    for (const tree of trees) {
      surface.answer("Page.getFrameTree", tree);
      const hearing: Promise<() => void> = hearAsync();
      await expect(hearing).rejects.toBeInstanceOf(MalformedReplyException);
      await expect(hearing).rejects.toMatchObject({ reason: ToolFailureCode.Unavailable, moduleCode: "browser.malformedReply" });
    }
    surface.reportChange("view-1");

    expect([surface.calls.filter(t => t.method !== "Page.getFrameTree").length, heard, surface.protocolListenerCount]).toEqual([0, 0, 0]);
  });

  it("drops a tracker whose start failed, adds no binding, and starts it again the next time", async () => {
    surface.fail("Runtime.enable", new WebViewFailure(WebViewFailureKind.TimedOut));
    await expect(hearAsync()).rejects.toBeInstanceOf(PageAnswerTimedOutException);
    surface.answer("Runtime.enable", {});
    await hearAsync();

    expect([surface.calls.filter(t => t.method === "Runtime.disable").length, surface.calls.filter(t => t.method === "Runtime.addBinding").length])
      .toEqual([2, 1]);
  });

  it("fails when the binding is refused, starting no function and calling back on nothing", async () => {
    surface.fail("Runtime.addBinding", new WebViewFailure(WebViewFailureKind.NotAllowed));

    const hearing: Promise<() => void> = hearAsync();
    await expect(hearing).rejects.toBeInstanceOf(CallRefusedException);
    await expect(hearing).rejects.toMatchObject({ reason: ToolFailureCode.Unavailable, moduleCode: "browser.internal" });
    surface.reportChange("view-1");
    expect([switches(), heard]).toEqual([[], 0]);
  });

  it("leaves out a frame whose world fails, and fails as a whole when the main frame's does, stopping the frames that started", async () => {
    surface.answerWith("Page.createIsolatedWorld", (params: JsonObject) => {
      if (params["frameId"] === "F2")
        throw new WebViewFailureException(new WebViewFailure(WebViewFailureKind.Protocol, -32000, "No frame for given id found"));
      const id: number = Number(String(params["frameId"]).slice(1));
      surface.emitProtocolEvent("view-1", "Runtime.executionContextCreated", {
        context: { id, uniqueId: `view-1.${id}`, name: PageChangeScript.worldName, origin: "https://shop.test", auxData: { frameId: params["frameId"] ?? null } }
      });
      return { executionContextId: id };
    });
    await hearAsync();
    const childFailed: readonly string[] = switches();
    surface.answerWith("Runtime.callFunctionOn", (params: JsonObject) => ({ result: { type: "boolean", value: params["uniqueContextId"] !== "view-1.1" } }));
    const mainFailed: unknown = await hearAsync().catch((error: unknown) => error);
    await settleAsync();

    expect(childFailed).toEqual(["view-1.1 on", "view-1.3 on", "view-1.4 on"]);
    expect(mainFailed).toBeInstanceOf(PageChangesNotSwitchedException);
    expect([mainFailed, switches(3)]).toEqual([expect.objectContaining({ viewId: "view-1", frameId: "F1" }), [
      "view-1.1 off", "view-1.1 on", "view-1.3 off", "view-1.3 on", "view-1.4 off", "view-1.4 on"
    ]]);
  });

  it("fails with a bug in a child frame's start, as with any failure that isn't the view's", async () => {
    const bug: TypeError = new TypeError("The start broke.");
    surface.answerWith("Page.createIsolatedWorld", (params: JsonObject) => {
      if (params["frameId"] === "F3")
        throw bug;
      const id: number = Number(String(params["frameId"]).slice(1));
      surface.emitProtocolEvent("view-1", "Runtime.executionContextCreated", {
        context: { id, uniqueId: `view-1.${id}`, name: PageChangeScript.worldName, origin: "https://shop.test", auxData: { frameId: params["frameId"] ?? null } }
      });
      return { executionContextId: id };
    });

    await expect(hearAsync()).rejects.toBe(bug);
    surface.reportChange("view-1");
    expect(heard).toBe(0);
  });

  it("fails a world without its context's id, a function that answers without a result, and a context another world holds", async () => {
    surface.answer("Page.getFrameTree", { frameTree: { frame: { id: "F1", securityOrigin: "https://shop.test" } } });
    surface.answer("Page.createIsolatedWorld", {});
    const noId: unknown = await hearAsync().catch((error: unknown) => error);
    surface.serveWorlds();
    surface.answer("Runtime.callFunctionOn", {});
    const noResult: unknown = await hearAsync().catch((error: unknown) => error);
    surface.answerWith("Page.createIsolatedWorld", () => {
      surface.emitProtocolEvent("view-1", "Runtime.executionContextCreated", {
        context: { id: 9, uniqueId: "view-1.9", name: "the page's own", origin: "https://shop.test", auxData: { frameId: "F1" } }
      });
      return { executionContextId: 9 };
    });
    const another: unknown = await hearAsync().catch((error: unknown) => error);

    expect([noId, noResult, another]).toEqual([expect.any(PageChangesContextMissingException), expect.any(PageChangesNotSwitchedException),
      expect.any(PageChangesContextMissingException)]);
    expect(noId).toMatchObject({ viewId: "view-1", frameId: "F1" });
    expect(switches()).toEqual(["view-1.1 off", "view-1.1 on"]);
  });

  it("ends the wait for a world's context at the call's stop, with the stop's failure, and starts no function", async () => {
    surface.answer("Page.getFrameTree", { frameTree: { frame: { id: "F1", securityOrigin: "https://shop.test" } } });
    surface.answer("Page.createIsolatedWorld", { executionContextId: 41 });
    const waiting: Promise<() => void> = hearAsync();
    await settleAsync();
    stop.abort(ToolAbortReason.Stopped);

    await expect(waiting).rejects.toBeInstanceOf(CallStoppedException);
    expect(switches()).toEqual([]);
  });
});
