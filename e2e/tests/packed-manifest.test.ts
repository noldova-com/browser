/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { gzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { PackedManifest } from "../fixtures/packed-manifest.ts";

describe("PackedManifest", () => {
  function entry(name: string, text: string, prefix: string = ""): Buffer {
    const header = Buffer.alloc(512);
    header.write(name, 0, "utf8");
    header.write(`${Buffer.byteLength(text).toString(8).padStart(11, "0")}\0`, 124, "utf8");
    header.write(prefix, 345, "utf8");
    const body = Buffer.alloc(Math.ceil(Buffer.byteLength(text) / 512) * 512);
    body.write(text, 0, "utf8");
    return Buffer.concat([header, body]);
  }

  const end = Buffer.alloc(1024);

  it("reads the package's manifest past the archive's other entries, whatever their size", () => {
    const tar = Buffer.concat([entry("package/README.md", "x".repeat(700)), entry("package/package.json", "{\"name\":\"@noldova/browser\",\"dependencies\":{\"a\":\"1.0.0\"}}"), end]);

    const manifest = PackedManifest.read(tar, "browser.tgz");

    expect([manifest.readString("name"), manifest.readObject("dependencies").toJson()]).toEqual(["@noldova/browser", { a: "1.0.0" }]);
  });

  it("joins an entry's prefix to its name", () => {
    const tar = Buffer.concat([entry("package.json", "{\"name\":\"prefixed\"}", "package"), end]);

    expect(PackedManifest.read(tar, "browser.tgz").readString("name")).toBe("prefixed");
  });

  it("fails, naming the archive, when it holds no manifest", () => {
    expect(() => PackedManifest.read(Buffer.concat([entry("package/README.md", "x"), end]), "browser.tgz")).toThrow("browser.tgz holds no package/package.json.");
    expect(() => PackedManifest.read(Buffer.alloc(10), "short.tgz")).toThrow("short.tgz holds no package/package.json.");
  });

  it("unpacks a gzip archive, and fails naming the archive, keeping the cause, when it is no gzip archive", () => {
    const tar = Buffer.concat([entry("package/package.json", "{\"name\":\"packed\"}"), end]);

    expect(PackedManifest.readPacked(gzipSync(tar), "browser.tgz").readString("name")).toBe("packed");
    expect(() => PackedManifest.readPacked(tar, "plain.tgz")).toThrow(expect.objectContaining({ message: "plain.tgz is no gzip archive.", cause: expect.any(Error) }));
  });

  it("fails naming the archive, keeping the cause, when its manifest is no JSON object", () => {
    const tar = Buffer.concat([entry("package/package.json", "{not json"), end]);

    expect(() => PackedManifest.read(tar, "broken.tgz")).toThrow(expect.objectContaining({ message: "broken.tgz holds a package/package.json that is no JSON object.", cause: expect.any(Error) }));
  });

  it("fails naming the archive and the header when an entry's size is no octal number, rather than missing the manifest after it", () => {
    const bad = entry("package/README.md", "x");
    bad.write("zz\0", 124, "utf8");
    const tar = Buffer.concat([bad, entry("package/package.json", "{}"), end]);

    expect(() => PackedManifest.read(tar, "browser.tgz")).toThrow("browser.tgz has a malformed tar header at byte 0: its size is no octal number.");
  });
});
