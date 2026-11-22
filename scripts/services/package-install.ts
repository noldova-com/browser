/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { ArchiveInstallFailedException } from "../exceptions/archive-install-failed.exception.ts";
import { Resources } from "../resources.ts";
import type { NpmCommand } from "./npm-command.ts";

export class PackageInstall {
  private readonly root: string;
  private readonly npm: NpmCommand;

  public constructor(root: string, npm: NpmCommand) {
    this.root = root;
    this.npm = npm;
  }

  public async installPackedAsync(): Promise<void> {
    const folder = path.join(this.root, Resources.archivesFolder);
    const archives = (await readdir(folder)).filter(t => t.endsWith(Resources.archiveExtension)).sort().map(t => path.join(folder, t));
    const pins = [...await this.readInstalledPinsAsync(), ...await this.readHeldPeersAsync()];
    const result = await this.npm.runAsync([...Resources.archiveInstallArguments, ...archives, ...pins], this.root);
    if (!result.isSuccessful)
      throw new ArchiveInstallFailedException(archives.map(t => path.basename(t)), result.exitCode, result.text);
  }

  private static readField(json: unknown, field: string): unknown {
    return typeof json === "object" && json !== null ? Reflect.get(json, field) : undefined;
  }

  private async readJsonAsync(file: string): Promise<unknown> {
    return JSON.parse(await readFile(file, Resources.textEncoding));
  }

  public async readRootPinsAsync(): Promise<readonly string[]> {
    const manifest: unknown = await this.readJsonAsync(path.join(this.root, Resources.manifestFile));
    const names: string[] = [];
    for (const field of [Resources.dependenciesField, Resources.devDependenciesField]) {
      const pins: unknown = PackageInstall.readField(manifest, field);
      if (typeof pins === "object" && pins !== null)
        names.push(...Object.keys(pins).filter(t => t.startsWith(Resources.scopePrefix)));
    }
    return names.sort();
  }

  // npm resolves a package the lockfile holds only as another's peer afresh for an install that names packages, so the
  // newest release the registry holds would replace it; naming each at the version node_modules holds keeps the one
  // npm ci installed, or the one a peer move put there, and leaves out an optional peer npm ci never installed.
  public async readHeldPeersAsync(): Promise<readonly string[]> {
    const lock: unknown = await this.readJsonAsync(path.join(this.root, Resources.lockfileFile));
    const packages: unknown = PackageInstall.readField(lock, Resources.lockedPackagesField);
    const prefix = `${Resources.modulesFolder}${Resources.posixSeparator}`;
    const names = Object.entries(typeof packages === "object" && packages !== null ? packages : {})
      .filter(([key, entry]) => key.startsWith(prefix) && !key.slice(prefix.length).includes(prefix) && PackageInstall.readField(entry, Resources.lockedPeerField) === true)
      .map(([key]) => key.slice(prefix.length));
    return this.readHeldAsync(names.sort());
  }

  public async readInstalledPinsAsync(moved: ReadonlySet<string> = new Set<string>()): Promise<readonly string[]> {
    return this.readHeldAsync((await this.readRootPinsAsync()).filter(t => !moved.has(t)));
  }

  private async readHeldAsync(names: readonly string[]): Promise<readonly string[]> {
    const kept: string[] = [];
    for (const name of names) {
      const file = path.join(this.root, Resources.modulesFolder, ...name.split(Resources.posixSeparator), Resources.manifestFile);
      const version: unknown = existsSync(file) ? PackageInstall.readField(await this.readJsonAsync(file), Resources.versionField) : undefined;
      if (typeof version === "string")
        kept.push(Resources.formatPackageSpec(name, version));
    }
    return kept;
  }
}
