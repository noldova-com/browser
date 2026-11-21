/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConsoleBuffers } from "../../src/services/console-buffers.ts";
import { RuntimeDomains } from "../../src/services/runtime-domains.ts";
import type { AllowedMethod } from "../../src/types/allowed-method.ts";
import type { JsonObject, JsonValue } from "../../src/types/json-value.ts";
import { ScriptedViews } from "../fixtures/scripted-views.fixture.ts";

const WORLD: string = "noldova-browser-test";
const ENABLES: readonly string[] = ["Page.enable", "Runtime.disable", "Runtime.enable", "Log.enable", "Runtime.discardConsoleEntries"];
const BINDING: JsonObject = { name: "noldovaBrowserChanged", executionContextName: "noldova-browser-changes" };
const UNSTOPPED: AbortSignal = new AbortController().signal;

describe("RuntimeDomains", () => {
  let surface: ScriptedViews;
  let domains: RuntimeDomains;
  let sent: string[];

  function sendAsync(method: AllowedMethod, params: JsonObject): Promise<JsonValue> {
    sent.push(method);
    return surface.relay.sendAsync("view-1", method, params, 1_000);
  }

  function take(): readonly string[] {
    return sent.splice(0);
  }

  function report(id: number, name: string = WORLD, frameId: string = "frame-1"): void {
    surface.emitProtocolEvent("view-1", "Runtime.executionContextCreated", { context: { id, uniqueId: `unique-${id}`, name, auxData: { frameId } } });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    surface = new ScriptedViews(["view-1"]);
    surface.acknowledge(...ScriptedViews.emptyReplies);
    domains = new RuntimeDomains(surface.relay, new ConsoleBuffers(surface.relay));
    sent = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hears the view before it resets Runtime and enables the domains, once, and shares a start under way", async () => {
    const before: number = surface.protocolListenerCount;
    surface.answerWith("Runtime.enable", () => {
      report(1);
      return {};
    });

    await Promise.all([domains.startAsync("view-1", "https://shop.test", sendAsync), domains.startAsync("view-1", "https://shop.test", sendAsync)]);
    await domains.startAsync("view-1", "https://shop.test", sendAsync);

    expect([sent, surface.protocolListenerCount - before]).toEqual([ENABLES, 2]);
    expect(await domains.findContextAsync("view-1", 1, "frame-1", WORLD, 1_000, UNSTOPPED)).toBe("unique-1");
  });

  it("gives a context's unique id only when it is the named world's in the frame, and forgets contexts the view destroys or clears", async () => {
    await domains.startAsync("view-1", "https://shop.test", sendAsync);
    report(1);
    report(2, "");
    report(3, WORLD, "frame-2");
    report(4);

    const found: readonly (string | null)[] = await Promise.all([domains.findContextAsync("view-1", 1, "frame-1", WORLD, 1_000, UNSTOPPED), domains.findContextAsync("view-1", 2, "frame-1", WORLD, 1_000, UNSTOPPED),
      domains.findContextAsync("view-1", 3, "frame-1", WORLD, 1_000, UNSTOPPED)]);
    surface.emitProtocolEvent("view-1", "Runtime.executionContextDestroyed", { executionContextId: 1, executionContextUniqueId: "unique-1" });
    const destroyed: Promise<string | null> = domains.findContextAsync("view-1", 1, "frame-1", WORLD, 1_000, UNSTOPPED);
    surface.emitProtocolEvent("view-1", "Runtime.executionContextsCleared", {});
    const cleared: Promise<string | null> = domains.findContextAsync("view-1", 4, "frame-1", WORLD, 1_000, UNSTOPPED);
    await vi.advanceTimersByTimeAsync(1_000);

    expect([found, await destroyed, await cleared]).toEqual([["unique-1", null, null], null, null]);
  });

  it("ignores context events that aren't ones", async () => {
    await domains.startAsync("view-1", "https://shop.test", sendAsync);
    report(1);
    for (const params of [{}, { context: 1 }, { context: { id: "2", uniqueId: "unique-2", name: WORLD, auxData: { frameId: "frame-1" } } },
      { context: { id: 2, uniqueId: "unique-2", name: WORLD, auxData: null } }, { context: { id: 2, uniqueId: 2, name: WORLD, auxData: { frameId: "frame-1" } } },
      { context: { id: 2, uniqueId: "unique-2", name: null, auxData: { frameId: "frame-1" } } }])
      surface.emitProtocolEvent("view-1", "Runtime.executionContextCreated", params);
    surface.emitProtocolEvent("view-1", "Runtime.executionContextDestroyed", { executionContextId: "1" });
    const kept: string | null = await domains.findContextAsync("view-1", 1, "frame-1", WORLD, 1_000, UNSTOPPED);
    const missing: Promise<string | null> = domains.findContextAsync("view-1", 2, "frame-1", WORLD, 1_000, UNSTOPPED);
    await vi.advanceTimersByTimeAsync(1_000);

    expect([kept, await missing]).toEqual(["unique-1", null]);
  });

  it("waits for a context the view reports after the reply that made it, and gives null once its time runs out, its tracker drops, or it was never started", async () => {
    const unstarted: string | null = await domains.findContextAsync("view-1", 1, "frame-1", WORLD, 1_000, UNSTOPPED);
    await domains.startAsync("view-1", "https://shop.test", sendAsync);
    const later: Promise<string | null> = domains.findContextAsync("view-1", 1, "frame-1", WORLD, 1_000, UNSTOPPED);
    report(1);
    const late: Promise<string | null> = domains.findContextAsync("view-1", 2, "frame-1", WORLD, 1_000, UNSTOPPED);
    await vi.advanceTimersByTimeAsync(999);
    report(2);
    const timedOut: Promise<string | null> = domains.findContextAsync("view-1", 3, "frame-1", WORLD, 1_000, UNSTOPPED);
    await vi.advanceTimersByTimeAsync(1_000);
    const dropped: Promise<string | null> = domains.findContextAsync("view-1", 3, "frame-1", WORLD, 1_000, UNSTOPPED);
    domains.drop("view-1");

    expect([unstarted, await later, await late, await timedOut, await dropped]).toEqual([null, "unique-1", "unique-2", null, null]);
  });

  it("hears the console only from the disable's reply on, so an entry a domain left on reports live isn't kept again from the enable's replay", async () => {
    const log = (text: string): void => {
      surface.emitProtocolEvent("view-1", "Runtime.consoleAPICalled", { type: "log", args: [{ type: "string", value: text }], timestamp: 0 });
    };
    surface.answerWith("Page.enable", () => {
      log("Cart loaded");
      return {};
    });
    surface.answerWith("Runtime.disable", () => {
      log("Cart saved");
      return {};
    });
    surface.answerWith("Runtime.enable", () => {
      log("Cart loaded");
      log("Cart saved");
      return {};
    });

    await domains.startAsync("view-1", "https://shop.test", sendAsync);

    expect(domains.consoles.read("view-1", 0).entries.map(t => t.text)).toEqual(["Cart loaded", "Cart saved"]);
  });

  it("starts no ring, and leaves the view not started, when the start fails before the disable", async () => {
    const failure: WebViewFailure = new WebViewFailure(WebViewFailureKind.TimedOut);
    surface.fail("Page.enable", failure);

    await expect(domains.startAsync("view-1", "https://shop.test", sendAsync)).rejects.toMatchObject({ failure });
    surface.emitProtocolEvent("view-1", "Runtime.consoleAPICalled", { type: "log", args: [{ type: "string", value: "Cart loaded" }], timestamp: 0 });
    report(1);

    expect([sent, domains.consoles.read("view-1", 0).next, await domains.findContextAsync("view-1", 1, "frame-1", WORLD, 1_000, UNSTOPPED)])
      .toEqual([["Page.enable"], 0, null]);
  });

  it("leaves a view whose first Runtime.enable failed not started, so a lookup gives null at once and the next start enables the domains again", async () => {
    const before: number = surface.protocolListenerCount;
    const failure: WebViewFailure = new WebViewFailure(WebViewFailureKind.TimedOut);
    surface.fail("Runtime.enable", failure);
    await expect(domains.startAsync("view-1", "https://shop.test", sendAsync)).rejects.toMatchObject({ failure });
    const listening: number = surface.protocolListenerCount - before;
    const lookup: string | null = await domains.findContextAsync("view-1", 1, "frame-1", WORLD, 1_000, UNSTOPPED);
    take();
    surface.answerWith("Runtime.enable", () => {
      report(1);
      return {};
    });

    await domains.startAsync("view-1", "https://shop.test", sendAsync);

    expect([listening, lookup, take(), await domains.findContextAsync("view-1", 1, "frame-1", WORLD, 1_000, UNSTOPPED)]).toEqual([0, null, ENABLES, "unique-1"]);
  });

  it("stops hearing a dropped view and starts it again in full, keeping what its ring heard, and forgets a closed view's ring, or one never started", async () => {
    const before: number = surface.protocolListenerCount;
    await domains.startAsync("view-1", "https://shop.test", sendAsync);
    surface.emitProtocolEvent("view-1", "Runtime.consoleAPICalled", { type: "log", args: [{ type: "string", value: "Cart loaded" }], timestamp: 0 });
    domains.drop("view-1");
    const listening: number = surface.protocolListenerCount - before;
    report(1);
    await domains.startAsync("view-1", "https://shop.test", sendAsync);
    const kept: readonly string[] = domains.consoles.read("view-1", 0).entries.map(t => t.text);
    domains.close("view-1");
    domains.close("view-2");

    expect([listening, sent.filter(t => t === "Runtime.disable").length, kept, surface.protocolListenerCount - before,
      domains.consoles.read("view-1", 0).next]).toEqual([0, 2, ["Cart loaded"], 0, 0]);
  });

  it("ends a wait at its signal's abort, during it or before it, and leaves the tracker running past the wait's time limit", async () => {
    const before: number = surface.protocolListenerCount;
    await domains.startAsync("view-1", "https://shop.test", sendAsync);
    const stop: AbortController = new AbortController();
    const waiting: Promise<string | null> = domains.findContextAsync("view-1", 1, "frame-1", WORLD, 1_000, stop.signal);
    stop.abort();
    const ended: string | null = await waiting;
    const aborted: string | null = await domains.findContextAsync("view-1", 1, "frame-1", WORLD, 1_000, stop.signal);
    await vi.advanceTimersByTimeAsync(1_000);

    expect([ended, aborted, surface.protocolListenerCount - before]).toEqual([null, null, 2]);
  });

  it("sends a kept call after the enables of the start that keeps it and of each later start, at once on a running tracker, and no more once released", async () => {
    const release: () => void = await domains.keepAsync("view-1", "https://shop.test", "Runtime.addBinding", BINDING, sendAsync);
    const fresh: readonly string[] = take();
    domains.drop("view-1");
    await domains.startAsync("view-1", "https://shop.test", sendAsync);
    const restarted: readonly string[] = take();
    const second: () => void = await domains.keepAsync("view-1", "https://shop.test", "Runtime.addBinding", BINDING, sendAsync);
    const running: readonly string[] = take();
    release();
    second();
    domains.drop("view-1");
    await domains.startAsync("view-1", "https://shop.test", sendAsync);

    expect([fresh, restarted, running, take()]).toEqual([[...ENABLES, "Runtime.addBinding"], [...ENABLES, "Runtime.addBinding"], ["Runtime.addBinding"], ENABLES]);
    expect(surface.calls.filter(t => t.method === "Runtime.addBinding").map(t => t.params)).toEqual([BINDING, BINDING, BINDING]);
  });

  it("keeps no call whose start or send failed, and fails as they did", async () => {
    const failure: WebViewFailure = new WebViewFailure(WebViewFailureKind.TimedOut);
    surface.fail("Page.enable", failure);
    await expect(domains.keepAsync("view-1", "https://shop.test", "Runtime.addBinding", BINDING, sendAsync)).rejects.toMatchObject({ failure });
    domains.drop("view-1");
    surface.answer("Page.enable", {});
    await domains.startAsync("view-1", "https://shop.test", sendAsync);
    surface.fail("Runtime.addBinding", failure);
    await expect(domains.keepAsync("view-1", "https://shop.test", "Runtime.addBinding", BINDING, sendAsync)).rejects.toMatchObject({ failure });
    domains.drop("view-1");
    take();
    await domains.startAsync("view-1", "https://shop.test", sendAsync);

    expect(take()).toEqual(ENABLES);
  });

  it("stops the tracker a world wasn't heard in time on, and keeps one started after the tracker it waited on stopped", async () => {
    const before: number = surface.protocolListenerCount;
    await domains.startAsync("view-1", "https://shop.test", sendAsync);
    const missed: Promise<string | null> = domains.findContextAsync("view-1", 1, "frame-1", WORLD, 1_000, UNSTOPPED);
    await vi.advanceTimersByTimeAsync(1_000);
    const stopped: number = surface.protocolListenerCount - before;
    await domains.startAsync("view-1", "https://shop.test", sendAsync);
    const outlived: Promise<string | null> = domains.findContextAsync("view-1", 1, "frame-1", WORLD, 1_000, UNSTOPPED);
    domains.drop("view-1");
    await domains.startAsync("view-1", "https://shop.test", sendAsync);
    await vi.advanceTimersByTimeAsync(1_000);

    expect([await missed, stopped, await outlived, surface.protocolListenerCount - before, sent.filter(t => t === "Runtime.disable").length])
      .toEqual([null, 0, null, 2, 3]);
  });
});
