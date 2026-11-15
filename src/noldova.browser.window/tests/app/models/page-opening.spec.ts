/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { PageOpening } from "../../../src/app/models/page-opening.ts";

describe("PageOpening", () => {
  it("keeps the workspace's profile key, the address and the instance", () => {
    const opening: PageOpening = new PageOpening("workspace-1", "https://docs.example.com/", null);

    expect([opening.profileKey, opening.url, opening.instance]).toEqual(["workspace-1", "https://docs.example.com/", null]);
  });
});
