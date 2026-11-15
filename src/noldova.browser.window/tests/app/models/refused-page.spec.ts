/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { RefusedPage } from "../../../src/app/models/refused-page.ts";

describe("RefusedPage", () => {
  it("keeps the agent, the refused address and its origin", () => {
    const refused: RefusedPage = new RefusedPage("Scout", "https://docs.example.com/a", "https://docs.example.com");

    expect([refused.agentName, refused.url, refused.origin]).toEqual(["Scout", "https://docs.example.com/a", "https://docs.example.com"]);
  });
});
