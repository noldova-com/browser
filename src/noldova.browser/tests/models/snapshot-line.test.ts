/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { SnapshotLine } from "../../src/models/snapshot-line.ts";

describe("SnapshotLine", () => {
  it("keeps the depth, role, name, value, mask, the element's index, the host's number and the node, none by default", () => {
    expect({ ...new SnapshotLine(2, "textbox", "PIN", "", true, 4) }).toEqual({
      depth: 2, role: "textbox", name: "PIN", value: "", isMasked: true, index: 4, host: null, backendNodeId: null });
    expect({ ...new SnapshotLine(2, "button", "Buy", "", false, null, 1, 27) }).toEqual({
      depth: 2, role: "button", name: "Buy", value: "", isMasked: false, index: null, host: 1, backendNodeId: 27 });
  });
});
