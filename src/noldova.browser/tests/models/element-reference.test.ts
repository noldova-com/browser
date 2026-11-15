/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { ElementReference } from "../../src/models/element-reference.ts";

describe("ElementReference", () => {
  it("keeps its fields", () => {
    const elementReference: ElementReference = new ElementReference("view-1", "L1", 7);

    expect([elementReference.viewId, elementReference.documentId, elementReference.backendNodeId]).toEqual(["view-1", "L1", 7]);
  });
});
