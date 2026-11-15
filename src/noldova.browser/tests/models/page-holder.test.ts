/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ClientClosure, RequestContext } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { PageHolder } from "../../src/models/page-holder.ts";

function from(connection: number, window: number | null): RequestContext {
  return new RequestContext("shell", null, new AbortController().signal, connection, window);
}

describe("PageHolder", () => {
  it("is the window of the request it came from, and no other", () => {
    const holder: PageHolder = new PageHolder(from(1, 2));

    expect([holder.connection, holder.window, holder.isOf(from(1, 2)), holder.isOf(from(1, 3)), holder.isOf(from(2, 2)), holder.isOf(from(1, null))])
      .toEqual([1, 2, true, false, false, false]);
  });

  it("goes with its window's closing for good, and with its connection's", () => {
    const holder: PageHolder = new PageHolder(from(1, 2));

    expect([new ClientClosure(1, 2), new ClientClosure(1, null), new ClientClosure(1, 3), new ClientClosure(2, null)].map(t => holder.isClosedBy(t)))
      .toEqual([true, true, false, false]);
  });
});
