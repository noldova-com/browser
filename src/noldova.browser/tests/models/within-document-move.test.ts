/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { WithinDocumentMove } from "../../src/models/within-document-move.ts";

describe("WithinDocumentMove", () => {
  it("keeps its fields", () => {
    const move: WithinDocumentMove = new WithinDocumentMove("F1", "https://docs.example/guide#setup");

    expect([move.frameId, move.url]).toEqual(["F1", "https://docs.example/guide#setup"]);
  });
});
