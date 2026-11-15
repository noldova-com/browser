/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { NodePath } from "../../src/models/node-path.ts";

describe("NodePath", () => {
  it("keeps its fields", () => {
    const path: NodePath = new NodePath({ backendNodeId: 3 }, [{ backendNodeId: 1 }, { backendNodeId: 2 }]);

    expect([path.node, path.ancestors]).toEqual([{ backendNodeId: 3 }, [{ backendNodeId: 1 }, { backendNodeId: 2 }]]);
  });
});
