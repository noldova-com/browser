/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { PagePlace } from "../../../src/app/models/page-place.ts";

describe("PagePlace", () => {
  it("keeps the page's workspace and address", () => {
    const place: PagePlace = new PagePlace("workspace-1", "https://docs.example.com/");

    expect([place.profileKey, place.url]).toEqual(["workspace-1", "https://docs.example.com/"]);
  });
});
