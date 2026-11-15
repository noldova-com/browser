/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, describe, expect, it } from "vitest";

import { EmulatedMediaFixture } from "./emulated-media.fixture.ts";
import { MotionFixture } from "./motion.fixture.ts";

describe("MotionFixture", () => {
  afterEach(async () => {
    await EmulatedMediaFixture.resetAsync();
  });

  it("asks for reduced motion and takes the request back", async () => {
    await MotionFixture.reduceAsync();
    const reduced: boolean = matchMedia("(prefers-reduced-motion: reduce)").matches;
    await MotionFixture.resetAsync();

    expect([reduced, matchMedia("(prefers-reduced-motion: reduce)").matches]).toEqual([true, false]);
  });
});
