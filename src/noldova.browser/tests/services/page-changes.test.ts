/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElementFactsScript, PageChangeScript } from "@noldova/browser.protocol";
import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";
import { ToolAbortReason, ToolFailureCode, WebViewFailureException } from "@noldova/desktop.runtime";
import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CallFailureException } from "../../src/exceptions/call-failure.exception.ts";
import { CallRefusedException } from "../../src/exceptions/call-refused.exception.ts";
import { CallStoppedException } from "../../src/exceptions/call-stopped.exception.ts";
import { MalformedReplyException } from "../../src/exceptions/malformed-reply.exception.ts";
import { PageAnswerTimedOutException } from "../../src/exceptions/page-answer-timed-out.exception.ts";
import { PageChangesContextMissingException } from "../../src/exceptions/page-changes-context-missing.exception.ts";
import { PageChangesNotSwitchedException } from "../../src/exceptions/page-changes-not-switched.exception.ts";
import { ActionProgress } from "../../src/models/action-progress.ts";
import { CallOptions } from "../../src/models/call-options.ts";
import { MarkedSnapshot } from "../../src/models/marked-snapshot.ts";
import { PageSnapshotScript } from "../../src/models/page-snapshot-script.ts";
import { PageTextScript } from "../../src/models/page-text-script.ts";
import { ResolvedElement } from "../../src/models/resolved-element.ts";
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

  function hearAsync(optionsOf: () => CallOptions = () => options): Promise<() => void> {
    return changes.hearAsync("view-1", optionsOf, () => {
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

  it("reads the snapshot with the pinned function in the main frame's world, by value, silent and bound by the tree's limit", async () => {
    const snapshot: JsonObject = { title: "x".repeat(200_000), lines: [], isCut: false, isDeeper: false, isFromView: false };
    surface.snapshot = () => ScriptedViews.byValue(snapshot);

    const read: MarkedSnapshot = await changes.snapshotAsync("view-1", { interactive: true }, [], options);

    expect(read).toStrictEqual(new MarkedSnapshot(snapshot, []));
    expect(surface.calls.filter(t => t.method === "Runtime.callFunctionOn").map(t => t.params)).toEqual([{
      functionDeclaration: PageSnapshotScript.functionDeclaration, uniqueContextId: "view-1.1", arguments: [{ value: { interactive: true } }],
      returnByValue: true, silent: true
    }]);
  });

  it("gives the function the hosts as objects in its world, leaves out one the page removed, and releases them all after", async () => {
    surface.answerWith("DOM.resolveNode", t => {
      if (t["backendNodeId"] === 8)
        throw new WebViewFailureException(new WebViewFailure(WebViewFailureKind.Protocol, -32000, "No node with given id found"));
      return { object: { type: "object", subtype: "node", objectId: `node-${String(t["backendNodeId"])}` } };
    });

    // A snapshot's calls name no reference, so a node the page removed fails as a protocol failure.
    const reading: CallOptions = new CallOptions(stop.signal, Date.now() + 1_000, 100_000, false, new ActionProgress(() => undefined));

    const read: MarkedSnapshot = await changes.snapshotAsync("view-1", { interactive: false }, [7, 8, 9], reading);

    expect(read.hosts).toEqual([7, 9]);
    expect(surface.snapshotObjects).toEqual([["node-7", "node-9"]]);
    expect(surface.snapshotRequests).toEqual([{ interactive: false }]);
    expect(surface.calls.filter(t => t.method === "DOM.resolveNode").map(t => t.params)).toEqual([7, 8, 9].map(t => ({ backendNodeId: t, executionContextId: 1 })));
    expect(surface.calls.filter(t => t.method === "Runtime.releaseObject").map(t => t.params["objectId"])).toEqual(["node-7", "node-9"]);
  });

  it("releases the objects when the function fails, and fails a resolved node without an object's id as malformed, or with any other failure", async () => {
    surface.answer("DOM.resolveNode", { object: { type: "object", objectId: "node-7" } });
    surface.snapshot = () => {
      throw new WebViewFailureException(new WebViewFailure(WebViewFailureKind.Protocol, -32000, "Engine busy"));
    };

    await expect(changes.snapshotAsync("view-1", {}, [7], options)).rejects.toBeInstanceOf(CallFailureException);
    expect(surface.calls.filter(t => t.method === "Runtime.releaseObject").map(t => t.params["objectId"])).toEqual(["node-7"]);

    surface.answer("DOM.resolveNode", { object: { type: "object" } });
    await expect(changes.snapshotAsync("view-1", {}, [7], options)).rejects.toBeInstanceOf(MalformedReplyException);
    surface.answer("DOM.resolveNode", {});
    await expect(changes.snapshotAsync("view-1", {}, [7], options)).rejects.toBeInstanceOf(MalformedReplyException);
    surface.fail("DOM.resolveNode", new WebViewFailure(WebViewFailureKind.ViewClosed));
    await expect(changes.snapshotAsync("view-1", {}, [7], options)).rejects.toBeInstanceOf(CallFailureException);
    expect(surface.snapshotRequests).toEqual([{}]);
  });

  it("reads a snapshot answer that isn't an object as malformed", async () => {
    for (const reply of [ScriptedViews.byValue("yes"), ScriptedViews.byValue(null), { result: 1 }, {}]) {
      surface.snapshot = () => reply;
      await expect(changes.snapshotAsync("view-1", {}, [], options)).rejects.toBeInstanceOf(MalformedReplyException);
    }
  });

  it("finds the element a snapshot gave the index as an object in the main frame's world, or none once it left the page", async () => {
    surface.goneElements.add(4);

    const found: readonly (string | null)[] = [await changes.findSnapshotElementAsync("view-1", 3, options), await changes.findSnapshotElementAsync("view-1", 4, options)];

    expect(found).toEqual(["snapshot-element-3", null]);
    expect(surface.calls.filter(t => t.method === "Runtime.callFunctionOn").map(t => t.params)).toEqual([3, 4].map(t => ({
      functionDeclaration: PageSnapshotScript.functionDeclaration, uniqueContextId: "view-1.1", arguments: [{ value: { element: t } }], returnByValue: false, silent: true
    })));
  });

  it("reads an element answer without an object's id as malformed", async () => {
    for (const reply of [{ result: { type: "object", subtype: "node" } }, { result: { type: "object", subtype: "node", objectId: 3 } }, { result: 1 }, {}]) {
      surface.findElement = () => reply;
      await expect(changes.findSnapshotElementAsync("view-1", 3, options)).rejects.toBeInstanceOf(MalformedReplyException);
    }
  });

  it("resolves the element in the main frame's world, reads its facts by value with its reply bound by the tree's limit, and describes its form's subtree through shadow roots", async () => {
    const facts: JsonObject = { path: null, linked: [], formName: "", title: "x".repeat(200_000), baseUrl: "https://shop.test/" };
    const form: JsonObject = { node: { backendNodeId: 4, nodeName: "FORM", children: [{ backendNodeId: 5, nodeName: "INPUT", attributes: ["type", "password"] }], text: "y".repeat(200_000) } };
    surface.answer("DOM.resolveNode", { object: { type: "object", objectId: "element-5" } });
    surface.answerWith("Runtime.callFunctionOn", (params: JsonObject) => params["returnByValue"] === true
      ? { result: { type: "object", value: facts } }
      : { result: { type: "object", subtype: "node", objectId: "form-4" } });
    surface.answer("DOM.describeNode", form);

    const element: ResolvedElement = await changes.resolveElementAsync("view-1", 5, options);
    const read: readonly JsonObject[] = [await changes.readElementAsync("view-1", element.objectId, options), await changes.readFormAsync("view-1", element.objectId, options) ?? {}];

    expect([element, read]).toEqual([new ResolvedElement("element-5", "L1"), [{ result: { type: "object", value: facts } }, form]]);
    expect(surface.calls.map(t => [t.method, t.params])).toEqual([
      ["Page.getFrameTree", {}],
      ["Page.createIsolatedWorld", { frameId: "F1", worldName: PageChangeScript.worldName, grantUniveralAccess: false }],
      ["DOM.resolveNode", { backendNodeId: 5, executionContextId: 1 }],
      ["Runtime.callFunctionOn", { functionDeclaration: ElementFactsScript.functionDeclaration, objectId: "element-5", arguments: [{ value: false }], returnByValue: true, silent: true }],
      ["Runtime.callFunctionOn", { functionDeclaration: ElementFactsScript.functionDeclaration, objectId: "element-5", arguments: [{ value: true }], returnByValue: false, silent: true }],
      ["DOM.describeNode", { objectId: "form-4", depth: -1, pierce: true }],
      ["Runtime.releaseObject", { objectId: "form-4" }]
    ]);
  });

  it("releases the form's object when its description fails, and when the call that read it was stopped", async () => {
    surface.answer("Runtime.callFunctionOn", { result: { type: "object", subtype: "node", objectId: "form-4" } });
    surface.fail("DOM.describeNode", new WebViewFailure(WebViewFailureKind.TooLarge));
    const failed: unknown = await changes.readFormAsync("view-1", "element-5", options).catch((error: unknown) => error);
    surface.answerWith("DOM.describeNode", () => {
      stop.abort();
      return { node: { backendNodeId: 4, nodeName: "FORM" } };
    });
    await changes.readFormAsync("view-1", "element-5", options).catch(() => undefined);

    expect(failed).toBeInstanceOf(CallFailureException);
    expect(surface.calls.filter(t => t.method === "Runtime.releaseObject").map(t => t.params)).toEqual([{ objectId: "form-4" }, { objectId: "form-4" }]);
  });

  it("logs a release that fails, but not for an object whose document went, or a view that closed, crashed or lost its profile", async () => {
    surface.fail("Runtime.releaseObject", new WebViewFailure(WebViewFailureKind.NotAllowed));
    await changes.releaseAsync("view-1", "element-5", options);
    for (const failure of [new WebViewFailure(WebViewFailureKind.Protocol, -32000, "Could not find object with given id"), new WebViewFailure(WebViewFailureKind.ViewClosed),
      new WebViewFailure(WebViewFailureKind.Crashed), new WebViewFailure(WebViewFailureKind.ProfileCleared)]) {
      surface.fail("Runtime.releaseObject", failure);
      await changes.releaseAsync("view-1", "element-5", options);
    }

    expect(writtenTo(log)).toEqual([expect.stringMatching(/^The view view-1 may keep an element the risk check read: /)]);
  });

  it("passes on a failure releasing an object that isn't a call's, since only a bug makes one", async () => {
    const bug: TypeError = new TypeError("Releasing broke.");
    surface.answerWith("Runtime.releaseObject", () => {
      throw bug;
    });

    await expect(changes.releaseAsync("view-1", "element-5", options)).rejects.toBe(bug);
    expect(writtenTo(log)).toEqual([]);
  });

  it("reads no form for an element in none, and a form answer without an object as malformed", async () => {
    surface.answer("Runtime.callFunctionOn", { result: { type: "object", subtype: "null", value: null } });
    const none: JsonObject | null = await changes.readFormAsync("view-1", "element-5", options);
    for (const result of [{}, { result: "form" }, { result: { type: "object", subtype: "node" } }]) {
      surface.answer("Runtime.callFunctionOn", result);
      await expect(changes.readFormAsync("view-1", "element-5", options)).rejects.toBeInstanceOf(MalformedReplyException);
    }

    expect([none, surface.calls.some(t => t.method === "DOM.describeNode")]).toEqual([null, false]);
  });

  it("fails an element's resolving as the hearing does when the main frame's world has no context, and reads a resolved element without an object as malformed", async () => {
    for (const resolved of [{}, { object: "element-5" }, { object: { type: "object" } }]) {
      surface.answer("DOM.resolveNode", resolved);
      await expect(changes.resolveElementAsync("view-1", 5, options)).rejects.toBeInstanceOf(MalformedReplyException);
    }
    surface.answer("Page.createIsolatedWorld", {});

    await expect(changes.resolveElementAsync("view-1", 5, options)).rejects.toBeInstanceOf(PageChangesContextMissingException);
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

  it("starts the hearing again in a frame that navigated, calls back once more when it has, and stops it with the others", async () => {
    const stopHearing: () => void = await hearAsync();

    surface.emitProtocolEvent("view-1", "Page.frameNavigated", { frame: { id: "F7", parentId: "F1" } });
    await settleAsync();
    const restarted: readonly string[] = switches(4);
    const before: number = heard;
    stopHearing();
    await settleAsync();

    expect([restarted, before]).toEqual([["view-1.5 on"], 2]);
    expect(surface.calls.filter(t => t.method === "Page.createIsolatedWorld").at(-1)?.params["frameId"]).toBe("F7");
    expect(switches(5)).toEqual(["view-1.1 off", "view-1.2 off", "view-1.3 off", "view-1.4 off", "view-1.5 off"]);
  });

  it("stops a function that a navigation started again as the hearing stopped, and calls back no more", async () => {
    const stopHearing: () => void = await hearAsync();
    surface.answerWith("Runtime.callFunctionOn", (params: JsonObject) => {
      if (params["uniqueContextId"] === "view-1.5" && JSON.stringify(params["arguments"]) === '[{"value":true}]')
        stopHearing();
      return { result: { type: "boolean", value: true } };
    });

    surface.emitProtocolEvent("view-1", "Page.frameNavigated", { frame: { id: "F7", parentId: "F1" } });
    await settleAsync();

    expect(heard).toBe(1);
    expect(switches(4)).toEqual(["view-1.1 off", "view-1.2 off", "view-1.3 off", "view-1.4 off", "view-1.5 off", "view-1.5 on"]);
  });

  it("hears a main frame that navigated while the hearing started in its new document, though the old document's start failed", async () => {
    let isOld: boolean = true;
    surface.answerWith("Runtime.callFunctionOn", (params: JsonObject) => {
      if (params["uniqueContextId"] !== "view-1.1" || !isOld)
        return { result: { type: "boolean", value: true } };
      isOld = false;
      surface.emitProtocolEvent("view-1", "Page.frameNavigated", { frame: { id: "F1" } });
      return { result: { type: "boolean", value: false } };
    });

    const stopHearing: () => void = await hearAsync();
    await settleAsync();
    const started: readonly string[] = switches();
    stopHearing();

    expect([heard, started.filter(t => t === "view-1.1 on")]).toEqual([2, ["view-1.1 on", "view-1.1 on", "view-1.1 on"]]);
    expect(writtenTo(log)).toEqual([]);
  });

  it("hears a main frame whose old document's start failed before its navigation came, by starting it once more", async () => {
    let isOld: boolean = true;
    surface.answerWith("Runtime.callFunctionOn", (params: JsonObject) => {
      if (params["uniqueContextId"] !== "view-1.1" || !isOld)
        return { result: { type: "boolean", value: true } };
      isOld = false;
      setImmediate(() => surface.emitProtocolEvent("view-1", "Page.frameNavigated", { frame: { id: "F1" } }));
      return { result: { type: "boolean", value: false } };
    });

    const stopHearing: () => void = await hearAsync();
    await settleAsync();
    await settleAsync();
    const started: readonly string[] = switches();
    stopHearing();

    expect([heard, started.filter(t => t === "view-1.1 on").length]).toEqual([2, 3]);
    expect(writtenTo(log)).toEqual([]);
  });

  it("fails the hearing when the main frame's start fails again once more", async () => {
    surface.answerWith("Runtime.callFunctionOn", (params: JsonObject) => ({ result: { type: "boolean", value: params["uniqueContextId"] !== "view-1.1" } }));

    await expect(hearAsync()).rejects.toBeInstanceOf(PageChangesNotSwitchedException);
    expect(switches().filter(t => t === "view-1.1 on")).toEqual(["view-1.1 on", "view-1.1 on"]);
  });

  it("starts a frame again with fresh options, so a restart late in the hearing has its own time", async () => {
    const given: readonly CallOptions[] = [options, options.withDeadline(Date.now() + 5_000)];
    let asked: number = 0;
    await hearAsync(() => given[Math.min(asked++, 1)] ?? options);

    surface.emitProtocolEvent("view-1", "Page.frameNavigated", { frame: { id: "F7", parentId: "F1" } });
    await settleAsync();

    expect([asked, switches(4)]).toEqual([2, ["view-1.5 on"]]);
    expect(surface.calls.filter(t => t.method === "Page.createIsolatedWorld").at(-1)?.timeoutMilliseconds).toBeGreaterThan(1_000);
  });

  it("ends a start again that still waits for its world when the hearing stops, and keeps the view's tracker", async () => {
    const enables = (): number => surface.calls.filter(t => t.method === "Runtime.enable").length;
    const stopHearing: () => void = await hearAsync();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    surface.answer("Page.createIsolatedWorld", { executionContextId: 41 });
    surface.emitProtocolEvent("view-1", "Page.frameNavigated", { frame: { id: "F7", parentId: "F1" } });
    await settleAsync();

    stopHearing();
    await settleAsync();
    vi.advanceTimersByTime(2_000);
    await settleAsync();
    const before: number = enables();
    await domains.startAsync("view-1", "https://shop.test", (method, params) => surface.relay.sendAsync("view-1", method, params, 1_000));

    expect([enables(), before, heard]).toEqual([1, 1, 1]);
    expect(writtenTo(log)).toEqual([]);
  });

  it("logs a start again that fails with a bug, and not one that fails as the view does, and starts none for a navigation without a frame or its id", async () => {
    await hearAsync();
    const bug: Error = new Error("The world broke.");
    surface.answerWith("Page.createIsolatedWorld", () => {
      throw bug;
    });
    surface.emitProtocolEvent("view-1", "Page.frameNavigated", { frame: { id: "F7" } });
    await settleAsync();
    surface.fail("Page.createIsolatedWorld", new WebViewFailure(WebViewFailureKind.ViewClosed));
    surface.emitProtocolEvent("view-1", "Page.frameNavigated", { frame: { id: "F8" } });
    surface.emitProtocolEvent("view-1", "Page.frameNavigated", { frame: {} });
    surface.emitProtocolEvent("view-1", "Page.frameNavigated", {});
    await settleAsync();

    expect([heard, surface.calls.filter(t => t.method === "Page.createIsolatedWorld").map(t => t.params["frameId"]).slice(4)]).toEqual([4, ["F7", "F8"]]);
    expect(writtenTo(log)).toEqual([`The page changes of view view-1 weren't started again after a navigation: ${String(bug)}`]);
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
      "view-1.1 off", "view-1.1 off", "view-1.1 on", "view-1.1 on", "view-1.3 off", "view-1.3 on", "view-1.4 off", "view-1.4 on"
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
    expect(switches()).toEqual(["view-1.1 off", "view-1.1 off", "view-1.1 on", "view-1.1 on"]);
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
