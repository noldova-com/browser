/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PackageException } from "../exceptions/package.exception.ts";
import { PeerManifestUnreadableException } from "../exceptions/peer-manifest-unreadable.exception.ts";
import { PeerVersionsNotJsonException } from "../exceptions/peer-versions-not-json.exception.ts";
import { ProcessException } from "../exceptions/process.exception.ts";
import { VersionRange } from "../models/version-range.ts";
import { Resources } from "../resources.ts";
import type { NpmCommand } from "./npm-command.ts";
import type { PackageInstall } from "./package-install.ts";
import type { PackageLayout } from "./package-layout.ts";

export class PeerMove {
  private readonly root: string;
  private readonly layout: PackageLayout;
  private readonly npm: NpmCommand;
  private readonly install: PackageInstall;
  private readonly report: (line: string) => void;

  public constructor(root: string, layout: PackageLayout, npm: NpmCommand, install: PackageInstall, report: (line: string) => void) {
    this.root = root;
    this.layout = layout;
    this.npm = npm;
    this.install = install;
    this.report = report;
  }

  public async runAsync(): Promise<number> {
    try {
      const ranges = await this.readRangesAsync();
      if (ranges.size === 0)
        return 0;
      const names = [...new Set([...ranges.keys(), ...(await this.install.readRootPinsAsync()).filter(t => t.startsWith(Resources.contextPrefix))])];
      let common: readonly string[] | undefined;
      for (const name of names) {
        const versions = await this.publishedAsync(name, ranges.get(name) ?? []);
        if (versions === undefined)
          return 1;
        common = common === undefined ? versions : common.filter(t => versions.includes(t));
      }
      const together = (common ?? []).reduce<string | undefined>((found, t) => found === undefined || VersionRange.isNewer(t, found) ? t : found, undefined);
      if (together === undefined) {
        this.report(Resources.formatPeerNoCommonVersion(names));
        return 1;
      }
      const chosen = new Map<string, string>(names.map(t => [t, together]));
      const kept = await this.install.readInstalledPinsAsync(new Set(chosen.keys()));
      const moved = [...chosen].map(([name, version]) => Resources.formatPackageSpec(name, version));
      const result = await this.npm.runAsync([...Resources.archiveInstallArguments, ...moved, ...kept], this.root);
      if (!result.isSuccessful) {
        this.report(Resources.formatPeerMoveFailed(result.exitCode, result.text));
        return 1;
      }
      let failed = 0;
      for (const [name, version] of chosen) {
        const installed = await this.readInstalledAsync(name);
        if (installed === version)
          this.report(Resources.formatPeerMoved(name, version));
        else {
          this.report(Resources.formatPeerNotMoved(name, String(installed), version));
          failed++;
        }
      }
      return failed === 0 ? 0 : 1;
    }
    catch (error) {
      if (!(error instanceof ProcessException || error instanceof PackageException))
        throw error;
      this.report(error.message);
      return 1;
    }
  }

  private static fieldsOf(json: unknown): ReadonlyMap<string, unknown> {
    return typeof json === "object" && json !== null && !Array.isArray(json) ? new Map<string, unknown>(Object.entries(json)) : new Map<string, unknown>();
  }

  private static parseVersions(name: string, output: string): unknown {
    try {
      return JSON.parse(output);
    }
    catch (error) {
      if (!(error instanceof SyntaxError))
        throw error;
      throw new PeerVersionsNotJsonException(name, output, error);
    }
  }

  private async readRangesAsync(): Promise<ReadonlyMap<string, readonly string[]>> {
    const ranges = new Map<string, string[]>();
    for (const part of await this.layout.readPackagesAsync()) {
      const manifest: unknown = JSON.parse(await readFile(path.join(this.root, part.folder, Resources.manifestFile), Resources.textEncoding));
      for (const [name, range] of PeerMove.fieldsOf(PeerMove.fieldsOf(manifest).get(Resources.peersField)))
        if (name.startsWith(Resources.contextPrefix) && typeof range === "string")
          ranges.set(name, [...ranges.get(name) ?? [], range]);
    }
    return ranges;
  }

  private async publishedAsync(name: string, ranges: readonly string[]): Promise<readonly string[] | undefined> {
    const parsed = ranges.map(t => VersionRange.parse(t));
    const holding = parsed.filter(t => t !== null);
    if (holding.length !== parsed.length) {
      for (const range of ranges.filter(t => VersionRange.parse(t) === null))
        this.report(Resources.formatPeerRangeInvalid(name, range));
      return undefined;
    }
    const result = await this.npm.runAsync(Resources.formatVersionsViewArguments(name), this.root);
    if (!result.isSuccessful) {
      this.report(Resources.formatPeerVersionsUnread(name, result.exitCode, result.text));
      return undefined;
    }
    const published = PeerMove.parseVersions(name, result.output);
    const versions = (Array.isArray(published) ? published : [published])
      .filter((t: unknown): t is string => typeof t === "string" && Resources.versionPattern.test(t) && holding.every(u => u.includes(t)));
    if (versions.length > 0)
      return versions;
    this.report(Resources.formatPeerNoVersion(name, [...new Set(ranges)]));
    return undefined;
  }

  private async readInstalledAsync(name: string): Promise<unknown> {
    const file = path.join(this.root, Resources.modulesFolder, ...name.split(Resources.posixSeparator), Resources.manifestFile);
    if (!existsSync(file))
      throw new PeerManifestUnreadableException(name, file, null);
    try {
      return PeerMove.fieldsOf(JSON.parse(await readFile(file, Resources.textEncoding))).get(Resources.versionField);
    }
    catch (error) {
      if (!(error instanceof SyntaxError))
        throw error;
      throw new PeerManifestUnreadableException(name, file, error);
    }
  }
}
