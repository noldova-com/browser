/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ClientClosure, RequestContext } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { PageClaim } from "../../src/models/page-claim.ts";
import { PageHolders } from "../../src/models/page-holders.ts";

function from(connection: number, window: number | null): RequestContext {
  return new RequestContext("shell", null, new AbortController().signal, connection, window);
}

describe("PageHolders", () => {
  it("gives a page to the first window that claims it, refuses it to another, and says whether it already was the window's", () => {
    const holders: PageHolders = new PageHolders();

    const claims: readonly PageClaim[] = [holders.claim("page-1", from(1, 1)), holders.claim("page-1", from(1, 1)), holders.claim("page-1", from(1, 2)),
      holders.claim("page-1", from(2, 1))];

    expect(claims).toEqual([
      new PageClaim(true, false), new PageClaim(true, true), new PageClaim(false, false), new PageClaim(false, false)
    ]);
    expect([holders.isHeldElsewhere("page-1", from(1, 2)), holders.isHeldElsewhere("page-1", from(1, 1)), holders.isHeldElsewhere("page-2", from(1, 2))])
      .toEqual([true, false, false]);
  });

  it("frees a page its window lets go of", () => {
    const holders: PageHolders = new PageHolders();
    holders.claim("page-1", from(1, 1));

    holders.letGo("page-1");

    expect(holders.claim("page-1", from(1, 2)).isClaimed).toBe(true);
  });

  it("frees the pages of a window that closes for good, and of every window of a connection that goes", () => {
    const holders: PageHolders = new PageHolders();
    holders.claim("page-1", from(1, 1));
    holders.claim("page-2", from(1, 2));
    holders.claim("page-3", from(2, 1));
    holders.claim("page-4", from(3, 1));

    holders.close(new ClientClosure(1, 1));
    holders.close(new ClientClosure(3, null));

    expect(["page-1", "page-2", "page-3", "page-4"].map(t => holders.isHeldElsewhere(t, from(9, 9)))).toEqual([false, true, true, false]);
  });
});
