/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import type { ISessionReferenceVisitor } from "../../src/interfaces/i-session-reference-visitor.ts";
import { ElementReference } from "../../src/models/element-reference.ts";
import type { SnapshotReference } from "../../src/models/snapshot-reference.ts";

const NAMING: ISessionReferenceVisitor<string> = {
  visitSnapshotElement: (reference: SnapshotReference): string => `kept ${reference.index}`,
  visitClosedElement: (reference: ElementReference): string => `closed ${reference.backendNodeId}`
};

describe("ElementReference", () => {
  it("keeps its fields", () => {
    const elementReference: ElementReference = new ElementReference("view-1", "L1", 7);

    expect([elementReference.viewId, elementReference.documentId, elementReference.backendNodeId]).toEqual(["view-1", "L1", 7]);
  });

  it("is visited as an element read inside a closed shadow root by its node", () => {
    expect(new ElementReference("view-1", "L1", 7).accept(NAMING)).toBe("closed 7");
  });
});
