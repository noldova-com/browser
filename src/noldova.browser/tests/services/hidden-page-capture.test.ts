/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";
import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PageAnswerTimedOutException } from "../../src/exceptions/page-answer-timed-out.exception.ts";
import { PageHiddenException } from "../../src/exceptions/page-hidden.exception.ts";
import { ActionProgress } from "../../src/models/action-progress.ts";
import { CallOptions } from "../../src/models/call-options.ts";
import type { LayoutMetrics } from "../../src/models/layout-metrics.ts";
import { HiddenPageCapture } from "../../src/services/hidden-page-capture.ts";
import { ViewCalls } from "../../src/services/view-calls.ts";
import type { JsonObject } from "../../src/types/json-value.ts";
import { writtenTo } from "../fixtures/desktop-fakes.fixture.ts";
import { ScriptedViews } from "../fixtures/scripted-views.fixture.ts";

function metricsOf(width: number, height: number): JsonObject {
  return { cssVisualViewport: { pageX: 0, pageY: 0, clientWidth: width, clientHeight: height }, cssContentSize: { width, height }, visualViewport: { clientWidth: width } };
}

describe("HiddenPageCapture", () => {
  let surface: ScriptedViews;
  let log: FakeModuleLog;
  let seen: [LayoutMetrics, boolean][];

  function options(milliseconds: number = 5_000): CallOptions {
    return new CallOptions(new AbortController().signal, Date.now() + milliseconds, 1_000, false, new ActionProgress(() => undefined));
  }

  function captureAsync(callOptions: CallOptions = options()): Promise<string> {
    return new HiddenPageCapture(new ViewCalls(surface.relay), log).captureAsync("view-1", callOptions, async (metrics, isLaidOut) => {
      seen.push([metrics, isLaidOut]);
      return "captured";
    });
  }

  function sizedAfterLayout(): void {
    surface.answerWith("Page.getLayoutMetrics", () => surface.calls.at(-2)?.method === "Emulation.setDeviceMetricsOverride" ? metricsOf(1280, 800) : metricsOf(0, 0));
  }

  beforeEach(() => {
    surface = new ScriptedViews(["view-1"]);
    surface.acknowledge("Emulation.setDeviceMetricsOverride", "Emulation.clearDeviceMetricsOverride");
    surface.answer("Page.captureScreenshot", { data: "" });
    log = new FakeModuleLog();
    seen = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("captures a page that has a size and draws in time as it is, without laying it out", async () => {
    surface.answer("Page.getLayoutMetrics", metricsOf(800, 600));

    expect(await captureAsync()).toBe("captured");

    expect(seen.map(([metrics, isLaidOut]) => [metrics.width, metrics.height, isLaidOut])).toEqual([[800, 600, false]]);
    expect(surface.calls.map(t => [t.method, t.params])).toEqual([["Page.getLayoutMetrics", {}],
      ["Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1, height: 1, scale: 1 } }]]);
  });

  it("lays a page with no size out at 1280 by 800, captures it at that size, and lets the size go", async () => {
    sizedAfterLayout();

    expect(await captureAsync()).toBe("captured");

    expect(seen.map(([metrics, isLaidOut]) => [metrics.width, metrics.height, isLaidOut])).toEqual([[1280, 800, true]]);
    expect(surface.calls.map(t => [t.method, t.params])).toEqual([["Page.getLayoutMetrics", {}],
      ["Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 0, mobile: false }], ["Page.getLayoutMetrics", {}],
      ["Emulation.clearDeviceMetricsOverride", {}]]);
  });

  it("lays out a page that has a size but doesn't draw within the second its draw check is given, which ends before the call's", async () => {
    surface.answer("Page.getLayoutMetrics", metricsOf(800, 600));
    surface.fail("Page.captureScreenshot", new WebViewFailure(WebViewFailureKind.TimedOut));
    vi.useFakeTimers({ toFake: ["Date"] });

    expect(await captureAsync()).toBe("captured");

    expect([seen.map(([, isLaidOut]) => isLaidOut), surface.calls.map(t => t.method), surface.calls[1]?.timeoutMilliseconds]).toEqual([[true],
      ["Page.getLayoutMetrics", "Page.captureScreenshot", "Emulation.setDeviceMetricsOverride", "Page.getLayoutMetrics", "Emulation.clearDeviceMetricsOverride"], 1_000]);
  });

  it("ends a draw check whose capture never answers by its own second, and lays the page out then", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    surface.answer("Page.getLayoutMetrics", metricsOf(800, 600));
    surface.hang("Page.captureScreenshot");

    const capturing: Promise<string> = captureAsync();
    await vi.advanceTimersByTimeAsync(999);
    const before: string[] = surface.calls.map(t => t.method);
    await vi.advanceTimersByTimeAsync(1);

    expect([before, await capturing, seen.map(([, isLaidOut]) => isLaidOut), surface.calls.map(t => t.method).slice(2)]).toEqual([
      ["Page.getLayoutMetrics", "Page.captureScreenshot"], "captured", [true], ["Emulation.setDeviceMetricsOverride", "Page.getLayoutMetrics", "Emulation.clearDeviceMetricsOverride"]]);
  });

  it("fails as timed out, laying nothing out, when the draw check runs out of the call's own time", async () => {
    surface.answer("Page.getLayoutMetrics", metricsOf(800, 600));
    surface.fail("Page.captureScreenshot", new WebViewFailure(WebViewFailureKind.TimedOut));

    await expect(captureAsync(options(500))).rejects.toBeInstanceOf(PageAnswerTimedOutException);

    expect([seen, surface.calls.map(t => t.method)]).toEqual([[], ["Page.getLayoutMetrics", "Page.captureScreenshot"]]);
  });

  it("fails as hidden when the laid-out page still has no size, and lets the size go", async () => {
    surface.answer("Page.getLayoutMetrics", metricsOf(0, 0));

    await expect(captureAsync()).rejects.toBeInstanceOf(PageHiddenException);

    expect([seen, surface.calls.map(t => t.method).at(-1)]).toEqual([[], "Emulation.clearDeviceMetricsOverride"]);
  });

  it("logs a release that fails, but not the release of a view that closed, crashed or lost its profile", async () => {
    sizedAfterLayout();
    surface.fail("Emulation.clearDeviceMetricsOverride", new WebViewFailure(WebViewFailureKind.Protocol, -32000, "Engine busy"));
    await captureAsync();
    for (const kind of [WebViewFailureKind.ViewClosed, WebViewFailureKind.Crashed, WebViewFailureKind.ProfileCleared]) {
      surface.fail("Emulation.clearDeviceMetricsOverride", new WebViewFailure(kind));
      expect(await captureAsync(), kind).toBe("captured");
    }

    expect(writtenTo(log)).toEqual([expect.stringMatching(/^The view view-1 may keep the size it was laid out at: /)]);
  });

  it("passes on a release's failure that isn't a call's, since only a bug makes one", async () => {
    sizedAfterLayout();
    const bug: TypeError = new TypeError("The release broke.");
    surface.answerWith("Emulation.clearDeviceMetricsOverride", () => {
      throw bug;
    });

    await expect(captureAsync()).rejects.toBe(bug);
    expect(writtenTo(log)).toEqual([]);
  });
});
