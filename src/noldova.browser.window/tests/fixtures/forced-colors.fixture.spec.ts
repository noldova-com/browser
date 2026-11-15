/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, describe, expect, it } from "vitest";

import { EmulatedMediaFixture } from "./emulated-media.fixture.ts";
import { ForcedColorsFixture } from "./forced-colors.fixture.ts";

describe("ForcedColorsFixture", () => {
  afterEach(async () => {
    await EmulatedMediaFixture.resetAsync();
  });

  it("turns forced colors on and off, and resolves a system color to the forced palette's", async () => {
    const before: string = ForcedColorsFixture.resolve("Canvas");

    await ForcedColorsFixture.activateAsync();
    const forced: boolean[] = [matchMedia("(forced-colors: active)").matches, ForcedColorsFixture.resolve("Highlight") !== ForcedColorsFixture.resolve("Canvas")];
    await ForcedColorsFixture.resetAsync();

    expect([forced, matchMedia("(forced-colors: active)").matches, ForcedColorsFixture.resolve("Canvas"), document.querySelectorAll("body > span").length]).toEqual([[true, true], false, before, 0]);
  });
});
