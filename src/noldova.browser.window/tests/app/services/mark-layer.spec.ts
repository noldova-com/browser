/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageAction, PageActivity, PageActivityState } from "@noldova/browser.protocol";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MarkLayer } from "../../../src/app/services/mark-layer.ts";
import { type FakeWebView, FakeWebViews } from "../../fixtures/fake-web-views.fixture.ts";

const CLICKING: PageActivity = PageActivity.fromJson({
  instance: "0f8fad5b-d9cb-469f-a165-70867728950e", activity: "5b1c2a7e-3d4f-4e8a-9b0c-1d2e3f4a5b6c", agentName: "Scout", action: PageAction.Clicking, state: PageActivityState.Acting,
  box: { x: 40, y: 30, width: 120, height: 24 }, point: { x: 100, y: 42 }, refusal: null, isHandedOver: false
});

describe("MarkLayer", () => {
  const views: FakeWebView[] = [];
  const hosts: HTMLElement[] = [];

  function open(): FakeWebView {
    const view: FakeWebView = new FakeWebViews().open("workspace-1");
    const host: HTMLElement = document.createElement("div");
    host.style.cssText = "position: fixed; left: 10px; top: 20px; width: 480px; height: 320px";
    document.body.append(host);
    view.mount(host);
    view.show();
    views.push(view);
    hosts.push(host);
    return view;
  }

  function rem(): number {
    return Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  }

  function textOf(view: FakeWebView): string | undefined {
    return view.layerElement?.querySelector(".nol-browser-agent-mark-text")?.textContent?.trim();
  }

  afterEach(() => {
    for (const view of views.splice(0))
      view.close();
    for (const host of hosts.splice(0))
      host.remove();
  });

  it("shows the mark in the view's layer over the view's place, follows each change of what the call aims at, and closes the layer once", async () => {
    const view: FakeWebView = open();
    const failures: unknown[] = [];

    const mark: MarkLayer = MarkLayer.open(view, CLICKING, 1, t => failures.push(t));
    await vi.waitFor(() => expect(textOf(view)).toBe("Scout · clicking"));
    const ring: DOMRect | undefined = view.layerElement?.querySelector(".nol-browser-agent-mark-ring")?.getBoundingClientRect();
    mark.update(PageActivity.fromJson({ ...CLICKING.toJson(), state: PageActivityState.Asking }), 1);
    await vi.waitFor(() => expect(textOf(view)).toBe("Scout · waiting for your answer"));
    mark.close();
    mark.close();

    expect([ring === undefined ? null : [ring.left, ring.top, ring.width, ring.height], view.layersOpened, view.layerElement, document.querySelector("nol-browser-agent-mark"), failures])
      .toEqual([[50 - rem() / 4, 50 - rem() / 4, 120 + rem() / 2, 24 + rem() / 2], 1, null, null, []]);
  });

  it("draws the page's box at the view's zoom, and follows a new zoom", async () => {
    const view: FakeWebView = open();
    const ring = (): readonly number[] | null => {
      const drawn: DOMRect | undefined = view.layerElement?.querySelector(".nol-browser-agent-mark-ring")?.getBoundingClientRect();
      return drawn === undefined ? null : [drawn.left, drawn.top, drawn.width, drawn.height];
    };

    const mark: MarkLayer = MarkLayer.open(view, CLICKING, 1.5, () => undefined);
    await vi.waitFor(() => expect(ring()).toEqual([10 + 60 - rem() / 4, 20 + 45 - rem() / 4, 180 + rem() / 2, 36 + rem() / 2]));
    mark.update(CLICKING, 1);

    await vi.waitFor(() => expect(ring()).toEqual([50 - rem() / 4, 50 - rem() / 4, 120 + rem() / 2, 24 + rem() / 2]));
    mark.close();
  });

  it("changes nothing once Noldova Desktop closed the layer with its view", async () => {
    const view: FakeWebView = open();
    const mark: MarkLayer = MarkLayer.open(view, CLICKING, 1, () => undefined);
    await vi.waitFor(() => expect(textOf(view)).toBe("Scout · clicking"));

    const layer = view.lastLayer;
    const inputs: string[] = [];
    if (layer !== null)
      vi.spyOn(layer, "setInput").mockImplementation(t => void inputs.push(t));

    view.closeFromHost();
    await vi.waitFor(() => expect(view.layerElement).toBeNull());
    mark.update(PageActivity.fromJson({ ...CLICKING.toJson(), state: PageActivityState.Asking }), 1);
    mark.close();

    expect([layer === null, inputs]).toEqual([false, []]);
  });

  it("shows the latest aim when it changes before the layer opens", async () => {
    const view: FakeWebView = open();

    const mark: MarkLayer = MarkLayer.open(view, CLICKING, 1, () => undefined);
    mark.update(PageActivity.fromJson({ ...CLICKING.toJson(), action: PageAction.Typing }), 1);

    await vi.waitFor(() => expect(textOf(view)).toBe("Scout · typing"));
    mark.close();
  });

  it("closes a layer that opens after the mark closed", async () => {
    const view: FakeWebView = open();

    MarkLayer.open(view, CLICKING, 1, () => undefined).close();

    await vi.waitFor(() => expect(view.layersOpened).toBe(1));
    expect([view.layerElement, document.querySelector("nol-browser-agent-mark")]).toEqual([null, null]);
  });

  it("gives a layer that fails to open to its failure, and shows nothing", async () => {
    const view: FakeWebView = open();
    const failure: Error = new Error("The mark didn't load.");
    view.layerFailure = failure;
    const failures: unknown[] = [];

    MarkLayer.open(view, CLICKING, 1, t => failures.push(t));

    await vi.waitFor(() => expect(failures).toEqual([failure]));
    expect(view.layerElement).toBeNull();
  });

  it("takes the refusal of a view that closed while the layer loaded as no failure, and shows nothing", async () => {
    const closing: FakeWebView = open();
    const failing: FakeWebView = open();
    const failure: Error = new Error("The mark didn't load.");
    failing.layerFailure = failure;
    const closingFailures: unknown[] = [];
    const failingFailures: unknown[] = [];

    MarkLayer.open(closing, CLICKING, 1, t => closingFailures.push(t));
    MarkLayer.open(failing, CLICKING, 1, t => failingFailures.push(t));
    closing.close();
    await vi.waitFor(() => expect(failingFailures).toEqual([failure]));

    expect([closingFailures, closing.layersOpened, closing.layerElement]).toEqual([[], 0, null]);
  });
});
