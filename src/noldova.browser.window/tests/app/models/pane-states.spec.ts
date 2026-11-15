/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { PaneStates } from "../../../src/app/models/pane-states.ts";

describe("PaneStates", () => {
  it("lists the seven pane states", () => {
    expect(PaneStates.all).toEqual(["Empty", "Loading", "Loaded", "Failed", "Refused", "Crashed", "Unavailable"]);
  });

  it("lists each state once", () => {
    expect(new Set(PaneStates.all).size).toBe(PaneStates.all.length);
  });

  it("includes each listed state", () => {
    for (const state of PaneStates.all)
      expect(PaneStates.includes(state)).toBe(true);
  });

  it("refuses a state that differs in case, an unknown state and an empty state", () => {
    expect(PaneStates.includes("loaded")).toBe(false);
    expect(PaneStates.includes("closed")).toBe(false);
    expect(PaneStates.includes("")).toBe(false);
  });
});
