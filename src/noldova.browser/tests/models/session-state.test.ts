/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { SessionState } from "../../src/models/session-state.ts";
import { SnapshotReference } from "../../src/models/snapshot-reference.ts";

describe("SessionState", () => {
  it("issues each reference the next number, and finds it by its id", () => {
    const state: SessionState = new SessionState();

    const ids: readonly string[] = [state.issue(new SnapshotReference("view", "L1", 4)), state.issue(new SnapshotReference("view", "L1", 5))];

    expect([ids, state.referenceOf("e2"), state.referenceOf("e3")]).toStrictEqual([["e1", "e2"], new SnapshotReference("view", "L1", 5), undefined]);
  });

  it("drops one view's references alone, and counts on after them", () => {
    const state: SessionState = new SessionState();
    state.issue(new SnapshotReference("view", "L1", 4));
    state.issue(new SnapshotReference("other", "L2", 5));

    state.dropReferences("view");

    expect([state.referenceOf("e1"), state.referenceOf("e2"), state.issue(new SnapshotReference("view", "L1", 6))])
      .toStrictEqual([undefined, new SnapshotReference("other", "L2", 5), "e3"]);
  });

  it("tells a reference it issued, dropped too, from one it never issued", () => {
    const state: SessionState = new SessionState();
    state.issue(new SnapshotReference("view", "L1", 4));
    state.issue(new SnapshotReference("view", "L1", 5));
    state.dropReferences("view");

    expect(["e1", "e2", "e3", "e0", "e01", "e1.0", "x1", "e", "1", ""].map(t => state.wasIssued(t)))
      .toEqual([true, true, false, false, false, false, false, false, false, false]);
  });

  it("keeps a console cursor per view, from 0, and drops one view's", () => {
    const state: SessionState = new SessionState();
    state.moveCursor("view", 40);
    state.moveCursor("other", 7);

    state.dropCursor("view");

    expect([state.cursorOf("view"), state.cursorOf("other"), state.cursorOf("never")]).toEqual([0, 7, 0]);
  });
});
