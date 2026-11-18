/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { SnapshotReference } from "../../src/models/snapshot-reference.ts";

describe("SnapshotReference", () => {
  it("keeps the view, the document and the element's index in the page", () => {
    expect({ ...new SnapshotReference("view-1", "L1", 7) }).toEqual({ viewId: "view-1", documentId: "L1", index: 7 });
  });
});
