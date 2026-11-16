/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, test } from "../fixtures/app-test.ts";

test.describe("the no-request-leaves-loopback guard", () => {
  test("fails a run whose view requests a host that is none of its fixture servers", async ({ app, servers, guard }) => {
    const outside = "http://outside.example/pixel.png";
    const allowed = await servers.startAsync("allowed.localhost", { "/": `<!doctype html><title>Outside image</title><img src="${outside}" alt="">` });
    await app.allowLocalSitesAsync([allowed.origin]);

    await app.openPageAsync(allowed.url("/"));

    let violations: readonly string[] = [];
    await expect.poll(async () => {
      violations = [...violations, ...await guard.takeViolationsAsync()];
      return violations.some(t => t.includes("outside.example"));
    }, { message: "The guard never reported the page's request to outside.example." }).toBe(true);
    expect(violations).toContain("The recording proxy received GET http://outside.example/pixel.png.");
  });
});
