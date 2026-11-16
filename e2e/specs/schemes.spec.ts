/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, test } from "../fixtures/app-test.ts";
import type { TestApp } from "../fixtures/test-app.ts";
import { ViewPage } from "../fixtures/view-pages.ts";

interface IRefusedScheme {
  readonly name: string;
  readonly address: string;
}

interface INavigationStart {
  readonly name: string;
  script(address: string): string;
}

const ALLOWED_TITLE = "Allowed";
const ALLOWED_PAGE = `<!doctype html><title>${ALLOWED_TITLE}</title><p>Allowed fixture page</p>`;
const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const REFUSED_SCHEMES: readonly IRefusedScheme[] = [
  { name: "file:", address: JSON.stringify("file:///") },
  { name: "data:", address: JSON.stringify("data:text/html,<title>Data page</title>") },
  { name: "blob:", address: "URL.createObjectURL(new Blob([\"<title>Blob page</title>\"], { type: \"text/html\" }))" },
  { name: "about:srcdoc", address: JSON.stringify("about:srcdoc") },
  { name: "view-source:", address: "`view-source:${location.href}`" },
  { name: "devtools:", address: JSON.stringify("devtools://devtools/bundled/inspector.html") },
  { name: "chrome:", address: JSON.stringify("chrome://version/") },
  { name: "the app's desktop-file: protocol", address: JSON.stringify("desktop-file://grant/") }
];

const STARTS: readonly INavigationStart[] = [
  { name: "a link", script: address => `{ const link = document.createElement("a"); link.href = ${address}; document.body.append(link); link.click(); }` },
  { name: "the page's script", script: address => `location.href = ${address};` }
];

async function expectPageAsync(app: TestApp, url: string, title: string, message: string): Promise<void> {
  await expect.poll(() => app.viewPages.listAsync(), { message }).toEqual([new ViewPage(url, title)]);
}

test.describe("schemes", () => {
  for (const scheme of REFUSED_SCHEMES)
    test(`refuses a navigation to ${scheme.name}`, async ({ app, servers }) => {
      const allowed = await servers.startAsync("allowed.localhost", { "/": ALLOWED_PAGE, "/again": ALLOWED_PAGE });
      await app.allowLocalSitesAsync([allowed.origin]);
      await app.openPageAsync(allowed.url("/"));
      await expectPageAsync(app, allowed.url("/"), ALLOWED_TITLE, "The view never showed the allowed page.");

      for (const [index, start] of STARTS.entries()) {
        const last = index === 0 ? allowed.url("/") : allowed.url("/again");
        const barrier = `After ${start.name}`;
        await app.viewPages.takeCommitsAsync();

        await app.viewPages.runAsync(start.script(scheme.address));
        await app.viewPages.runAsync(`document.title = ${JSON.stringify(barrier)};`);

        await expectPageAsync(app, last, barrier, `The view didn't stay at ${last}, done loading, after ${scheme.name} from ${start.name}.`);
        expect(await app.viewPages.takeCommitsAsync(), `The view committed a navigation for ${scheme.name} from ${start.name}.`).toEqual([]);

        await app.viewPages.runAsync(`location.href = ${JSON.stringify(allowed.url("/again"))};`);
        await expectPageAsync(app, allowed.url("/again"), ALLOWED_TITLE, "The view never loaded the allowed page again.");
      }
    });

  test("lets a subresource use data: and blob:", async ({ app, servers }) => {
    const allowed = await servers.startAsync("allowed.localhost", { "/": `<!doctype html><title>${ALLOWED_TITLE}</title><img id="data" src="${PIXEL}" alt="">` });
    await app.allowLocalSitesAsync([allowed.origin]);
    await app.openPageAsync(allowed.url("/"));
    await expectPageAsync(app, allowed.url("/"), ALLOWED_TITLE, "The view never showed the allowed page.");

    const widths = await app.viewPages.runAsync(`(async () => {
      const image = document.getElementById("data");
      await image.decode();
      const copy = new Image();
      copy.src = URL.createObjectURL(await (await fetch(image.src)).blob());
      await copy.decode();
      return [image.naturalWidth, copy.naturalWidth].join(" ");
    })()`);

    expect(widths, "The data: image and its blob: copy didn't both load.").toBe("1 1");
  });
});
