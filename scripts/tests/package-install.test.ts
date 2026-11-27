/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ProcessResult } from "../models/process-result.ts";
import { Resources } from "../resources.ts";
import { NpmCommand } from "../services/npm-command.ts";
import { PackageInstall } from "../services/package-install.ts";
import { ProcessRunner } from "../services/process-runner.ts";

class RecordingRunner extends ProcessRunner {
  public readonly calls: (readonly string[])[] = [];

  public override captureAsync(_command: string, commandArguments: readonly string[]): Promise<ProcessResult> {
    this.calls.push(commandArguments.slice(1));
    return Promise.resolve(new ProcessResult(0, "", ""));
  }
}

class JsonFile {
  public static async writeAsync(file: string, json: object): Promise<void> {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(json));
  }
}

class PackageInstallFixture {
  private readonly roots: string[] = [];

  public async makeRootAsync(packages: object): Promise<string> {
    const root = await mkdtemp(path.join(tmpdir(), "package-install-"));
    this.roots.push(root);
    await JsonFile.writeAsync(path.join(root, "package.json"), { devDependencies: { "@noldova/context.core": "0.0.10", "left-pad": "1.3.0" } });
    await JsonFile.writeAsync(path.join(root, "node_modules", "@noldova", "context.core", "package.json"), { version: "0.0.10" });
    await JsonFile.writeAsync(path.join(root, "package-lock.json"), { lockfileVersion: 3, packages });
    await mkdir(path.join(root, "_packages"));
    await writeFile(path.join(root, "_packages", "noldova-browser.protocol-0.0.4.tgz"), "");
    await writeFile(path.join(root, "_packages", "notes.txt"), "");
    return root;
  }

  public async cleanAsync(): Promise<void> {
    await Promise.all(this.roots.splice(0).map(t => rm(t, { recursive: true, force: true })));
  }
}

describe("PackageInstall", () => {
  const fixture = new PackageInstallFixture();

  afterEach(async () => {
    await fixture.cleanAsync();
  });

  it("installs the packed archives with the root's pins and each package the lockfile holds only as a peer at the version node_modules holds, a moved one too, leaving out one it doesn't hold", async () => {
    const root = await fixture.makeRootAsync({
      "": { name: "browser" },
      "node_modules/@noldova/context.core": { version: "0.0.10", dev: true },
      "node_modules/@noldova/context.collections": { version: "0.0.10", dev: true, peer: true },
      "node_modules/@emnapi/core": { version: "1.4.3", peer: true },
      "node_modules/left-pad/node_modules/nested": { version: "2.0.0", peer: true },
      "node_modules/unversioned": { peer: true },
      "node_modules/left-pad": { version: "1.3.0" }
    });
    await JsonFile.writeAsync(path.join(root, "node_modules", "@noldova", "context.collections", "package.json"), { version: "0.0.11" });
    await JsonFile.writeAsync(path.join(root, "node_modules", "unversioned", "package.json"), { name: "unversioned" });
    const runner = new RecordingRunner();

    await new PackageInstall(root, new NpmCommand(runner, { [Resources.npmPathVariable]: "npm-cli.js" })).installPackedAsync();

    expect(runner.calls).toEqual([[...Resources.archiveInstallArguments, path.join(root, "_packages", "noldova-browser.protocol-0.0.4.tgz"), "@noldova/context.core@0.0.10",
      "@noldova/context.collections@0.0.11"]]);
  });

  it("finds no peer in a lockfile without packages", async () => {
    const root = await fixture.makeRootAsync({});
    await JsonFile.writeAsync(path.join(root, "package-lock.json"), { lockfileVersion: 3 });

    expect(await new PackageInstall(root, new NpmCommand(new RecordingRunner(), {})).readHeldPeersAsync()).toEqual([]);
  });
});
