/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, describe, expect, it } from "vitest";

import { EmulatedMediaFixture } from "./emulated-media.fixture.ts";

describe("EmulatedMediaFixture", () => {
  function matches(): boolean[] {
    return ["(forced-colors: active)", "(prefers-reduced-motion: reduce)"].map(t => matchMedia(t).matches);
  }

  afterEach(async () => {
    await EmulatedMediaFixture.resetAsync();
  });

  it("emulates several features together, each kept until it changes", async () => {
    await EmulatedMediaFixture.emulateAsync("forced-colors", "active");
    await EmulatedMediaFixture.emulateAsync("prefers-reduced-motion", "reduce");
    const both: boolean[] = matches();
    await EmulatedMediaFixture.emulateAsync("forced-colors", "none");

    expect([both, matches()]).toEqual([[true, true], [false, true]]);
  });

  it("puts every feature back at once", async () => {
    await EmulatedMediaFixture.emulateAsync("forced-colors", "active");
    await EmulatedMediaFixture.emulateAsync("prefers-reduced-motion", "reduce");

    await EmulatedMediaFixture.resetAsync();

    expect(matches()).toEqual([false, false]);
  });
});
