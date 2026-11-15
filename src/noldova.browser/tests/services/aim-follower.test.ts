/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageAction, PageBox, PageChangeScript } from "@noldova/browser.protocol";
import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";
import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ActionProgress } from "../../src/models/action-progress.ts";
import { CallOptions } from "../../src/models/call-options.ts";
import { ElementReference } from "../../src/models/element-reference.ts";
import { PageActivity } from "../../src/models/page-activity.ts";
import { SessionPage } from "../../src/models/session-page.ts";
import { AimFollower } from "../../src/services/aim-follower.ts";
import { ConsoleBuffers } from "../../src/services/console-buffers.ts";
import { PageChanges } from "../../src/services/page-changes.ts";
import { RuntimeDomains } from "../../src/services/runtime-domains.ts";
import { ViewCalls } from "../../src/services/view-calls.ts";
import type { JsonObject, JsonValue } from "../../src/types/json-value.ts";
import { ScriptedViews } from "../fixtures/scripted-views.fixture.ts";

const BOX: PageBox = new PageBox(40, 30, 120, 24);

function quadsOf(box: PageBox | null): JsonObject {
  return { quads: box === null ? [] : [[box.x, box.y, box.x + box.width, box.y, box.x + box.width, box.y + box.height, box.x, box.y + box.height]] };
}

function metricsAt(pageY: number): JsonObject {
  return { cssVisualViewport: { pageX: 0, pageY, clientWidth: 800, clientHeight: 600 }, cssContentSize: { width: 800, height: 2000 }, visualViewport: { clientWidth: 800 } };
}

function frameOf(documentId: string): JsonObject {
  return { frameTree: { frame: { id: "F1", loaderId: documentId, url: "https://shop.test/", securityOrigin: "https://shop.test" } } };
}

const SUBTREE: JsonObject = { node: { backendNodeId: 7, nodeName: "A", children: [{ backendNodeId: 9, nodeName: "SPAN" }] } };
const ELEMENT: ElementReference = new ElementReference("view-1", "L1", 7);

describe("AimFollower", () => {
  let surface: ScriptedViews;
  let calls: ViewCalls;
  let changes: PageChanges;
  let published: JsonObject[];
  let call: AbortController;
  let activity: PageActivity;
  let options: CallOptions;
  let shown: PageBox | null;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    surface = new ScriptedViews(["view-1"]);
    surface.acknowledge(...ScriptedViews.emptyReplies);
    surface.serveWorlds();
    calls = new ViewCalls(surface.relay);
    changes = new PageChanges(surface.relay, calls, new RuntimeDomains(surface.relay, new ConsoleBuffers(surface.relay)), new FakeModuleLog());
    shown = BOX;
    surface.answerWith("DOM.getContentQuads", () => quadsOf(shown));
    surface.answer("Page.getLayoutMetrics", metricsAt(0));
    surface.answer("Page.getFrameTree", frameOf("L1"));
    surface.answer("DOM.getNodeForLocation", { backendNodeId: 7, frameId: "F1" });
    surface.answer("DOM.describeNode", SUBTREE);
    published = [];
    call = new AbortController();
    activity = new PageActivity(new SessionPage("view-1", "page-1", "workspace-1", "Scout"),"session-1", PageAction.Clicking, call.signal,
      t => published.push(t));
    activity.aim(BOX, null);
    activity.ask();
    published.length = 0;
    options = new CallOptions(activity.signal, Date.now() + 60_000, 100_000, true, new ActionProgress(() => undefined));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function settleAsync(): Promise<void> {
    return new Promise<void>(resolve => setImmediate(resolve));
  }

  async function passGapAsync(): Promise<void> {
    await vi.advanceTimersByTimeAsync(100);
    await settleAsync();
  }

  async function changeAsync(): Promise<void> {
    surface.reportChange("view-1");
    await passGapAsync();
  }

  function follow(card: Promise<string>): Promise<string> {
    return AimFollower.whileAsync(calls, changes, ELEMENT, activity, options, () => card);
  }

  function hearing(isOn: boolean): JsonObject {
    return { functionDeclaration: PageChangeScript.functionDeclaration, uniqueContextId: "view-1.1", arguments: [{ value: isOn }], returnByValue: true, silent: true };
  }

  function readCalls(): readonly string[] {
    return surface.calls.map(t => t.method).filter(t => ["Page.getFrameTree", "DOM.getContentQuads", "Page.getLayoutMetrics", "DOM.getNodeForLocation", "DOM.describeNode"].includes(t))
      .slice(1);
  }

  function boxes(): readonly JsonValue[] {
    return published.map(t => t["box"] ?? null);
  }

  function reads(): number {
    return surface.calls.filter(t => t.method === "DOM.getContentQuads").length;
  }

  it("hears the page in its main frame's world, reads the element at once and again on each change it reports, publishes only a box that moved, and stops on the answer", async () => {
    const card: PromiseWithResolvers<string> = Promise.withResolvers<string>();
    const asking: Promise<string> = follow(card.promise);
    await settleAsync();
    const first: number = reads();
    await settleAsync();
    const unchanged: number = reads();
    shown = new PageBox(40, 70, 120, 24);
    await changeAsync();
    card.resolve("allowed");
    const answer: string = await asking;
    await settleAsync();
    const stopped: number = surface.calls.length;
    await changeAsync();

    expect([answer, first, unchanged, reads(), boxes(), surface.calls.length]).toEqual(["allowed", 1, 1, 2, [new PageBox(40, 70, 120, 24)], stopped]);
    expect(surface.calls.filter(t => ["Runtime.addBinding", "Page.createIsolatedWorld", "Runtime.callFunctionOn"].includes(t.method)).map(t => [t.method, t.params]))
      .toEqual([
        ["Runtime.addBinding", { name: PageChangeScript.bindingName, executionContextName: PageChangeScript.worldName }],
        ["Page.createIsolatedWorld", { frameId: "F1", worldName: PageChangeScript.worldName, grantUniveralAccess: false }],
        ["Runtime.callFunctionOn", hearing(true)],
        ["Runtime.callFunctionOn", hearing(false)]
      ]);
    expect(readCalls()).toEqual(["Page.getFrameTree", "DOM.getContentQuads", "Page.getLayoutMetrics", "DOM.getNodeForLocation", "Page.getFrameTree", "DOM.getContentQuads",
      "Page.getLayoutMetrics", "DOM.getNodeForLocation"]);
  });

  it("hides the mark while the element has no box or lies wholly outside the viewport, and shows it again once a part is back in view", async () => {
    const card: PromiseWithResolvers<string> = Promise.withResolvers<string>();
    const asking: Promise<string> = follow(card.promise);
    await settleAsync();
    const steps: readonly (PageBox | null)[] = [
      null, BOX, new PageBox(40, -24, 120, 24), new PageBox(40, -23, 120, 24), new PageBox(40, 600, 120, 24), new PageBox(-120, 30, 120, 24),
      new PageBox(800, 30, 120, 24), new PageBox(799, 599, 120, 24)
    ];

    for (const step of steps) {
      shown = step;
      await changeAsync();
    }
    card.resolve("allowed");
    await asking;

    expect(boxes()).toEqual([null, BOX, null, new PageBox(40, -23, 120, 24), null, new PageBox(799, 599, 120, 24)]);
  });

  it("reads once more for all the changes the page reported during a read, and never runs two reads at once", async () => {
    const card: PromiseWithResolvers<string> = Promise.withResolvers<string>();
    const asking: Promise<string> = follow(card.promise);
    await settleAsync();
    const held: PromiseWithResolvers<JsonValue> = Promise.withResolvers<JsonValue>();
    surface.answerWith("DOM.getContentQuads", () => held.promise);
    await changeAsync();
    await changeAsync();
    await changeAsync();
    const during: number = reads();
    surface.answerWith("DOM.getContentQuads", () => quadsOf(shown));
    held.resolve(quadsOf(shown));
    await passGapAsync();
    card.resolve("allowed");
    await asking;

    expect([during, reads()]).toEqual([2, 3]);
  });

  it("hides the mark for a read that fails, as for an element the page removed, and follows it again once a read finds it", async () => {
    const card: PromiseWithResolvers<string> = Promise.withResolvers<string>();
    const asking: Promise<string> = follow(card.promise);
    await settleAsync();

    surface.fail("DOM.getContentQuads", new WebViewFailure(WebViewFailureKind.Protocol, -32000, "No node with given id found"));
    await changeAsync();
    surface.answerWith("DOM.getContentQuads", () => quadsOf(shown));
    await changeAsync();
    card.resolve("allowed");
    await asking;

    expect(boxes()).toEqual([null, BOX]);
  });

  it("leaves the mark where the call aimed it, and reads nothing, when the page can't report its changes", async () => {
    surface.fail("Runtime.addBinding", new WebViewFailure(WebViewFailureKind.NotAllowed));
    const card: PromiseWithResolvers<string> = Promise.withResolvers<string>();
    const asking: Promise<string> = follow(card.promise);
    await settleAsync();
    shown = new PageBox(40, 70, 120, 24);
    await changeAsync();
    card.resolve("allowed");

    expect([await asking, reads(), boxes()]).toEqual(["allowed", 0, []]);
  });

  it("throws a failure that isn't a call's, which only a bug makes, once the ask ends, rather than leaving the mark where the call aimed it", async () => {
    const bug: Error = new Error("bug");
    surface.answerWith("Runtime.addBinding", () => Promise.reject(bug));
    const card: PromiseWithResolvers<string> = Promise.withResolvers<string>();
    const asking: Promise<string> = follow(card.promise);
    const failing: Promise<unknown> = asking.then(() => expect.fail("The follow hid the bug."), (error: unknown) => error);
    await settleAsync();
    card.resolve("allowed");

    expect(await failing).toBe(bug);
  });

  it("throws a failure of a read that isn't a call's, which only a bug makes, once the ask ends, rather than hiding the mark", async () => {
    const bug: Error = new Error("bug");
    for (const method of ["Page.getFrameTree", "DOM.getContentQuads"]) {
      const card: PromiseWithResolvers<string> = Promise.withResolvers<string>();
      const asking: Promise<string> = follow(card.promise);
      const failing: Promise<unknown> = asking.then(() => expect.fail("The follow hid the bug."), (error: unknown) => error);
      await settleAsync();
      surface.answerWith(method, () => Promise.reject(bug));
      await changeAsync();
      card.resolve("allowed");

      expect(await failing, method).toBe(bug);
      surface.answer("Page.getFrameTree", frameOf("L1"));
      surface.answerWith("DOM.getContentQuads", () => quadsOf(shown));
    }
  });

  it("stops when the ask fails, throwing its failure, and when the call's signal aborts while the card still asks or before it", async () => {
    const refused: Error = new Error("Denied");
    const failing: Promise<string> = AimFollower.whileAsync(calls, changes, ELEMENT, activity, options, () => Promise.reject(refused));
    await expect(failing).rejects.toBe(refused);
    await changeAsync();
    const afterFailure: number = reads();

    const card: PromiseWithResolvers<string> = Promise.withResolvers<string>();
    const asking: Promise<string> = follow(card.promise);
    await settleAsync();
    call.abort();
    await changeAsync();
    card.resolve("allowed");
    await asking;
    const late: string = await AimFollower.whileAsync(calls, changes, ELEMENT, activity, options, async () => "allowed");

    expect([afterFailure, reads(), boxes(), late]).toEqual([0, 1, [], "allowed"]);
  });

  it("aims nothing from a read the answer overtook, and returns without waiting for it", async () => {
    const card: PromiseWithResolvers<string> = Promise.withResolvers<string>();
    const asking: Promise<string> = follow(card.promise);
    await settleAsync();
    surface.hang("DOM.getContentQuads");
    shown = new PageBox(40, 300, 120, 24);

    await changeAsync();
    card.resolve("allowed");

    expect([await asking, reads(), boxes()]).toEqual(["allowed", 2, []]);
  });

  it("returns without waiting for the page's world, when the answer comes before the view reports the world", async () => {
    surface.answer("Page.createIsolatedWorld", { executionContextId: 41 });
    const card: PromiseWithResolvers<string> = Promise.withResolvers<string>();
    const asking: Promise<string> = follow(card.promise);
    await settleAsync();
    card.resolve("allowed");

    expect([await asking, reads(), boxes()]).toEqual(["allowed", 0, []]);
  });

  it("hides the mark while the topmost element at its visible part's centre is neither the element nor inside it, as under a cover or an inner pane that scrolled it away", async () => {
    const card: PromiseWithResolvers<string> = Promise.withResolvers<string>();
    const asking: Promise<string> = follow(card.promise);
    await settleAsync();
    const before: number = surface.calls.length;
    shown = new PageBox(40, -10, 120, 24);
    surface.answer("Page.getLayoutMetrics", metricsAt(500));
    const hits: readonly JsonObject[] = [{ backendNodeId: 8, frameId: "F1" }, { backendNodeId: 9, frameId: "F1" }, {}, { backendNodeId: 7, frameId: "F1" }];

    for (const hit of hits) {
      surface.answer("DOM.getNodeForLocation", hit);
      await changeAsync();
    }
    card.resolve("allowed");
    await asking;

    const later: readonly JsonObject[] = surface.calls.slice(before).map(t => ({ method: t.method, params: t.params }));
    expect(boxes()).toEqual([null, shown, null, shown]);
    expect(later.filter(t => t["method"] === "DOM.getNodeForLocation").map(t => t["params"])).toEqual(hits.map(() => ({ x: 100, y: 507, includeUserAgentShadowDOM: false })));
    expect(later.filter(t => t["method"] === "DOM.describeNode").map(t => t["params"])).toEqual([8, 9].map(() => ({ backendNodeId: 7, depth: -1, pierce: true })));
  });

  it("shows the mark on a hit inside the element on a page whose whole tree can't be read, as it reads only the element's subtree", async () => {
    surface.fail("DOM.getDocument", new WebViewFailure(WebViewFailureKind.TimedOut));
    surface.answer("DOM.getNodeForLocation", { backendNodeId: 9, frameId: "F1" });
    shown = new PageBox(40, 300, 120, 24);
    const card: PromiseWithResolvers<string> = Promise.withResolvers<string>();
    const asking: Promise<string> = follow(card.promise);

    await settleAsync();
    card.resolve("allowed");
    await asking;

    expect([boxes(), surface.calls.filter(t => t.method === "DOM.getDocument").length]).toEqual([[shown], 0]);
  });

  it("reads a page that reports a change every frame once a gap after its previous read, not once a frame", async () => {
    const card: PromiseWithResolvers<string> = Promise.withResolvers<string>();
    const asking: Promise<string> = follow(card.promise);
    await settleAsync();
    for (let frame: number = 0; frame < 5; frame += 1) {
      surface.reportChange("view-1");
      await vi.advanceTimersByTimeAsync(16);
    }
    const inGap: number = reads();
    await passGapAsync();
    card.resolve("allowed");
    await asking;

    expect([inGap, reads()]).toEqual([1, 2]);
  });

  it("gives each of a read's calls its own time limit, so a slow call leaves the next its whole limit", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    surface.answer("DOM.getNodeForLocation", { backendNodeId: 9, frameId: "F1" });
    const card: PromiseWithResolvers<string> = Promise.withResolvers<string>();
    const asking: Promise<string> = follow(card.promise);
    await settleAsync();
    const before: number = surface.calls.length;
    surface.answerWith("Page.getFrameTree", () => {
      vi.setSystemTime(Date.now() + 900);
      return frameOf("L1");
    });

    await changeAsync();
    card.resolve("allowed");
    await asking;

    expect(surface.calls.slice(before).filter(t => t.method !== "Runtime.callFunctionOn").map(t => [t.method, t.timeoutMilliseconds]))
      .toEqual(["Page.getFrameTree", "DOM.getContentQuads", "Page.getLayoutMetrics", "DOM.getNodeForLocation", "DOM.describeNode"].map(t => [t, 1_000]));
  });

  it("hides the mark while the page's frame can't be read, and once a navigation shows another document hides it and reads nothing more", async () => {
    const card: PromiseWithResolvers<string> = Promise.withResolvers<string>();
    const asking: Promise<string> = follow(card.promise);
    await settleAsync();

    surface.fail("Page.getFrameTree", new WebViewFailure(WebViewFailureKind.TimedOut));
    await changeAsync();
    surface.answer("Page.getFrameTree", frameOf("L1"));
    await changeAsync();
    surface.answer("Page.getFrameTree", frameOf("L2"));
    surface.emitProtocolEvent("view-1", "Page.frameNavigated", { frame: { id: "F1", loaderId: "L2" } });
    await passGapAsync();
    const frames: number = readCalls().filter(t => t === "Page.getFrameTree").length;
    await changeAsync();
    card.resolve("allowed");
    await asking;

    expect([boxes(), frames, readCalls().filter(t => t === "Page.getFrameTree").length, reads()]).toEqual([[null, BOX, null], 4, 4, 2]);
  });
});
