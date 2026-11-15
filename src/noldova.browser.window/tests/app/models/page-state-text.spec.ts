/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { PageStateText } from "../../../src/app/models/page-state-text.ts";

describe("PageStateText", () => {
  it("keeps a state's glyph, heading and detail, and a heading that says it all", () => {
    const texts: readonly PageStateText[] = [new PageStateText("block", "Browser doesn't open this address", "Edit the address."), new PageStateText("travel_explore", "Type an address", null)];

    expect(texts.map(t => [t.glyph, t.heading, t.detail])).toEqual([["block", "Browser doesn't open this address", "Edit the address."], ["travel_explore", "Type an address", null]]);
  });
});
