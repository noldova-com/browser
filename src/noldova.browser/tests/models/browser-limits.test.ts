/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { BrowserLimits } from "../../src/models/browser-limits.ts";

describe("BrowserLimits", () => {
  it("bounds what a tool takes", () => {
    expect(BrowserLimits.maximumUrlLength).toBe(32768);
    expect(BrowserLimits.maximumTypedTextLength).toBe(10000);
    expect(BrowserLimits.maximumReferenceLength).toBe(64);
    expect(BrowserLimits.maximumWaitMilliseconds).toBe(30000);
  });

  it("bounds what a tool returns", () => {
    expect(BrowserLimits.maximumSnapshotBytes).toBe(131072);
    expect(BrowserLimits.maximumScreenshotSide).toBe(1600);
    expect(BrowserLimits.maximumScreenshotBytes).toBe(1048576);
    expect(BrowserLimits.maximumShownUrlLength).toBe(2048);
    expect(BrowserLimits.maximumShownTextLength).toBe(1024);
  });

  it("bounds the page's replies", () => {
    expect(BrowserLimits.maximumTreeReplyBytes).toBe(4194304);
    expect(BrowserLimits.maximumNodeReplyBytes).toBe(65536);
  });

  it("bounds the console ring", () => {
    expect(BrowserLimits.consoleRingEntries).toBe(500);
    expect(BrowserLimits.consoleRingBytes).toBe(262144);
    expect(BrowserLimits.maximumConsoleEntryBytes).toBe(2048);
  });

  it("waits a second for a page to draw, then lays a page out that has no size while hidden at one size, a usual window's", () => {
    expect([BrowserLimits.screenshotDrawMilliseconds, BrowserLimits.hiddenPageWidth, BrowserLimits.hiddenPageHeight]).toEqual([1000, 1280, 800]);
  });

  it("fits one console entry in the ring", () => {
    expect(BrowserLimits.maximumConsoleEntryBytes).toBeLessThanOrEqual(BrowserLimits.consoleRingBytes);
  });
});
