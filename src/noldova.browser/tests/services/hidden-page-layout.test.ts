/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";
import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
import { beforeEach, describe, expect, it } from "vitest";

import { MalformedReplyException } from "../../src/exceptions/malformed-reply.exception.ts";
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
  let laidOut: boolean[];

  function holdAsync(): Promise<void> {
    const options: CallOptions = new CallOptions(new AbortController().signal, Date.now() + 5_000, 1_000, false, new ActionProgress(() => undefined));
    return new HiddenPageLayout(new ViewCalls(surface.relay), log).holdAsync("view-1", options, async isLaidOut => {
      presses += 1;
      laidOut.push(isLaidOut);
    });
  }

  function sizedAfterLayout(): void {
    surface.answerWith("Page.getLayoutMetrics", () => surface.calls.at(-2)?.method === "Emulation.setDeviceMetricsOverride" ? viewportOf(1280, 800) : viewportOf(0, 0));
  }

  beforeEach(() => {
    surface = new ScriptedViews(["view-1"]);
    surface.acknowledge("Emulation.setDeviceMetricsOverride", "Emulation.clearDeviceMetricsOverride");
    log = new FakeModuleLog();
    presses = 0;
    laidOut = [];
  });

  it("presses on a page that has a size as it is", async () => {
    surface.answer("Page.getLayoutMetrics", viewportOf(800, 600));

    await holdAsync();

    expect([laidOut, surface.calls.map(t => t.method)]).toEqual([[false], ["Page.getLayoutMetrics"]]);
  });

  it("lays a page with no size out at 1280 by 800 for the press, and lets the size go after it", async () => {
    sizedAfterLayout();

    await holdAsync();

    expect(laidOut).toEqual([true]);
    expect(surface.calls.map(t => [t.method, t.params])).toEqual([["Page.getLayoutMetrics", {}],
      ["Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 0, mobile: false }], ["Page.getLayoutMetrics", {}],
      ["Emulation.clearDeviceMetricsOverride", {}]]);
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
