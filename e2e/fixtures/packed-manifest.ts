/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

import { JsonReader } from "@noldova/context.json";

export class PackedManifest {
  private static readonly BLOCK: number = 512;
  private static readonly ENTRY: string = "package/package.json";

  public static async readAsync(archive: string): Promise<JsonReader> {
    return PackedManifest.readPacked(await readFile(archive), archive);
  }

  public static readPacked(packed: Buffer, archive: string): JsonReader {
    let tar: Buffer;
    try {
      tar = gunzipSync(packed);
    }
    catch (error) {
      throw new Error(`${archive} is no gzip archive.`, { cause: error });
    }
    return PackedManifest.read(tar, archive);
  }

  public static read(tar: Buffer, archive: string): JsonReader {
    let offset = 0;
    while (offset + PackedManifest.BLOCK <= tar.length) {
      const name = PackedManifest.readText(tar, offset, 100);
      if (name === "")
        break;
      const prefix = PackedManifest.readText(tar, offset + 345, 155);
      const size = Number.parseInt(PackedManifest.readText(tar, offset + 124, 12).trim(), 8);
      if (Number.isNaN(size))
        throw new Error(`${archive} has a malformed tar header at byte ${offset}: its size is no octal number.`);
      const start = offset + PackedManifest.BLOCK;
      if ((prefix === "" ? name : `${prefix}/${name}`) === PackedManifest.ENTRY)
        return PackedManifest.parse(tar.subarray(start, start + size).toString("utf8"), archive);
      offset = start + Math.ceil(size / PackedManifest.BLOCK) * PackedManifest.BLOCK;
    }
    throw new Error(`${archive} holds no ${PackedManifest.ENTRY}.`);
  }

  private static parse(text: string, archive: string): JsonReader {
    try {
      return JsonReader.parse(text);
    }
    catch (error) {
      throw new Error(`${archive} holds a ${PackedManifest.ENTRY} that is no JSON object.`, { cause: error });
    }
  }

  private static readText(tar: Buffer, start: number, length: number): string {
    const field = tar.subarray(start, start + length);
    const end = field.indexOf(0);
    return field.subarray(0, end === -1 ? length : end).toString("utf8");
  }
}
