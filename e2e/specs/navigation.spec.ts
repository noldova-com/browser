/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, test } from "../fixtures/app-test.ts";
import { ViewPage } from "../fixtures/view-pages.ts";

test.describe("navigation", () => {
  test("an allowed origin loads", async ({ app, servers }) => {
    const allowed = await servers.startAsync("allowed.localhost", { "/": "<!doctype html><title>Allowed</title><p>Allowed fixture page</p>" });
    await app.allowLocalSitesAsync([allowed.origin]);

    await app.openPageAsync(allowed.url("/"));

    await expect.poll(() => allowed.requests.map(t => `${t.host}${t.path}`), { message: "The allowed fixture server never received the page's request." })
      .toContain(`allowed.localhost:${allowed.port}/`);
    await expect.poll(() => app.viewPages.listAsync(), { message: "The view never showed the allowed page." }).toEqual([new ViewPage(allowed.url("/"), "Allowed")]);
  });
});
