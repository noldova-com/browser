/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EmulatedMediaFixture } from "./emulated-media.fixture.ts";

export class MotionFixture {
  private static readonly FEATURE: string = "prefers-reduced-motion";

  public static reduceAsync(): Promise<unknown> {
    return EmulatedMediaFixture.emulateAsync(MotionFixture.FEATURE, "reduce");
  }

  public static resetAsync(): Promise<unknown> {
    return EmulatedMediaFixture.emulateAsync(MotionFixture.FEATURE, "no-preference");
  }
}
