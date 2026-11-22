/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader, type JsonValue } from "@noldova/context.json";

import { expect, test } from "../fixtures/app-test.ts";
import type { FixtureServer } from "../fixtures/fixture-servers.ts";
import { TestApp } from "../fixtures/test-app.ts";
import { ToolReply } from "../fixtures/tool-reply.ts";
import { ViewPage } from "../fixtures/view-pages.ts";

const TITLE = "Scale";
// The longest side, in device pixels, that a capture keeps: the architecture's cap.
const CAP = 1_600;
// A page much taller than the window, so its full page is over the cap at either scale while the view is under it.
const PAGE = `<!doctype html><title>${TITLE}</title><body style="margin:0;background:#2050a0"><div style="height:3000px"></div>`;

// An area's size in CSS pixels, and the image a capture of it gives, in device pixels, scaled to the cap with its shape kept.
class Capture {
  public readonly width: number;
  public readonly height: number;
  public readonly deviceScale: number;

  public constructor(width: number, height: number, deviceScale: number) {
    this.width = width;
    this.height = height;
    this.deviceScale = deviceScale;
  }

  public get longerSide(): number {
    return Math.max(this.width, this.height) * this.deviceScale;
  }

  public get image(): string {
    const scale = Math.min(1, CAP / this.longerSide);
    return `${String(Math.round(this.width * scale * this.deviceScale))} by ${String(Math.round(this.height * scale * this.deviceScale))}`;
  }
}

// The view's capture and the full page's, read together from the page.
class Captures {
  public readonly view: Capture;
  public readonly page: Capture;

  public constructor(view: Capture, page: Capture) {
    this.view = view;
    this.page = page;
  }
}

async function callAsync(app: TestApp, bindings: JsonObject, name: string, input: JsonObject = {}): Promise<JsonValue> {
  const result = await app.requestAsync("agent-double.callTool", { name, input, bindings });
  expect(result, `${name} failed: ${JSON.stringify(result).slice(0, 1_000)}`).toEqual(expect.objectContaining({ isFailure: false }));
  return result;
}

// The decoded image's width and height, from its PNG header: an 8-byte signature, then the IHDR chunk's length, type, width and height.
function imageOf(result: JsonValue): string {
  const images = ToolReply.partsOf(result).filter(t => t["mimeType"] === "image/png");
  expect(images, "The result holds no one PNG image.").toHaveLength(1);
  const data = images[0]?.["data"];
  if (!Object.isString(data))
    throw new Error(`The image's data isn't a text: ${JSON.stringify(data)}`);
  const bytes = Buffer.from(data, "base64");
  expect(bytes.subarray(0, 8).toString("hex"), "The image isn't a PNG.").toBe("89504e470d0a1a0a");
  return `${String(bytes.readUInt32BE(16))} by ${String(bytes.readUInt32BE(20))}`;
}

async function openAsync(app: TestApp, docs: FixtureServer): Promise<JsonObject> {
  await app.resizeAsync(700, 600);
  await app.allowLocalSitesAsync([docs.origin]);
  const bindings = { page: await app.openPageAsync(docs.url("/")), profileKey: TestApp.PROFILE_KEY };
  await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/"), TITLE)]);
  // The first call shows the agent's bar, which makes the view shorter, so the sizes are read once two reads agree after it.
  await callAsync(app, bindings, "browser_snapshot");
  return bindings;
}

async function capturesAsync(app: TestApp, docs: FixtureServer): Promise<Captures> {
  const read = (): Promise<string> => app.viewPages.runAtAsync(docs.url("/"), "JSON.stringify({ viewWidth: document.documentElement.clientWidth, "
    + "viewHeight: document.documentElement.clientHeight, pageWidth: document.documentElement.scrollWidth, pageHeight: document.documentElement.scrollHeight, "
    + "deviceScale: devicePixelRatio })");
  let last = "";
  await expect.poll(async () => {
    const earlier = last;
    last = await read();
    return last === earlier;
  }, { message: "The view's size never came to rest." }).toBe(true);
  const sizes = JsonReader.parse(last);
  const deviceScale = sizes.readNumber("deviceScale");
  return new Captures(new Capture(sizes.readNumber("viewWidth"), sizes.readNumber("viewHeight"), deviceScale),
    new Capture(sizes.readNumber("pageWidth"), sizes.readNumber("pageHeight"), deviceScale));
}

for (const deviceScale of [1, 2])
  test.describe(`screenshot scale at ${String(deviceScale)}`, () => {
    test.use({ deviceScale });

    test("a capture is the area's CSS size times the device scale, scaled down to the cap with its shape kept, for the view under the cap and the full page over it", async ({ app, servers }) => {
      const docs = await servers.startAsync("docs.localhost", { "/": PAGE });
      const bindings = await openAsync(app, docs);
      const { view, page } = await capturesAsync(app, docs);
      expect(view.deviceScale, "The view doesn't have the forced device scale.").toBe(deviceScale);
      expect([view.longerSide < CAP, page.longerSide > CAP], "The view isn't under the cap and the full page over it, as [view, page].").toEqual([true, true]);

      const shown = await callAsync(app, bindings, "browser_screenshot");
      const full = await callAsync(app, bindings, "browser_screenshot", { fullPage: true });

      expect([imageOf(shown), imageOf(full)], "The images aren't the areas' sizes times the scale, capped, as [view, full page].").toEqual([view.image, page.image]);
      expect([ToolReply.textsOf(shown)[0], ToolReply.textsOf(full)[0]], "The texts don't give the images' sizes.")
        .toEqual([`A screenshot of ${view.image} pixels.`, `A screenshot of ${page.image} pixels.`]);
      expect(await capturesAsync(app, docs), "The areas' sizes changed during the captures.").toEqual(new Captures(view, page));
    });
  });
