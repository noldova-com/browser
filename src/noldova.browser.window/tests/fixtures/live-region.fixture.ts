/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { vi } from "vitest";

export class LiveRegionFixture {
  private static readonly SELECTOR: string = ".cdk-live-announcer-element";
  private static readonly LIMIT: number = 5000;

  public static region(): Element | null {
    return document.querySelector(LiveRegionFixture.SELECTOR);
  }

  public static async spokenAsync(limit: number = LiveRegionFixture.LIMIT): Promise<string> {
    const region = LiveRegionFixture.region();
    if (region === null)
      throw new Error("The page has no live region to wait on.");
    let spoken = "";
    const observer = new MutationObserver(() => {
      if (spoken.length === 0)
        spoken = region.textContent ?? "";
    });
    observer.observe(region, { childList: true, characterData: true, subtree: true });
    try {
      return await vi.waitFor(() => {
        if (spoken.length === 0)
          throw new Error(`The live region spoke nothing within ${limit} ms.`);
        return spoken;
      }, { timeout: limit });
    }
    finally {
      observer.disconnect();
    }
  }
}
