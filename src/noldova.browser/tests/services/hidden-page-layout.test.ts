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

import { MalformedReplyException } from "../../src/exceptions/malformed-reply.exception.ts";
import { PageAnswerTimedOutException } from "../../src/exceptions/page-answer-timed-out.exception.ts";
import { PageCrashedException } from "../../src/exceptions/page-crashed.exception.ts";
import { PageNotShowingException } from "../../src/exceptions/page-not-showing.exception.ts";
import { ActionProgress } from "../../src/models/action-progress.ts";
import { CallOptions } from "../../src/models/call-options.ts";
import { HiddenPageLayout } from "../../src/services/hidden-page-layout.ts";
import { ViewCalls } from "../../src/services/view-calls.ts";
import type { JsonObject } from "../../src/types/json-value.ts";
import { writtenTo } from "../fixtures/desktop-fakes.fixture.ts";
import { ScriptedViews } from "../fixtures/scripted-views.fixture.ts";

function viewportOf(width: number, height: number): JsonObject {
  return { cssVisualViewport: { pageX: 0, pageY: 0, clientWidth: width, clientHeight: height } };
}

describe("HiddenPageLayout", () => {
  let surface: ScriptedViews;
  let log: FakeModuleLog;
  let presses: number;

  const WAKE: JsonObject = { format: "png", clip: { x: 0, y: 0, width: 1, height: 1, scale: 1 } };

  function holdAsync(milliseconds: number = 5_000): Promise<void> {
    const options: CallOptions = new CallOptions(new AbortController().signal, Date.now() + milliseconds, 1_000, false, new ActionProgress(() => undefined));
    return new HiddenPageLayout(new ViewCalls(surface.relay), log).holdAsync("view-1", options, async () => {
      presses += 1;
    });
  }

  function sizedAfterLayout(): void {
    surface.answerWith("Page.getLayoutMetrics", () => surface.calls.at(-2)?.method === "Emulation.setDeviceMetricsOverride" ? viewportOf(1280, 800) : viewportOf(0, 0));
  }

  beforeEach(() => {
    surface = new ScriptedViews(["view-1"]);
    surface.acknowledge("Emulation.setDeviceMetricsOverride", "Emulation.clearDeviceMetricsOverride", "Page.captureScreenshot");
    log = new FakeModuleLog();
    presses = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("presses on a page that has a size as it is, once it has asked the page for one pixel, which lets a hidden view's new document take the press, within a quarter second", async () => {
    surface.answer("Page.getLayoutMetrics", viewportOf(800, 600));
    vi.useFakeTimers({ toFake: ["Date"] });

    await holdAsync();

    expect([presses, surface.calls.map(t => t.method), surface.calls[1]?.params, surface.calls[1]?.timeoutMilliseconds])
      .toEqual([1, ["Page.getLayoutMetrics", "Page.captureScreenshot"], WAKE, 250]);
  });

  it("presses after a pixel the hidden view doesn't draw within its quarter second, which ends before the call's own time", async () => {
    surface.answer("Page.getLayoutMetrics", viewportOf(800, 600));
    surface.fail("Page.captureScreenshot", new WebViewFailure(WebViewFailureKind.TimedOut));
    vi.useFakeTimers({ toFake: ["Date"] });

    await holdAsync();

    expect([presses, surface.calls.map(t => t.method)]).toEqual([1, ["Page.getLayoutMetrics", "Page.captureScreenshot"]]);
  });

  it("presses once a pixel that never answers has had its quarter second, and not before", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    surface.answer("Page.getLayoutMetrics", viewportOf(800, 600));
    surface.hang("Page.captureScreenshot");

    const holding: Promise<void> = holdAsync();
    await vi.advanceTimersByTimeAsync(249);
    const before: number = presses;
    await vi.advanceTimersByTimeAsync(1);
    await holding;

    expect([before, presses]).toEqual([0, 1]);
  });

  it("fails as timed out, pressing nothing, when the pixel runs out of the call's own time", async () => {
    surface.answer("Page.getLayoutMetrics", viewportOf(800, 600));
    surface.fail("Page.captureScreenshot", new WebViewFailure(WebViewFailureKind.TimedOut));

    await expect(holdAsync(200)).rejects.toBeInstanceOf(PageAnswerTimedOutException);

    expect(presses).toBe(0);
  });

  it("presses nothing when asking for the pixel fails otherwise, and lets a laid-out size go", async () => {
    sizedAfterLayout();
    surface.fail("Page.captureScreenshot", new WebViewFailure(WebViewFailureKind.Crashed));

    await expect(holdAsync()).rejects.toBeInstanceOf(PageCrashedException);

    expect([presses, surface.calls.map(t => t.method).slice(-2)]).toEqual([0, ["Page.captureScreenshot", "Emulation.clearDeviceMetricsOverride"]]);
  });

  it("lays a page with no size out at 1280 by 800 for the press, and lets the size go after it", async () => {
    sizedAfterLayout();

    await holdAsync();

    expect(presses).toBe(1);
    expect(surface.calls.map(t => [t.method, t.params])).toEqual([["Page.getLayoutMetrics", {}],
      ["Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 0, mobile: false }], ["Page.getLayoutMetrics", {}],
      ["Page.captureScreenshot", WAKE], ["Emulation.clearDeviceMetricsOverride", {}]]);
  });

  it("presses nothing on a page that still has no size once laid out, and lets the size go", async () => {
    surface.answer("Page.getLayoutMetrics", viewportOf(0, 0));

    await expect(holdAsync()).rejects.toBeInstanceOf(PageNotShowingException);

    expect([presses, surface.calls.map(t => t.method).at(-1)]).toEqual([0, "Emulation.clearDeviceMetricsOverride"]);
  });

  it("fails as malformed on metrics without a viewport or its size", async () => {
    const replies: readonly JsonObject[] = [{}, { cssVisualViewport: [] }, { cssVisualViewport: { clientWidth: 800 } }, { cssVisualViewport: { clientWidth: "800", clientHeight: 600 } }];
    for (const reply of replies) {
      surface.answer("Page.getLayoutMetrics", reply);
      await expect(holdAsync(), JSON.stringify(reply)).rejects.toBeInstanceOf(MalformedReplyException);
    }
    expect(presses).toBe(0);
  });

  it("logs a release that fails, but not the release of a view that closed, crashed or lost its profile", async () => {
    sizedAfterLayout();
    surface.fail("Emulation.clearDeviceMetricsOverride", new WebViewFailure(WebViewFailureKind.Protocol, -32000, "Engine busy"));
    await holdAsync();
    for (const kind of [WebViewFailureKind.ViewClosed, WebViewFailureKind.Crashed, WebViewFailureKind.ProfileCleared]) {
      surface.fail("Emulation.clearDeviceMetricsOverride", new WebViewFailure(kind));
      await holdAsync();
    }

    expect([presses, writtenTo(log)]).toEqual([4, [expect.stringMatching(/^The view view-1 may keep the size it was laid out at: /)]]);
  });

  it("passes on a release's failure that isn't a call's, since only a bug makes one", async () => {
    sizedAfterLayout();
    const bug: TypeError = new TypeError("The release broke.");
    surface.answerWith("Emulation.clearDeviceMetricsOverride", () => {
      throw bug;
    });

    await expect(holdAsync()).rejects.toBe(bug);
    expect(writtenTo(log)).toEqual([]);
  });
});
