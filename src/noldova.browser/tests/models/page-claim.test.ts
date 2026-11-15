/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { PageClaim } from "../../src/models/page-claim.ts";

describe("PageClaim", () => {
  it("says whether the page is the window's now, and whether it already was", () => {
    const claim: PageClaim = new PageClaim(true, false);

    expect([claim.isClaimed, claim.isHere]).toEqual([true, false]);
  });
});
