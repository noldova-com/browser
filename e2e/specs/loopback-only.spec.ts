/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, test } from "../fixtures/app-test.ts";

test.describe("the no-request-leaves-loopback guard", () => {
  test.use({ expectedViolations: [
    "The recording proxy received GET http://outside.example/pixel.png.",
    "A view's request to http://outside.example/pixel.png ended with net::ERR_EMPTY_RESPONSE."
  ] });

  test("reports a view's request to a host that is none of its fixture servers", async ({ app, servers, loopbackProxy }) => {
    const allowed = await servers.startAsync("allowed.localhost", { "/": "<!doctype html><title>Outside image</title><img src=\"http://outside.example/pixel.png\" alt=\"\">" });
    await app.allowLocalSitesAsync([allowed.origin]);

    await app.openPageAsync(allowed.url("/"));

    await expect.poll(() => loopbackProxy.peek(), { message: "The recording proxy never received the page's request to outside.example." })
      .toContain("GET http://outside.example/pixel.png");
  });
});
