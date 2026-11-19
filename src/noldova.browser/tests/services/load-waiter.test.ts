/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolAbortReason } from "@noldova/desktop.runtime";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CallStoppedException } from "../../src/exceptions/call-stopped.exception.ts";
import { LoadWaiter } from "../../src/services/load-waiter.ts";
import type { JsonObject } from "../../src/types/json-value.ts";
import { ScriptedViews } from "../fixtures/scripted-views.fixture.ts";

describe("LoadWaiter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts a load of its view that came before the wait started", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1", "view-2"]);
    using loads: LoadWaiter = new LoadWaiter(surface.relay, "view-1", null);
    surface.emitProtocolEvent("view-1", "Page.loadEventFired", { timestamp: 1 });

    expect(await loads.waitAsync(Date.now() + 5_000, new AbortController().signal)).toBe(true);
  });

  it("answers false once the time passes with no load of its own view", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const surface: ScriptedViews = new ScriptedViews(["view-1", "view-2"]);
    using loads: LoadWaiter = new LoadWaiter(surface.relay, "view-1", null);
    surface.emitProtocolEvent("view-2", "Page.loadEventFired", { timestamp: 1 });
    surface.emitProtocolEvent("view-1", "Page.frameNavigated", { frame: {} });

    const waiting: Promise<boolean> = loads.waitAsync(Date.now() + 1_000, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(await waiting).toBe(false);
  });

  it("ends the wait by the abort's reason", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    using loads: LoadWaiter = new LoadWaiter(surface.relay, "view-1", null);
    const controller: AbortController = new AbortController();

    const waiting: Promise<boolean> = loads.waitAsync(Date.now() + 5_000, controller.signal);
    controller.abort(ToolAbortReason.Stopped);

    await expect(waiting).rejects.toBeInstanceOf(CallStoppedException);
  });

  it("ends a wait whose signal aborted before it started at once, by the abort's reason, even after a load", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    using loads: LoadWaiter = new LoadWaiter(surface.relay, "view-1", null);
    surface.emitProtocolEvent("view-1", "Page.loadEventFired", { timestamp: 1 });
    const controller: AbortController = new AbortController();
    controller.abort(ToolAbortReason.Stopped);

    await expect(loads.waitAsync(Date.now() + 5_000, controller.signal)).rejects.toBeInstanceOf(CallStoppedException);
  });

  it("answers by a load that comes while it waits, and clears its timer", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    using loads: LoadWaiter = new LoadWaiter(surface.relay, "view-1", null);

    const waiting: Promise<boolean> = loads.waitAsync(Date.now() + 1_000, new AbortController().signal);
    surface.emitProtocolEvent("view-1", "Page.loadEventFired", { timestamp: 1 });

    expect([await waiting, vi.getTimerCount()]).toEqual([true, 0]);
  });

  it("ends the wait on its moving frame's navigation within its document, even after another frame took a new document", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    using loads: LoadWaiter = new LoadWaiter(surface.relay, "view-1", "F1");
    surface.emitProtocolEvent("view-1", "Page.frameNavigated", { frame: { id: "F2", parentId: "F1" } });
    surface.emitProtocolEvent("view-1", "Page.frameNavigated", {});

    const waiting: Promise<boolean> = loads.waitAsync(Date.now() + 5_000, new AbortController().signal);
    surface.emitProtocolEvent("view-1", "Page.navigatedWithinDocument", { frameId: "F1", url: "https://docs.example/start" });

    expect(await waiting).toBe(true);
  });

  it.each<[string, string | null, readonly [string, JsonObject][]]>([
    ["another frame's navigation within its document", "F1", [["Page.navigatedWithinDocument", { frameId: "F2", url: "https://docs.example/frame#b" }]]],
    ["one that comes after its moving frame took a new document, whose load it waits for", "F1", [
      ["Page.frameNavigated", { frame: { id: "F1", url: "https://docs.example/next" } }],
      ["Page.navigatedWithinDocument", { frameId: "F1", url: "https://docs.example/next#top" }]
    ]],
    ["any, with no moving frame", null, [["Page.navigatedWithinDocument", { frameId: "F1", url: "https://docs.example/start" }]]]
  ])("doesn't end the wait on %s", async (_case: string, movingFrameId: string | null, events: readonly [string, JsonObject][]) => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    using loads: LoadWaiter = new LoadWaiter(surface.relay, "view-1", movingFrameId);
    events.forEach(([method, params]) => surface.emitProtocolEvent("view-1", method, params));

    const waiting: Promise<boolean> = loads.waitAsync(Date.now() + 1_000, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(await waiting).toBe(false);
  });

  it("stops hearing the view once disposed", () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    const loads: LoadWaiter = new LoadWaiter(surface.relay, "view-1", null);
    const listening: number = surface.protocolListenerCount;

    loads[Symbol.dispose]();

    expect([listening, surface.protocolListenerCount]).toEqual([1, 0]);
  });
});
