/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { CompilerOptions } from "typescript";

import type { AngularPackageBuilder } from "../angular/angular-package-builder.ts";
import { CompileFailedException } from "../exceptions/compile-failed.exception.ts";
import { CompiledMissingException } from "../exceptions/compiled-missing.exception.ts";
import { ExportSourceInvalidException } from "../exceptions/export-source-invalid.exception.ts";
import { ExportsInvalidException } from "../exceptions/exports-invalid.exception.ts";
import { FieldNotObjectException } from "../exceptions/field-not-object.exception.ts";
import { GitHubException } from "../exceptions/github.exception.ts";
import { JsonObjectRequiredException } from "../exceptions/json-object-required.exception.ts";
import { ModuleVersionDiffersException } from "../exceptions/module-version-differs.exception.ts";
import { NoldovaDesktopMissingException } from "../exceptions/noldova-desktop-missing.exception.ts";
import { OwnPinDiffersException } from "../exceptions/own-pin-differs.exception.ts";
import { PackFailedException } from "../exceptions/pack-failed.exception.ts";
import { PackagePrivateException } from "../exceptions/package-private.exception.ts";
import { PackageException } from "../exceptions/package.exception.ts";
import { ReadmeMissingException } from "../exceptions/readme-missing.exception.ts";
import { VersionMissingException } from "../exceptions/version-missing.exception.ts";
import type { ProcessResult } from "../models/process-result.ts";
import { VersionRange } from "../models/version-range.ts";
import { Resources } from "../resources.ts";
import { ArchiveCheck } from "./archive-check.ts";
import { Git } from "./git.ts";
import type { NpmCommand } from "./npm-command.ts";
import { PackageImports } from "./package-imports.ts";
import type { PackageInstall } from "./package-install.ts";
import { PackageLayout } from "./package-layout.ts";
import type { ProcessRunner } from "./process-runner.ts";

type JsonObject = { readonly [key: string]: unknown };

export class PackagePacker {
  private readonly root: string;
  private readonly npm: NpmCommand;
  private readonly runner: ProcessRunner;
  private readonly angular: AngularPackageBuilder;
  private readonly install: PackageInstall;
  private readonly report: (line: string) => void;

  public constructor(root: string, npm: NpmCommand, runner: ProcessRunner, angular: AngularPackageBuilder, install: PackageInstall, report: (line: string) => void) {
    this.root = root;
    this.npm = npm;
    this.runner = runner;
    this.angular = angular;
    this.install = install;
    this.report = report;
  }

  public async runAsync(): Promise<number> {
    try {
      const version = await this.readModuleVersionAsync();
      await this.checkVersionFilesAsync(version);
      const commit = await this.readCommitAsync();
      await rm(path.join(this.root, Resources.archivesFolder), { recursive: true, force: true });
      await this.packProtocolAsync(version, commit);
      await this.install.installPackedAsync();
      await this.packWindowAsync(version, commit);
      await this.install.installPackedAsync();
      await this.packModuleAsync(version, commit);
      await new ArchiveCheck(this.root).checkAsync(Resources.archivesFolder, version, commit, Resources.scope);
      return 0;
    }
    catch (error) {
      if (!(error instanceof PackageException || error instanceof GitHubException))
        throw error;
      this.report(error.message);
      return 1;
    }
  }

  public async listCopiesAsync(): Promise<readonly (readonly [string, string, string])[]> {
    const copies: (readonly [string, string, string])[] = [];
    for (const part of await new PackageLayout(this.root).readPackagesAsync()) {
      copies.push([Resources.licenseFile, part.name, Resources.licenseFile]);
      copies.push([path.posix.join(part.folder, Resources.readmeFile), part.name, Resources.readmeFile]);
      if (part.folder === Resources.moduleFolder)
        copies.push(...this.listModuleFiles().map(t => [path.posix.join(Resources.moduleFolder, t), part.name, t] as const));
    }
    return copies;
  }

  private static manifestOf(manifest: JsonObject, file: string): JsonObject {
    const exports: unknown = manifest[Resources.exportsField];
    if (typeof exports !== "object" || exports === null || Array.isArray(exports))
      throw new ExportsInvalidException(file);
    const mapped = Object.entries(exports).map(([subpath, target]) => {
      if (target === Resources.manifestExport)
        return [subpath, target] as const;
      if (typeof target !== "string" || !target.endsWith(Resources.sourceExtension) || target.endsWith(Resources.declarationExtension))
        throw new ExportSourceInvalidException(file, subpath);
      const stem = target.slice(0, -Resources.sourceExtension.length);
      return [subpath, { types: `${stem}${Resources.declarationExtension}`, default: `${stem}${Resources.scriptExtension}` }] as const;
    });
    return { ...manifest, [Resources.exportsField]: Object.fromEntries(mapped) };
  }

  private static readPins(manifest: JsonObject, file: string): ReadonlyMap<string, string> {
    const pins = new Map<string, string>();
    for (const field of [Resources.dependenciesField, Resources.peersField]) {
      const entries: unknown = manifest[field] ?? {};
      if (typeof entries !== "object" || entries === null || Array.isArray(entries))
        throw new FieldNotObjectException(file, field);
      for (const [name, pin] of Object.entries(entries))
        if (typeof pin === "string")
          pins.set(name, pin);
    }
    return pins;
  }

  private static require(result: ProcessResult, packageName: string): void {
    if (!result.isSuccessful)
      throw new PackFailedException(packageName, result.exitCode, result.text);
  }

  private async packProtocolAsync(version: string, commit: string | null): Promise<void> {
    const folder = Resources.protocolFolder;
    await this.compileAsync(folder);
    const output = this.locateWork(folder);
    await rm(output, { recursive: true, force: true });
    await this.copyCompiledAsync(folder, path.join(output, Resources.sourceFolder));
    await this.copyDeclarationsAsync(path.join(this.root, folder, Resources.sourceFolder), path.join(output, Resources.sourceFolder));
    const file = path.posix.join(folder, Resources.manifestFile);
    await this.finishAsync(folder, output, await this.publishImportsAsync(await this.readManifestAsync(file, version), file, output, version), commit);
  }

  private async packWindowAsync(version: string, commit: string | null): Promise<void> {
    const folder = Resources.windowFolder;
    const output = this.locateWork(folder);
    await rm(output, { recursive: true, force: true });
    const sources = path.join(this.root, folder, Resources.sourceFolder);
    await this.angular.compileAsync(path.join(this.root, folder), sources, path.join(output, Resources.sourceFolder));
    await this.copyDeclarationsAsync(sources, path.join(output, Resources.sourceFolder));
    const file = path.posix.join(folder, Resources.manifestFile);
    await this.finishAsync(folder, output, await this.publishImportsAsync(await this.readManifestAsync(file, version), file, output, version), commit);
  }

  private async publishImportsAsync(manifest: JsonObject, file: string, output: string, version: string): Promise<JsonObject> {
    const { dependencies, peers: pinned } = await PackageImports.resolveAsync(path.join(output, Resources.sourceFolder), PackagePacker.readPins(manifest, file), version,
      file);
    const noldovaDesktop = await this.readNoldovaDesktopAsync();
    const peers = new Map([...pinned].map(([name, pin]): [string, string] => [name, PackagePacker.readPeerRange(name, pin, noldovaDesktop)]));
    const { dependencies: _, devDependencies: __, scripts: ___, allowScripts: ____, ...published } = manifest;
    const sorted = (pins: ReadonlyMap<string, string>): JsonObject => Object.fromEntries([...pins].sort(([a], [b]) => a.localeCompare(b)));
    return PackagePacker.manifestOf({
      ...published,
      [Resources.dependenciesField]: sorted(dependencies),
      [Resources.peersField]: sorted(peers),
      [Resources.peersMetaField]: Object.fromEntries([...peers.keys()].sort().map(t => [t, { [Resources.optionalField]: true }]))
    }, file);
  }

  private async packModuleAsync(version: string, commit: string | null): Promise<void> {
    await this.compileAsync(Resources.moduleFolder);
    const source = path.join(this.root, Resources.moduleFolder);
    const output = this.locateWork(Resources.moduleFolder);
    await rm(output, { recursive: true, force: true });
    await mkdir(output, { recursive: true });
    for (const file of this.listModuleFiles())
      await copyFile(path.join(source, file), path.join(output, file));
    const sources = path.join(source, Resources.sourceFolder);
    const compiled = path.join(output, Resources.sourceFolder);
    await this.copyCompiledAsync(Resources.moduleFolder, compiled);
    await this.copyDeclarationsAsync(sources, compiled);
    const { default: typescript } = await import("typescript");
    const options: CompilerOptions = { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2025, verbatimModuleSyntax: true };
    const entry = path.join(Resources.apiFolder, Resources.windowEntry);
    const script = typescript.transpileModule(await readFile(path.join(sources, entry), Resources.textEncoding), { compilerOptions: options }).outputText;
    await writeFile(path.join(compiled, `${entry.slice(0, -Resources.sourceExtension.length)}${Resources.scriptExtension}`), script);
    const file = path.posix.join(Resources.moduleFolder, Resources.manifestFile);
    const manifest = await this.readManifestAsync(file, version);
    const own = [...PackagePacker.readPins(manifest, file)].filter(([name]) => name.startsWith(Resources.ownPackagePrefix));
    for (const [name, pin] of own)
      if (pin !== version)
        throw new OwnPinDiffersException(file, name, pin, version);
    await this.finishAsync(Resources.moduleFolder, output, PackagePacker.manifestOf(manifest, file), commit);
  }

  private async copyCompiledAsync(folder: string, target: string): Promise<void> {
    const part = path.posix.relative(Resources.sourceFolder, folder);
    const compiled = path.join(this.root, ...Resources.compiledSegments, part, Resources.sourceFolder);
    if (!existsSync(compiled))
      throw new CompiledMissingException(path.posix.join(...Resources.compiledSegments, part, Resources.sourceFolder));
    for (const file of (await readdir(compiled, { recursive: true })).filter(t => t.endsWith(Resources.scriptExtension))) {
      await mkdir(path.dirname(path.join(target, file)), { recursive: true });
      await copyFile(path.join(compiled, file), path.join(target, file));
    }
  }

  private async copyDeclarationsAsync(sources: string, target: string): Promise<void> {
    for (const file of (await readdir(sources, { recursive: true })).filter(t => t.endsWith(Resources.declarationExtension))) {
      await mkdir(path.dirname(path.join(target, file)), { recursive: true });
      const text = await readFile(path.join(sources, file), Resources.textEncoding);
      await writeFile(path.join(target, file), text.replace(Resources.declarationImportPattern, Resources.declarationImportReplacement));
    }
  }

  private async finishAsync(folder: string, output: string, manifest: JsonObject, commit: string | null): Promise<void> {
    const readme = path.join(this.root, folder, Resources.readmeFile);
    if (!existsSync(readme))
      throw new ReadmeMissingException(folder, String(manifest[Resources.nameField]));
    await mkdir(output, { recursive: true });
    await copyFile(path.join(this.root, Resources.licenseFile), path.join(output, Resources.licenseFile));
    await copyFile(readme, path.join(output, Resources.readmeFile));
    const stamped: JsonObject = commit === null ? manifest : { ...manifest, [Resources.commitField]: commit };
    await writeFile(path.join(output, Resources.manifestFile), `${JSON.stringify(stamped, null, Resources.jsonIndent)}${Resources.lineFeed}`);
    const archives = path.join(this.root, Resources.archivesFolder);
    await mkdir(archives, { recursive: true });
    PackagePacker.require(await this.npm.runAsync([...Resources.packArguments, archives], output), String(manifest[Resources.nameField]));
  }

  private async compileAsync(folder: string): Promise<void> {
    const compiled = await this.runner.runAsync(process.execPath,
      [path.join(this.root, ...Resources.typeScriptCompiler), Resources.projectOption, path.posix.join(folder, Resources.projectFile)], this.root);
    if (compiled !== 0)
      throw new CompileFailedException(folder, compiled);
  }

  private listModuleFiles(): readonly string[] {
    return Resources.moduleFiles.filter(t => existsSync(path.join(this.root, Resources.moduleFolder, t)));
  }

  private async readCommitAsync(): Promise<string | null> {
    if (!existsSync(path.join(this.root, Resources.gitFolder)))
      return null;
    const git = new Git(this.root, this.runner);
    if ((await git.readOutputAsync(Resources.statusArguments)).length > 0)
      return null;
    return (await git.readOutputAsync(Resources.commitArguments)).trim();
  }

  private async readModuleVersionAsync(): Promise<string> {
    const file = path.posix.join(Resources.moduleFolder, Resources.moduleFile);
    const version: unknown = (await this.readJsonAsync(file))[Resources.versionField];
    if (typeof version !== "string")
      throw new VersionMissingException(file);
    return version;
  }

  private static readPeerRange(name: string, pin: string, noldovaDesktop: VersionRange): string {
    if (VersionRange.isNoldovaDesktop(name))
      return noldovaDesktop.toString();
    const range: VersionRange | null = VersionRange.parse(pin);
    if (range !== null)
      return range.toString();
    return VersionRange.isRanged(name) || VersionRange.isAngular(name) ? VersionRange.from(pin).toString() : pin;
  }

  private async readNoldovaDesktopAsync(): Promise<VersionRange> {
    const file = path.posix.join(Resources.moduleFolder, Resources.moduleFile);
    const range: unknown = (await this.readJsonAsync(file))[Resources.noldovaDesktopField];
    const parsed = typeof range === "string" ? VersionRange.parse(range) : null;
    if (parsed === null)
      throw new NoldovaDesktopMissingException(file);
    return parsed;
  }

  private async checkVersionFilesAsync(version: string): Promise<void> {
    for (const file of Resources.versionFiles) {
      const found: unknown = (await this.readJsonAsync(file))[Resources.versionField];
      if (found !== version)
        throw new ModuleVersionDiffersException(file, String(found), version);
    }
  }

  private async readManifestAsync(file: string, version: string): Promise<JsonObject> {
    const manifest = await this.readJsonAsync(file);
    if (manifest[Resources.versionField] !== version)
      throw new ModuleVersionDiffersException(file, String(manifest[Resources.versionField]), version);
    if (manifest[Resources.privateField] !== undefined)
      throw new PackagePrivateException(file);
    return manifest;
  }

  private async readJsonAsync(file: string): Promise<JsonObject> {
    const json: unknown = JSON.parse(await readFile(path.join(this.root, file), Resources.textEncoding));
    if (typeof json !== "object" || json === null || Array.isArray(json))
      throw new JsonObjectRequiredException(file);
    return Object.fromEntries(Object.entries(json));
  }

  private locateWork(folder: string): string {
    return path.join(this.root, ...Resources.workSegments, path.posix.basename(folder));
  }
}
