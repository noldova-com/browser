/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { PageShowing } from "../../../src/app/models/page-showing.ts";

describe("PageShowing", () => {
  it("keeps the instance, and says the page was closed meanwhile only once it is closed", () => {
    const showing: PageShowing = new PageShowing("0f8fad5b-d9cb-469f-a165-70867728950e");
    const before: boolean = showing.isClosedMeanwhile;

    showing.close();

    expect([showing.instance, before, showing.isClosedMeanwhile]).toEqual(["0f8fad5b-d9cb-469f-a165-70867728950e", false, true]);
  });
});
