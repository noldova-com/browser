/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { JsonReader } from "@noldova/context.json";

import { PackedManifest } from "./packed-manifest.ts";
import { TestAppLayout } from "./test-app-layout.ts";

export class PackedPart {
  public readonly name: string;
  public readonly version: string;
  public readonly archive: string;
  public readonly published: JsonReader;

  private constructor(name: string, version: string, archive: string, published: JsonReader) {
    this.name = name;
    this.version = version;
    this.archive = archive;
    this.published = published;
  }

  public static async readAsync(folder: string): Promise<PackedPart> {
    const manifest = JsonReader.parse(await readFile(path.join(folder, "package.json"), "utf8"));
    const [name, version] = [manifest.readString("name"), manifest.readString("version")];
    const archive = path.join(TestAppLayout.ARCHIVES_FOLDER, `${name.replace(/^@/, "").replace("/", "-")}-${version}.tgz`);
    return new PackedPart(name, version, archive, await PackedManifest.readAsync(archive));
  }

  public fileSpecifier(from: string): string {
    return `file:${path.relative(from, this.archive).split(path.sep).join(path.posix.sep)}`;
  }
}
