/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { FolderChanges } from "../fixtures/folder-changes.ts";

describe("FolderChanges", () => {
  it("finds no change in a folder that holds the same names again", () => {
    expect(FolderChanges.between(["a.txt", "b.txt"], ["a.txt", "b.txt"])).toEqual([]);
  });

  it("names a file that stayed, and one that went", () => {
    expect(FolderChanges.between(["a.txt", "b.txt"], ["a.txt", "0f6c2d1e.tmp"])).toEqual(["+ 0f6c2d1e.tmp", "- b.txt"]);
  });
});
