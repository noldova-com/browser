/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/context.json";
import { describe, expect, it } from "vitest";

import { LockfileParts } from "../fixtures/lockfile-parts.ts";

describe("LockfileParts", () => {
  const lock = JsonReader.parse(JSON.stringify({
    name: "fixture-app",
    lockfileVersion: 3,
    packages: {
      "": { name: "fixture-app", dependencies: { "left-pad": "1.3.0" } },
      "node_modules/left-pad": { version: "1.3.0" },
      "node_modules/@noldova/browser": { version: "0.0.1", resolved: "file:old.tgz", integrity: "sha512-old", peerDependenciesMeta: { gone: { optional: true } } },
      "node_modules/@noldova/browser/node_modules/nested": { version: "2.0.0" },
      "node_modules/@noldova/browser.protocol": { version: "0.0.1" }
    }
  }));

  it("builds a part's entry from its archive's manifest alone: its version, the archive as resolved, and every field npm records from a package", () => {
    const manifest = JsonReader.parse(JSON.stringify({
      name: "@noldova/browser",
      version: "0.0.4",
      description: "Not recorded.",
      license: "MIT",
      dependencies: { a: "1.0.0" },
      optionalDependencies: { b: "2.0.0" },
      peerDependencies: { c: ">=3" },
      peerDependenciesMeta: { c: { optional: true } },
      bin: { tool: "tool.js" },
      engines: { node: ">=24" },
      os: ["linux"],
      cpu: ["x64"],
      funding: "https://example.com",
      scripts: { build: "tsc" }
    }));

    expect(LockfileParts.entry(manifest, "file:part.tgz")).toEqual({
      version: "0.0.4",
      resolved: "file:part.tgz",
      license: "MIT",
      dependencies: { a: "1.0.0" },
      optionalDependencies: { b: "2.0.0" },
      peerDependencies: { c: ">=3" },
      peerDependenciesMeta: { c: { optional: true } },
      bin: { tool: "tool.js" },
      engines: { node: ">=24" },
      os: ["linux"],
      cpu: ["x64"],
      funding: "https://example.com"
    });
    expect(LockfileParts.entry(JsonReader.parse("{\"version\":\"1.0.0\"}"), "file:bare.tgz")).toEqual({ version: "1.0.0", resolved: "file:bare.tgz" });
  });

  it("puts each part's entry in place of whatever the lockfile held for it, adding a missing one, and sets the root's dependencies", () => {
    const entries = new Map([["@noldova/browser", { version: "0.0.4", resolved: "file:new.tgz" }], ["@noldova/browser.window", { version: "0.0.4", resolved: "file:window.tgz" }]]);

    const swapped = LockfileParts.withParts(lock, entries, { "left-pad": "1.3.0", "@noldova/browser": "file:new.tgz" });

    expect(swapped).toEqual({
      name: "fixture-app",
      lockfileVersion: 3,
      packages: {
        "": { name: "fixture-app", dependencies: { "left-pad": "1.3.0", "@noldova/browser": "file:new.tgz" } },
        "node_modules/left-pad": { version: "1.3.0" },
        "node_modules/@noldova/browser.protocol": { version: "0.0.1" },
        "node_modules/@noldova/browser": { version: "0.0.4", resolved: "file:new.tgz" },
        "node_modules/@noldova/browser.window": { version: "0.0.4", resolved: "file:window.tgz" }
      }
    });
    expect(Object.keys(JsonReader.parse(JSON.stringify(swapped)).readObject("packages").toJson())[0]).toBe("");
  });

  it("names what a part needs that the template doesn't list, which a relock would prune: a dependency, an optional one and a required peer, never an optional peer or another part", () => {
    const parse = (json: object): JsonReader => JsonReader.parse(JSON.stringify(json));
    const parts = new Map([
      ["@noldova/browser", parse({ dependencies: { "@noldova/browser.window": "0.0.4", fresh: "1.0.0" }, peerDependencies: { listed: "1", required: "1", optional: "1", marked: "1", unmarked: "1" },
        peerDependenciesMeta: { optional: { optional: true }, marked: { optional: false }, unmarked: {} } })],
      ["@noldova/browser.window", parse({ optionalDependencies: { extra: "1" }, peerDependencies: { required: "1" } })]
    ]);

    expect(LockfileParts.findUnlisted(parts, { listed: "1" })).toEqual(["extra", "fresh", "marked", "required", "unmarked"]);
    expect(LockfileParts.findUnlisted(new Map([["bare", parse({})]]), {})).toEqual([]);
  });

  it("drops the parts and the packages nested under them, and only them, for the lockfile it saves", () => {
    const saved = LockfileParts.withoutParts(lock, ["@noldova/browser", "@noldova/browser.window"], { "left-pad": "1.3.0" });

    expect(JsonReader.parse(JSON.stringify(saved)).readObject("packages").toJson()).toEqual({
      "": { name: "fixture-app", dependencies: { "left-pad": "1.3.0" } },
      "node_modules/left-pad": { version: "1.3.0" },
      "node_modules/@noldova/browser.protocol": { version: "0.0.1" }
    });
  });
});
