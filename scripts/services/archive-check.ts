/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

import { ArchiveFindingsException } from "../exceptions/archive-findings.exception.ts";
import { ArchiveFolderMissingException } from "../exceptions/archive-folder-missing.exception.ts";
import { GitHubException } from "../exceptions/github.exception.ts";
import { JsonObjectUnreadableException } from "../exceptions/json-object-unreadable.exception.ts";
import { DesktopRangeReading } from "../models/desktop-range-reading.ts";
import { ReleaseArchive } from "../models/release-archive.ts";
import { VersionRange } from "../models/version-range.ts";
import { ExportTarget } from "../models/export-target.ts";
import { Resources } from "../resources.ts";
import { ArchiveReader } from "./archive-reader.ts";
import { GitHubJson } from "./github-json.ts";
import { PackageLayout } from "./package-layout.ts";

export class ArchiveCheck {
  private readonly root: string;
  private readonly archiveReader: ArchiveReader = new ArchiveReader();

  public constructor(root: string) {
    this.root = root;
  }

  public async checkAsync(folder: string, version: string, commit: string | null, scope: string): Promise<readonly ReleaseArchive[]> {
    const directory = path.resolve(this.root, folder);
    if (!existsSync(directory))
      throw new ArchiveFolderMissingException(folder);

    const archives = (await new PackageLayout(this.root).readPackagesAsync()).map(t => new ReleaseArchive(t, path.join(directory, Resources.formatArchiveName(t.name, version))));
    const expected = archives.map(t => path.basename(t.filePath));
    const found = (await readdir(directory)).sort();
    const findings = [
      ...expected.filter(t => !found.includes(t)).map(t => Resources.formatArchiveMissing(folder, t)),
      ...found.filter(t => !expected.includes(t)).map(t => Resources.formatArchiveUnexpected(folder, t, version))
    ];

    const names = archives.map(t => t.part.name);
    const contents = new Map<ReleaseArchive, ReadonlyMap<string, Buffer>>();
    for (const archive of archives.filter(t => found.includes(path.basename(t.filePath))))
      contents.set(archive, await this.archiveReader.readAsync(archive.filePath));
    const noldovaDesktop = ArchiveCheck.readNoldovaDesktop(contents);
    findings.push(...noldovaDesktop.findings);
    for (const [archive, entries] of contents)
      findings.push(...ArchiveCheck.checkArchive(archive, entries, version, commit, scope, names, noldovaDesktop.range));

    if (findings.length > 0)
      throw new ArchiveFindingsException(findings);

    return archives;
  }

  private static readNoldovaDesktop(contents: ReadonlyMap<ReleaseArchive, ReadonlyMap<string, Buffer>>): DesktopRangeReading {
    const findings: string[] = [];
    const ranges = new Set<string>();
    for (const [archive, entries] of contents) {
      const content = entries.get(Resources.moduleEntryName);
      if (content === undefined)
        continue;
      const archiveName = path.basename(archive.filePath);
      let field: unknown;
      try {
        field = GitHubJson.object(JSON.parse(content.toString(Resources.textEncoding)), archiveName)[Resources.noldovaDesktopField];
      }
      catch (error) {
        if (!(error instanceof SyntaxError || error instanceof GitHubException))
          throw error;
        findings.push(Resources.formatArchiveModuleFileInvalid(archiveName));
        continue;
      }
      const range = typeof field === "string" ? VersionRange.parse(field) : null;
      if (range === null)
        findings.push(Resources.formatNoldovaDesktopRangeInvalid(archiveName, field));
      else
        ranges.add(range.toString());
    }
    if (ranges.size > 1)
      findings.push(Resources.formatNoldovaDesktopRangesDiffer([...ranges]));
    return new DesktopRangeReading(findings.length === 0 && ranges.size === 1 ? [...ranges][0] ?? null : null, findings);
  }

  private static checkArchive(archive: ReleaseArchive, entries: ReadonlyMap<string, Buffer>, version: string, commit: string | null, scope: string, names: readonly string[],
    noldovaDesktop: string | null): readonly string[] {
    const archiveName = path.basename(archive.filePath);
    const content = entries.get(Resources.manifestEntryName);
    if (content === undefined)
      return [Resources.formatArchiveManifestMissing(archiveName)];

    const context = Resources.formatArchiveManifestContext(archiveName);
    const manifest = ArchiveCheck.parseObject(content.toString(Resources.textEncoding), context);
    const findings: string[] = [...ArchiveCheck.checkContents(archiveName, manifest, entries, noldovaDesktop)];
    const name = GitHubJson.text(manifest, Resources.nameField, context);
    if (name !== archive.part.name)
      findings.push(Resources.formatArchiveFieldDiffers(archiveName, Resources.nameField, name, archive.part.name));
    if (!name.startsWith(`${scope}${Resources.posixSeparator}`))
      findings.push(Resources.formatArchiveOutsideScope(archiveName, name, scope));

    const foundVersion = GitHubJson.text(manifest, Resources.versionField, context);
    if (foundVersion !== version)
      findings.push(Resources.formatArchiveFieldDiffers(archiveName, Resources.versionField, foundVersion, version));
    if (commit !== null && manifest[Resources.commitField] !== commit)
      findings.push(Resources.formatArchiveCommitDiffers(archiveName, manifest[Resources.commitField], commit));
    if (manifest[Resources.privateField] === true)
      findings.push(Resources.formatArchiveMarkedPrivate(archiveName));

    const dependencies = manifest[Resources.dependenciesField] === undefined ? null : GitHubJson.nullableChild(manifest, Resources.dependenciesField, context);
    if (dependencies !== null)
      for (const dependency of Object.keys(dependencies).filter(t => names.includes(t))) {
        const range = GitHubJson.text(dependencies, dependency, context);
        if (range !== version)
          findings.push(Resources.formatArchiveDependencyDiffers(archiveName, dependency, range, version));
      }

    return findings;
  }

  private static parseObject(text: string, context: string): Readonly<Record<string, unknown>> {
    try {
      return GitHubJson.object(JSON.parse(text), context);
    }
    catch (error) {
      throw new JsonObjectUnreadableException(context, error);
    }
  }

  // Every file the exports point to, a conditional export's each.
  private static readTargets(exports: unknown): readonly ExportTarget[] {
    if (typeof exports !== "object" || exports === null)
      return [];
    const targets: ExportTarget[] = [];
    for (const [subpath, target] of Object.entries(exports))
      for (const file of typeof target === "object" && target !== null ? Object.values(target) : [target])
        targets.push(new ExportTarget(subpath, String(file)));
    return targets;
  }

  private static checkContents(archiveName: string, manifest: Readonly<Record<string, unknown>>, entries: ReadonlyMap<string, Buffer>,
    noldovaDesktop: string | null): readonly string[] {
    const findings: string[] = [];
    const targets: readonly ExportTarget[] = ArchiveCheck.readTargets(manifest[Resources.exportsField]);
    if (targets.length === 0)
      findings.push(Resources.formatArchiveExportsNothing(archiveName));
    for (const { subpath, target } of targets)
      if (!entries.has(path.posix.join(Resources.archiveFolder, target)))
        findings.push(Resources.formatArchiveExportMissing(archiveName, subpath, target));
    if (targets.some(t => Resources.partExports.includes(t.subpath)) && !entries.has(Resources.moduleEntryName))
      findings.push(Resources.formatArchiveModuleFileMissing(archiveName));
    const packageName = manifest[Resources.nameField];
    const isWindow = typeof packageName === "string" && packageName.endsWith(Resources.windowSuffix);
    for (const field of Resources.pinFields) {
      const pins = manifest[field];
      for (const [name, pin] of typeof pins === "object" && pins !== null ? Object.entries(pins) : []) {
        if (noldovaDesktop !== null && field === Resources.peersField && VersionRange.isNoldovaDesktop(name)) {
          if (pin !== noldovaDesktop)
            findings.push(Resources.formatNoldovaDesktopPeerDiffers(archiveName, name, pin, field, noldovaDesktop));
          continue;
        }
        if (isWindow && field === Resources.peersField && VersionRange.isAngular(name)) {
          const range = typeof pin === "string" ? VersionRange.parse(pin) : null;
          if (range === null || range.toString() !== VersionRange.from(range.lowest).toString())
            findings.push(Resources.formatAngularPeerInvalid(archiveName, name, pin, field));
          continue;
        }
        const isRanged = field === Resources.peersField && VersionRange.isRanged(name);
        if (typeof pin !== "string" || !(Resources.archivePinPattern.test(pin) || (isRanged && VersionRange.parse(pin) !== null)))
          findings.push(Resources.formatArchivePinInvalid(archiveName, name, pin, field, isRanged));
      }
    }
    if (isWindow) {
      const peers = manifest[Resources.peersField];
      const meta = manifest[Resources.peersMetaField];
      const named: readonly string[] = typeof peers === "object" && peers !== null ? Object.keys(peers) : [];
      for (const peer of Resources.windowPeersNeeded.filter(t => !named.includes(t)))
        findings.push(Resources.formatArchiveWindowPeerMissing(archiveName, peer));
      for (const peer of named) {
        const entry: unknown = typeof meta === "object" && meta !== null ? Object.fromEntries(Object.entries(meta))[peer] : undefined;
        if (typeof entry !== "object" || entry === null || Object.fromEntries(Object.entries(entry))[Resources.optionalField] !== true)
          findings.push(Resources.formatArchivePeerNotOptional(archiveName, peer));
      }
    }
    const runtimeEntry: string | undefined = targets.find(t => t.subpath === Resources.runtimeExport && t.target.endsWith(Resources.scriptExtension))?.target;
    if (runtimeEntry !== undefined) {
      const peers = manifest[Resources.peersField];
      const named: readonly string[] = typeof peers === "object" && peers !== null ? Object.keys(peers) : [];
      const source: string = entries.get(path.posix.join(Resources.archiveFolder, runtimeEntry))?.toString("utf8") ?? "";
      for (const peer of Resources.modulePeersNeeded) {
        if (!named.includes(peer))
          findings.push(Resources.formatArchiveModulePeerMissing(archiveName, peer));
        if (!source.includes(`import "${peer}";`))
          findings.push(Resources.formatArchiveRuntimeImportMissing(archiveName, runtimeEntry, peer));
      }
    }
    return findings;
  }
}
