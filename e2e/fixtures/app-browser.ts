/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { JsonReader } from "@noldova/context.json";

import { TestAppLayout } from "./test-app-layout.ts";

export class AppBrowser {
  public static readonly productName: string = JsonReader.parse(readFileSync(path.join(TestAppLayout.TEMPLATE_FOLDER, "package.json"), "utf8"))
    .readObject("desktop").readObject("product").readString("name");

  public static saying(rest: string): RegExp {
    return new RegExp(`^${AppBrowser.escape(`${AppBrowser.productName}'s browser ${rest}`)}$`);
  }

  private static escape(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
