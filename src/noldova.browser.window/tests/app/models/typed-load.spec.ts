/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { TypedLoad } from "../../../src/app/models/typed-load.ts";

describe("TypedLoad", () => {
  it("starts with its entry, no redirect and its own navigation waiting for the bridge's answer", () => {
    const entry: object = {};
    const load: TypedLoad = new TypedLoad(entry);

    expect([load.entry === entry, load.hops, load.isAnswered]).toEqual([true, 0, false]);
  });

  it("counts each redirect it follows, and is answered once every navigation it waits for is", () => {
    const load: TypedLoad = new TypedLoad({});
    load.follow();
    load.follow();
    load.answer();
    load.answer();
    const waiting: boolean = load.isAnswered;
    load.answer();

    expect([load.hops, waiting, load.isAnswered]).toEqual([2, false, true]);
  });
});
