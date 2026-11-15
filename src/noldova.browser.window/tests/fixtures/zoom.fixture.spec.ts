/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { ZoomFixture } from "./zoom.fixture.ts";

describe("ZoomFixture", () => {
  const ratio: number = devicePixelRatio;

  function sizes(): number[] {
    const outer: Window = window.top ?? window;
    return [outer.innerWidth, outer.innerHeight, innerWidth, innerHeight];
  }

  afterEach(async () => {
    await ZoomFixture.resetAsync();
  });

  it("gives each CSS pixel the factor's device pixels and keeps the window's size", async () => {
    const before: number[] = sizes();

    await ZoomFixture.zoomAsync(2);

    await vi.waitFor(() => expect([devicePixelRatio, matchMedia(`(resolution: ${2 * ratio}dppx)`).matches, sizes()]).toEqual([2 * ratio, true, before]));
  });

  it("puts the device pixels back and keeps the window's size", async () => {
    const before: number[] = sizes();
    await ZoomFixture.zoomAsync(2);

    await ZoomFixture.resetAsync();

    await vi.waitFor(() => expect([devicePixelRatio, sizes()]).toEqual([ratio, before]));
  });
});
