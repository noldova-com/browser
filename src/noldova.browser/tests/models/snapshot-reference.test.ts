/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import type { ISessionReferenceVisitor } from "../../src/interfaces/i-session-reference-visitor.ts";
import type { ElementReference } from "../../src/models/element-reference.ts";
import { SnapshotReference } from "../../src/models/snapshot-reference.ts";

const NAMING: ISessionReferenceVisitor<string> = {
  visitSnapshotElement: (reference: SnapshotReference): string => `kept ${reference.index}`,
  visitClosedElement: (reference: ElementReference): string => `closed ${reference.backendNodeId}`
};

describe("SnapshotReference", () => {
  it("keeps the view, the document and the element's index in the page", () => {
    expect({ ...new SnapshotReference("view-1", "L1", 7) }).toEqual({ viewId: "view-1", documentId: "L1", index: 7 });
  });

  it("is visited as an element the page's snapshot function kept", () => {
    expect(new SnapshotReference("view-1", "L1", 7).accept(NAMING)).toBe("kept 7");
  });
});
