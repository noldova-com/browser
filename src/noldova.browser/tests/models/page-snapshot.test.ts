/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { PageSnapshot } from "../../src/models/page-snapshot.ts";
import { SnapshotLine } from "../../src/models/snapshot-line.ts";

describe("PageSnapshot", () => {
  it("keeps the title, the lines, whether they were cut, left out deeper lines or start from the view, and what wasn't read or searched", () => {
    const lines: readonly SnapshotLine[] = [new SnapshotLine(0, "RootWebArea", "Cart", "", false, null)];

    expect({ ...new PageSnapshot("Cart", lines, true, false, true) }).toEqual({
      title: "Cart", lines, isCut: true, isDeeper: false, isFromView: true, unread: 0, unsearched: [] });
    expect({ ...new PageSnapshot("Cart", lines, true, false, false, 2, ["<table>"]) }).toEqual({
      title: "Cart", lines, isCut: true, isDeeper: false, isFromView: false, unread: 2, unsearched: ["<table>"] });
  });
});
