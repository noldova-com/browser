/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PlaceholderTracker } from "../../../src/app/services/placeholder-tracker.ts";
import { FakeWebView, FakeWebViews } from "../../fixtures/fake-web-views.fixture.ts";

describe("PlaceholderTracker", () => {
  let element: HTMLElement = document.createElement("div");
  let view: FakeWebView = new FakeWebViews().open("workspace-1");

  beforeEach(() => {
    element = document.createElement("div");
    element.style.cssText = "position: fixed; left: 10px; top: 40px; width: 200px; height: 100px";
    document.body.append(element);
    view = new FakeWebViews().open("workspace-1");
  });

  afterEach(() => {
    element.remove();
  });

  it("mounts the view in the placeholder as it starts, hidden, where it fills the placeholder and keeps its box", () => {
    const tracker: PlaceholderTracker = new PlaceholderTracker(element, view);
    const box: DOMRect = view.element.getBoundingClientRect();

    expect([view.calls, view.host === element, view.isShown, view.element.checkVisibility({ visibilityProperty: true })]).toEqual([["mount"], true, false, false]);
    expect([box.left, box.top, box.width, box.height]).toEqual([10, 40, 200, 100]);
    tracker.dispose();
  });

  it("shows the view while its page is placed and hides it when it isn't, mounting it no more", () => {
    const tracker: PlaceholderTracker = new PlaceholderTracker(element, view);

    tracker.place(true);
    const isShown: boolean = view.element.checkVisibility({ visibilityProperty: true });
    tracker.place(false);

    expect([view.calls, isShown, view.isShown]).toEqual([["mount", "show", "hide"], true, false]);
    tracker.dispose();
  });

  it("follows a resize of the placeholder with no call", () => {
    const tracker: PlaceholderTracker = new PlaceholderTracker(element, view);
    tracker.place(true);

    element.style.width = "300px";
    const box: DOMRect = view.element.getBoundingClientRect();

    expect([box.left, box.top, box.width, box.height, view.calls]).toEqual([10, 40, 300, 100, ["mount", "show"]]);
    tracker.dispose();
  });

  it("makes no call for a place that keeps the view as it is, and none at a dispose of a view it never showed", () => {
    const tracker: PlaceholderTracker = new PlaceholderTracker(element, view);
    tracker.place(false);
    tracker.place(true);
    tracker.place(true);
    const unshown: FakeWebView = new FakeWebViews().open("workspace-1");
    const hidden: PlaceholderTracker = new PlaceholderTracker(document.createElement("div"), unshown);

    hidden.dispose();

    expect([view.calls, unshown.calls]).toEqual([["mount", "show"], ["mount"]]);
  });

  it("hides the view once disposed, and a second dispose or a later place does nothing", () => {
    const tracker: PlaceholderTracker = new PlaceholderTracker(element, view);
    tracker.place(true);

    tracker.dispose();
    tracker.dispose();
    tracker.place(true);

    expect([view.calls, view.isShown, view.element.checkVisibility({ visibilityProperty: true })]).toEqual([["mount", "show", "hide"], false, false]);
  });

  it("does nothing more for a view the host closed", () => {
    const tracker: PlaceholderTracker = new PlaceholderTracker(element, view);
    tracker.place(true);

    view.closeFromHost();
    tracker.place(true);
    tracker.dispose();

    expect([view.calls, view.isShown, element.childElementCount]).toEqual([["mount", "show"], false, 0]);
  });

  it("neither mounts nor shows a view that closed before it started", () => {
    view.close();

    const tracker: PlaceholderTracker = new PlaceholderTracker(element, view);
    tracker.place(true);
    tracker.dispose();

    expect([view.calls, element.childElementCount]).toEqual([["close"], 0]);
  });
});
