/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewEventKind } from "@noldova/desktop.protocol";
import { ToolAbortReason } from "@noldova/desktop.runtime";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CallCancelledException } from "../../src/exceptions/call-cancelled.exception.ts";
import { PendingNavigations } from "../../src/services/pending-navigations.ts";
import { ScriptedViews } from "../fixtures/scripted-views.fixture.ts";

describe("PendingNavigations", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const start = (surface: ScriptedViews, frameId: string = "main", viewId: string = "view-1"): void => {
    surface.emitProtocolEvent(viewId, "Page.frameStartedNavigating", { frameId, url: "https://shop.test/help", loaderId: "loader-2", navigationType: "differentDocument" });
  };

  // Whether the view settles within a second, which a fake clock lets run out.
  const settleAsync = async (navigations: PendingNavigations, signal: AbortSignal = new AbortController().signal): Promise<boolean> => {
    const settling: Promise<boolean> = navigations.settleAsync("view-1", Date.now() + 1_000, signal);
    await vi.advanceTimersByTimeAsync(1_000);
    return settling;
  };

  it("finds no navigation pending in a view it doesn't watch, so it settles at once, while a start there never comes", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    const navigations: PendingNavigations = new PendingNavigations(surface.webViews);
    let isStarted: boolean = false;
    void navigations.startedAsync("view-1").then(() => {
      isStarted = true;
    });
    start(surface);
    await Promise.resolve();

    expect([navigations.isPending("view-1"), await navigations.settleAsync("view-1", 0, new AbortController().signal), isStarted, surface.protocolListenerCount])
      .toEqual([false, true, false, 0]);
  });

  it("is pending from the main frame's start of a navigation to another document until its commit", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    const navigations: PendingNavigations = new PendingNavigations(surface.webViews);
    navigations.watch("view-1", "main");
    start(surface);
    const pending: boolean = navigations.isPending("view-1");

    surface.emitProtocolEvent("view-1", "Page.frameNavigated", { frame: { id: "main", url: "https://shop.test/help" } });

    expect([pending, navigations.isPending("view-1")]).toEqual([true, false]);
  });

  it("ends a pending navigation when the main frame stops loading without a commit, as for a download", () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    const navigations: PendingNavigations = new PendingNavigations(surface.webViews);
    navigations.watch("view-1", "main");
    start(surface);
    surface.emitProtocolEvent("view-1", "Page.frameStoppedLoading", { frameId: "main" });

    expect(navigations.isPending("view-1")).toBe(false);
  });

  it("ignores a move within the document and the navigations of another frame", () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    const navigations: PendingNavigations = new PendingNavigations(surface.webViews);
    navigations.watch("view-1", "main");
    surface.emitProtocolEvent("view-1", "Page.frameStartedNavigating", { frameId: "main", url: "https://shop.test/#top", navigationType: "sameDocument" });
    start(surface, "inner");

    expect(navigations.isPending("view-1")).toBe(false);
  });

  it("follows the main frame a later read names, and listens once per view", () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    const navigations: PendingNavigations = new PendingNavigations(surface.webViews);
    navigations.watch("view-1", "main");
    navigations.watch("view-1", "main-2");
    start(surface, "main");
    const old: boolean = navigations.isPending("view-1");
    start(surface, "main-2");

    expect([old, navigations.isPending("view-1"), surface.protocolListenerCount, surface.viewListenerCount]).toEqual([false, true, 1, 1]);
  });

  it("ends a pending navigation on the view's crash and keeps watching it, and forgets the view once it closed", () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1", "view-2"]);
    const navigations: PendingNavigations = new PendingNavigations(surface.webViews);
    navigations.watch("view-1", "main");
    start(surface);
    surface.emitViewEvent("view-2", WebViewEventKind.Crashed);
    const otherView: boolean = navigations.isPending("view-1");
    surface.emitViewEvent("view-1", WebViewEventKind.Crashed);
    const crashed: [boolean, number] = [navigations.isPending("view-1"), surface.protocolListenerCount];
    start(surface);
    const again: boolean = navigations.isPending("view-1");

    surface.emitViewEvent("view-1", WebViewEventKind.Closed);

    expect([otherView, crashed, again, navigations.isPending("view-1"), surface.protocolListenerCount, surface.viewListenerCount])
      .toEqual([true, [false, 1], true, false, 0, 0]);
  });

  it("settles the next start of a navigation in a watched view", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    const navigations: PendingNavigations = new PendingNavigations(surface.webViews);
    navigations.watch("view-1", "main");
    const started: Promise<void> = navigations.startedAsync("view-1");
    start(surface);

    await expect(started).resolves.toBeUndefined();
  });

  it("settles once a pending navigation ends before the time given, and answers false when the time comes first", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    const navigations: PendingNavigations = new PendingNavigations(surface.webViews);
    navigations.watch("view-1", "main");
    start(surface);
    const late: boolean = await settleAsync(navigations);
    const settling: Promise<boolean> = navigations.settleAsync("view-1", Date.now() + 1_000, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(500);

    surface.emitProtocolEvent("view-1", "Page.frameNavigated", { frame: { id: "main", url: "https://shop.test/help" } });

    expect([late, await settling, vi.getTimerCount()]).toEqual([false, true, 0]);
  });

  it("answers false at once for a time already past, with no timer", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    const navigations: PendingNavigations = new PendingNavigations(surface.webViews);
    navigations.watch("view-1", "main");
    start(surface);
    const settling: Promise<boolean> = navigations.settleAsync("view-1", Date.now(), new AbortController().signal);

    expect([await settling, vi.getTimerCount()]).toEqual([false, 0]);
  });

  it("fails a wait for a pending navigation as the call's signal aborts, before or while it waits, and leaves no timer", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    const navigations: PendingNavigations = new PendingNavigations(surface.webViews);
    navigations.watch("view-1", "main");
    start(surface);
    const before: AbortController = new AbortController();
    before.abort(ToolAbortReason.Cancelled);
    const during: AbortController = new AbortController();
    const waiting: Promise<boolean> = navigations.settleAsync("view-1", Date.now() + 1_000, during.signal);
    during.abort(ToolAbortReason.Cancelled);

    await expect(navigations.settleAsync("view-1", Date.now() + 1_000, before.signal)).rejects.toBeInstanceOf(CallCancelledException);
    await expect(waiting).rejects.toBeInstanceOf(CallCancelledException);
    expect(vi.getTimerCount()).toBe(0);
  });
});
