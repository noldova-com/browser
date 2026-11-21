/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { OpeningPage } from "../../../src/app/models/opening-page.ts";

describe("OpeningPage", () => {
  it("keeps the page's place, and says another window took the page only once it is taken", () => {
    const opening: OpeningPage = new OpeningPage({ profileKey: "workspace-1", url: "https://docs.example.com/" });
    const before: boolean = opening.isTaken;

    opening.take();

    expect([opening.place, before, opening.isTaken]).toEqual([{ profileKey: "workspace-1", url: "https://docs.example.com/" }, false, true]);
  });
});
