/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import * as api from "../../src/api/index.ts";
import { BrowserLimits } from "../../src/models/browser-limits.ts";
import { RuntimePart } from "../../src/runtime-part.ts";

describe("@noldova/browser/runtime", () => {
  it("exports exactly its public values", () => {
    expect(Object.keys(api).sort()).toEqual(["BrowserLimits", "RuntimePart"]);
    expect(api.BrowserLimits).toBe(BrowserLimits);
    expect(api.RuntimePart).toBe(RuntimePart);
  });
});
