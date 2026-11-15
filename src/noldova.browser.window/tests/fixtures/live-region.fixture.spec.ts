/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, describe, expect, it } from "vitest";

import { LiveRegionFixture } from "./live-region.fixture.ts";

describe("LiveRegionFixture", () => {
  afterEach(() => {
    LiveRegionFixture.region()?.remove();
  });

  it("fails when the page has no live region", async () => {
    expect(LiveRegionFixture.region()).toBeNull();
    await expect(LiveRegionFixture.spokenAsync()).rejects.toThrow("The page has no live region to wait on.");
  });

  it("gives the next text the region speaks", async () => {
    const region = document.body.appendChild(document.createElement("div"));
    region.className = "cdk-live-announcer-element";
    const spoken = LiveRegionFixture.spokenAsync();

    region.append(document.createElement("span"));
    region.textContent = "Saved.";

    expect([LiveRegionFixture.region(), await spoken]).toEqual([region, "Saved."]);
  });

  it("fails when the region says nothing in time", async () => {
    document.body.appendChild(document.createElement("div")).className = "cdk-live-announcer-element";

    await expect(LiveRegionFixture.spokenAsync(10)).rejects.toThrow("The live region spoke nothing within 10 ms.");
  });
});
