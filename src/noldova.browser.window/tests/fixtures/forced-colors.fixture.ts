/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EmulatedMediaFixture } from "./emulated-media.fixture.ts";

export class ForcedColorsFixture {
  private static readonly FEATURE: string = "forced-colors";

  public static activateAsync(): Promise<unknown> {
    return EmulatedMediaFixture.emulateAsync(ForcedColorsFixture.FEATURE, "active");
  }

  public static resetAsync(): Promise<unknown> {
    return EmulatedMediaFixture.emulateAsync(ForcedColorsFixture.FEATURE, "none");
  }

  public static resolve(color: string): string {
    const probe = document.body.appendChild(document.createElement("span"));
    probe.style.color = color;
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }
}
