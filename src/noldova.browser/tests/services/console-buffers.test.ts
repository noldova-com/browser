/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConsoleEntry } from "../../src/models/console-entry.ts";
import { ConsoleRead } from "../../src/models/console-read.ts";
import { ConsoleBuffers } from "../../src/services/console-buffers.ts";
import { ScriptedViews } from "../fixtures/scripted-views.fixture.ts";

const AT: number = Date.UTC(2026, 10, 7, 12, 0, 0);

describe("ConsoleBuffers", () => {
  let surface: ScriptedViews;
  let buffers: ConsoleBuffers;

  function log(viewId: string, text: string, type: string = "log"): void {
    surface.emitProtocolEvent(viewId, "Runtime.consoleAPICalled", { type, args: [{ type: "string", value: text }], timestamp: AT });
  }

  beforeEach(() => {
    surface = new ScriptedViews(["view-1", "view-2"]);
    buffers = new ConsoleBuffers(surface.relay);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps nothing for a pane it hasn't started, and hears a started pane's entries only, numbered from its first", () => {
    log("view-1", "before");
    buffers.start("view-1", "https://shop.test");
    log("view-1", "first");
    log("view-2", "elsewhere");
    surface.emitProtocolEvent("view-1", "Page.loadEventFired", {});
    log("view-1", "second", "error");

    expect(buffers.read("view-2", 0)).toStrictEqual(new ConsoleRead([], 0, 0, false));
    expect(buffers.read("view-1", 0)).toStrictEqual(new ConsoleRead([
      new ConsoleEntry(0, "Info", "console", "first", AT, "https://shop.test"),
      new ConsoleEntry(1, "Error", "console", "second", AT, "https://shop.test")
    ], 0, 2, false));
    expect(buffers.read("view-1", 1).entries.map(t => t.text)).toEqual(["second"]);
  });

  it("marks a navigation of the top frame with its address, and gives later entries the new page's origin", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT + 1_000);
    buffers.start("view-1", "https://shop.test");
    surface.emitProtocolEvent("view-1", "Page.frameNavigated", { frame: { id: "F1", url: "https://pay.test/checkout", securityOrigin: "https://pay.test" } });
    log("view-1", "paid");

    expect(buffers.read("view-1", 0).entries).toStrictEqual([
      new ConsoleEntry(0, null, "navigated to", "https://pay.test/checkout", AT + 1_000, "https://pay.test"),
      new ConsoleEntry(1, "Info", "console", "paid", AT, "https://pay.test")
    ]);
  });

  it("cuts an entry to its limit and marks the cut", () => {
    buffers.start("view-1", "https://shop.test");
    log("view-1", "é".repeat(2048));
    log("view-1", "é".repeat(1024));

    expect(buffers.read("view-1", 0).entries.map(t => t.text)).toEqual([`${"é".repeat(1024)} [cut]`, "é".repeat(1024)]);
  });

  it("cuts a navigation's address and an entry's source to the same limit, and marks each cut", () => {
    const long: string = `https://pay.test/?q=${"a".repeat(40 * 1024)}`;
    buffers.start("view-1", "https://shop.test");
    surface.emitProtocolEvent("view-1", "Page.frameNavigated", { frame: { id: "F1", url: long, securityOrigin: "https://pay.test" } });
    surface.emitProtocolEvent("view-1", "Runtime.consoleAPICalled", { type: "log", args: [{ type: "string", value: "paid" }], timestamp: AT,
      stackTrace: { callFrames: [{ url: long, lineNumber: 0 }] } });

    expect(buffers.read("view-1", 0).entries.map(t => [t.text, t.source, t.origin])).toEqual([
      [`https://pay.test/?q=${"a".repeat(2028)} [cut]`, "navigated to", "https://pay.test"],
      ["paid", `console at https://pay.test/?q=${"a".repeat(2017)} [cut]`, "https://pay.test"]
    ]);
  });

  it("goes on with a pane's entries and numbering when its ring is paused and started again, and starts from 0 once the pane closes", () => {
    buffers.start("view-1", "https://shop.test");
    log("view-1", "first");
    log("view-1", "second");
    buffers.pause("view-1");
    buffers.start("view-1", "https://shop.test");
    log("view-1", "third");
    const again: ConsoleRead = buffers.read("view-1", 0);
    buffers.close("view-1");
    buffers.start("view-1", "https://shop.test");

    expect([again.entries.map(t => [t.sequence, t.text]), again.oldest, again.next, buffers.read("view-1", 0).next]).toEqual([[[0, "first"], [1, "second"], [2, "third"]], 0, 3, 0]);
  });

  it("keeps the last entries to the ring's count, dropping the oldest, and its oldest number moves on", () => {
    buffers.start("view-1", "https://shop.test");
    for (let index: number = 0; index < 503; index++)
      log("view-1", `entry ${index}`);

    const read: ConsoleRead = buffers.read("view-1", 0);
    expect([read.entries.length, read.oldest, read.next, read.entries[0]?.text]).toEqual([500, 3, 503, "entry 3"]);
  });

  it("keeps the last entries to the ring's size", () => {
    buffers.start("view-1", "https://shop.test");
    for (let index: number = 0; index < 200; index++)
      log("view-1", "x".repeat(2048));

    const read: ConsoleRead = buffers.read("view-1", 0);
    expect([read.entries.length, read.oldest, read.next]).toEqual([123, 77, 200]);
  });

  it("starts a pane once, stops hearing it when paused and keeps its entries, and goes on numbering from them when started again", () => {
    const listeners: number = surface.protocolListenerCount;
    buffers.start("view-1", "https://shop.test");
    log("view-1", "kept");
    buffers.start("view-1", "https://other.test");
    const started: number = surface.protocolListenerCount;

    buffers.pause("view-1");
    buffers.pause("view-2");
    log("view-1", "missed");
    const paused: readonly unknown[] = [started - listeners, surface.protocolListenerCount, buffers.read("view-1", 0)];
    buffers.start("view-1", "https://pay.test");
    log("view-1", "after");

    expect(paused).toEqual([1, listeners, { entries: [expect.objectContaining({ sequence: 0, text: "kept", origin: "https://shop.test" })], oldest: 0, next: 1,
      mayRepeat: false }]);
    expect(paused[2]).toBeInstanceOf(ConsoleRead);
    expect(buffers.read("view-1", 0).entries.map(t => [t.sequence, t.text, t.origin])).toEqual([[0, "kept", "https://shop.test"], [1, "after", "https://pay.test"]]);
  });

  it("says a read may repeat entries when it reaches what the ring heard after it started again, from a cursor at or before that start", () => {
    buffers.start("view-1", "https://shop.test");
    log("view-1", "Cart loaded");
    buffers.pause("view-1");
    buffers.start("view-1", "https://shop.test");
    const unheard: boolean = buffers.read("view-1", 0).mayRepeat;
    log("view-1", "Cart loaded");

    expect([unheard, buffers.read("view-1", 0).mayRepeat, buffers.read("view-1", 1).mayRepeat, buffers.read("view-1", 2).mayRepeat]).toEqual([false, true, true, false]);
  });

  it("forgets a closed pane's entries and numbering, and closing one it never started does nothing", () => {
    buffers.start("view-1", "https://shop.test");
    log("view-1", "kept");

    buffers.close("view-1");
    buffers.close("view-2");
    buffers.start("view-1", "https://shop.test");

    expect([buffers.read("view-1", 0), buffers.read("view-2", 0)]).toStrictEqual([new ConsoleRead([], 0, 0, false), new ConsoleRead([], 0, 0, false)]);
  });
});
