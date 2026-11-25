/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import type { TestApp } from "./test-app.ts";

// The app's own endpoints on loopback, which Noldova Desktop refuses in every view, even when an allowed origin names them.
export class OwnEndpoints {
  // The runtime's endpoint is loopback TCP on Windows only, and a Unix socket elsewhere, which no web address names.
  public static readonly hasRuntimePort: boolean = process.platform === "win32";
  private static readonly TCP_PREFIX: string = "tcp://";

  // The agent double's tool endpoint, `http://127.0.0.1:<port>/`, which Noldova Desktop returns only once the view's
  // main process has blocked its port.
  public static async toolServerAsync(app: TestApp): Promise<URL> {
    const url = await app.requestAsync("agent-double.openToolEndpoint", {});
    if (!Object.isString(url))
      throw new Error(`The agent double's tool endpoint isn't an address: ${JSON.stringify(url)}`);
    return new URL(url);
  }

  // The runtime's endpoint as a web address, read from the discovery file the runtime publishes in the app's data folder;
  // the test reads its endpoint field alone.
  public static async runtimeAsync(app: TestApp): Promise<URL> {
    const discovery = JsonReader.parse(await readFile(path.join(app.dataDirectory, "discovery", "runtime.json"), "utf8"));
    const endpoint = discovery.readString("endpoint");
    if (!endpoint.startsWith(OwnEndpoints.TCP_PREFIX))
      throw new Error(`The runtime's endpoint isn't loopback TCP: ${endpoint.startsWith("/") ? "a Unix socket" : "another kind"}.`);
    return new URL(`http://${endpoint.slice(OwnEndpoints.TCP_PREFIX.length)}/`);
  }
}
