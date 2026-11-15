/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { PageOrigin } from "../../src/services/page-origin.ts";

describe("PageOrigin", () => {
  it("keeps a page's web origin", () => {
    expect([PageOrigin.of("https://shop.test"), PageOrigin.of("http://localhost:4200")]).toEqual(["https://shop.test", "http://localhost:4200"]);
  });

  it("marks a page with an opaque origin, such as a blank tab, a data URL or an error page, as the module's opaque origin", () => {
    expect(["null", "://", "", "chrome-error://chromewebdata"].map(t => PageOrigin.of(t))).toEqual(Array(4).fill("browser:opaque"));
  });
});
