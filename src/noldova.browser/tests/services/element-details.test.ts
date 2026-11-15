/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PermissionDetailKind } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { ElementFacts } from "../../src/models/element-facts.ts";
import { NodeFacts } from "../../src/models/node-facts.ts";
import { PageFacts } from "../../src/models/page-facts.ts";
import { ElementDetails } from "../../src/services/element-details.ts";

describe("ElementDetails", () => {
  it("names no destination for a link whose address doesn't parse", () => {
    const page: PageFacts = new PageFacts("https://shop.test/cart/");

    expect(ElementDetails.describe(new ElementFacts([new NodeFacts("A", new Map([["href", "https://[broken"]]))], [], page)))
      .toEqual([{ label: "Element", kind: PermissionDetailKind.Text, value: "<a>" }]);
    expect(ElementDetails.describe(new ElementFacts([new NodeFacts("BUTTON", new Map())], [], page)))
      .toEqual([{ label: "Element", kind: PermissionDetailKind.Text, value: "<button>" }]);
  });

  it("names a link's destination resolved against the page's base address", () => {
    const page: PageFacts = new PageFacts("https://shop.test/cart/");

    expect(ElementDetails.describe(new ElementFacts([new NodeFacts("A", new Map([["href", "../checkout?step=1"]]))], [], page))).toEqual([
      { label: "Element", kind: PermissionDetailKind.Text, value: "<a>" },
      { label: "Goes to", kind: PermissionDetailKind.Text, value: "https://shop.test/checkout?step=1" }
    ]);
  });

  it("says the element can't be read when its path is unknown or empty", () => {
    const page: PageFacts = new PageFacts("https://shop.test/cart/");
    const unknown: readonly unknown[] = [{ label: "Element", kind: PermissionDetailKind.Text, value: "An element the browser can't read, such as one in another site's frame" }];

    expect([ElementDetails.describe(new ElementFacts(null, [], page)), ElementDetails.describe(new ElementFacts([], [], page))]).toEqual([unknown, unknown]);
  });
});
