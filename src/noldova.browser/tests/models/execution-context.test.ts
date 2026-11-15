/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { ExecutionContext } from "../../src/models/execution-context.ts";

describe("ExecutionContext", () => {
  it("keeps its fields", () => {
    const executionContext: ExecutionContext = new ExecutionContext(3, "u-3", "noldova-browser-changes", "F1");

    expect([executionContext.id, executionContext.uniqueId, executionContext.name, executionContext.frameId]).toEqual([3, "u-3", "noldova-browser-changes", "F1"]);
  });
});
