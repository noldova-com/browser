/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, test } from "../fixtures/app-test.ts";

test.describe("the no-request-leaves-loopback guard", () => {
  test("fails a run whose view requests a host that is none of its fixture servers", async ({ app, servers, loopbackProxy }) => {
    test.fail(true, "The guard fails this run at its end, since the page's image goes to outside.example through the recording proxy.");
    const allowed = await servers.startAsync("allowed.localhost", { "/": "<!doctype html><title>Outside image</title><img src=\"http://outside.example/pixel.png\" alt=\"\">" });
    await app.allowLocalSitesAsync([allowed.origin]);

    await app.openPageAsync(allowed.url("/"));

    await expect.poll(() => loopbackProxy.peek(), { message: "The recording proxy never received the page's request to outside.example." })
      .toContain("GET http://outside.example/pixel.png");
  });
});
