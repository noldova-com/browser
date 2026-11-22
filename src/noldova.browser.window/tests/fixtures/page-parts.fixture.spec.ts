/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { MissingPartError } from "./missing-part.error.ts";
import { PagePartsFixture } from "./page-parts.fixture.ts";

describe("PagePartsFixture", () => {
  it("finds the first element the selector names under the root", () => {
    const root: HTMLElement = document.createElement("div");
    root.innerHTML = "<p>One</p><p id=\"two\">Two</p>";

    expect([PagePartsFixture.find(root, "p").textContent, PagePartsFixture.find(root, "#two").textContent]).toEqual(["One", "Two"]);
  });

  it("fails with the selector when the root holds no such element", () => {
    const root: HTMLElement = document.createElement("div");

    expect(() => PagePartsFixture.find(root, "form")).toThrow(new MissingPartError("element at form"));
  });
});
