/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { VersionRange } from "../models/version-range.ts";
import { Resources } from "../resources.ts";

type JsonObject = { readonly [key: string]: unknown };

class DeclarationCheck {
  private readonly root: string;
  private readonly problems: string[] = [];

  public constructor(root: string) {
    this.root = root;
  }

  public run(): readonly string[] {
    const packageRoot: string = join(this.root, Resources.moduleFolder);
    const declaration: JsonObject | null = this.readObject(join(packageRoot, Resources.moduleFile));
    const packageManifest: JsonObject | null = this.readObject(join(packageRoot, Resources.manifestFile));
    const windowManifest: JsonObject | null = this.readObject(join(this.root, Resources.windowFolder, Resources.manifestFile));
    const rootManifest: JsonObject | null = this.readObject(join(this.root, Resources.manifestFile));
    if (declaration !== null)
      this.checkDeclaration(declaration, packageRoot, packageManifest);
    if (declaration !== null && packageManifest !== null)
      this.checkPackageManifest(packageManifest, declaration);
    const noldovaDesktop: VersionRange | null = declaration === null ? null : this.readNoldovaDesktop(declaration);
    if (packageManifest !== null && windowManifest !== null && rootManifest !== null)
      this.checkPins(packageManifest, windowManifest, rootManifest, noldovaDesktop);
    return this.problems;
  }

  private checkDeclaration(declaration: JsonObject, packageRoot: string, packageManifest: JsonObject | null): void {
    const fields: readonly string[] = Object.keys(declaration);
    if (fields.length !== Resources.moduleFields.length || Resources.moduleFields.some(t => !fields.includes(t)))
      this.problems.push(Resources.moduleFieldsInvalid);
    const id: unknown = declaration[Resources.idField];
    if (typeof id !== "string" || !Resources.idPattern.test(id) || id === Resources.reservedModuleId) {
      this.problems.push(Resources.moduleIdInvalid);
      return;
    }
    const version: unknown = declaration[Resources.versionField];
    if (typeof version !== "string" || !Resources.versionPattern.test(version))
      this.problems.push(Resources.moduleVersionInvalid);
    for (const field of Resources.textFields) {
      const value: unknown = declaration[field];
      if (typeof value !== "string" || value.trim() === '')
        this.problems.push(Resources.formatModuleTextBlank(field));
    }
    const exported: unknown = packageManifest?.[Resources.exportsField];
    for (const part of this.readTexts(declaration, Resources.partsField)) {
      const target: unknown = DeclarationCheck.isObject(exported) ? exported[Resources.formatPartExport(part)] : undefined;
      if (!Resources.partNames.includes(part))
        this.problems.push(Resources.formatModulePartUnknown(part));
      else if (typeof target !== "string" || !existsSync(join(packageRoot, target)))
        this.problems.push(Resources.formatModulePartExportMissing(part));
    }
    this.checkDependencies(declaration[Resources.dependenciesField], id);
    this.checkContributions(declaration[Resources.contributesField], id);
  }

  private checkDependencies(dependencies: unknown, id: string): void {
    if (!DeclarationCheck.isObject(dependencies)) {
      this.problems.push(Resources.moduleDependenciesInvalid);
      return;
    }
    for (const [dependency, version] of Object.entries(dependencies)) {
      if (!Resources.idPattern.test(dependency) || dependency === id)
        this.problems.push(Resources.formatModuleDependencyInvalid(dependency));
      else if (typeof version !== "string" || !Resources.versionPattern.test(version))
        this.problems.push(Resources.formatModuleDependencyVersionInvalid(dependency));
    }
  }

  private checkContributions(contributes: unknown, id: string): void {
    if (!DeclarationCheck.isObject(contributes)) {
      this.problems.push(Resources.moduleContributesInvalid);
      return;
    }
    for (const kind of Object.keys(contributes)) {
      if (!Resources.contributionKinds.includes(kind)) {
        this.problems.push(Resources.formatModuleKindUnknown(kind));
        continue;
      }
      for (const name of this.readTexts(contributes, kind)) {
        if (kind === Resources.toolsKind) {
          this.checkToolName(name, id);
          continue;
        }
        const [owner, local, ...rest] = name.split(Resources.versionSeparator);
        if (owner !== id || local === undefined || !Resources.namePattern.test(local) || rest.length > 0)
          this.problems.push(Resources.formatModuleContributionInvalid(kind, name, id));
      }
    }
  }

  private checkToolName(name: string, id: string): void {
    const prefix: string = Resources.formatToolPrefix(id);
    if (!Resources.toolPattern.test(name) || !name.startsWith(prefix) || name.length === prefix.length)
      this.problems.push(Resources.formatToolNameInvalid(name, prefix));
  }

  private checkPackageManifest(packageManifest: JsonObject, declaration: JsonObject): void {
    if (packageManifest[Resources.nameField] !== Resources.modulePackageName)
      this.problems.push(Resources.packageNameRequired);
    if (packageManifest[Resources.versionField] !== declaration[Resources.versionField])
      this.problems.push(Resources.packageVersionDiffers);
    if (packageManifest[Resources.privateField] !== undefined)
      this.problems.push(Resources.packagePrivate);
  }

  private readNoldovaDesktop(declaration: JsonObject): VersionRange | null {
    const text: unknown = declaration[Resources.noldovaDesktopField];
    const range: VersionRange | null = typeof text === "string" ? VersionRange.parse(text) : null;
    if (range === null || range.toString() !== VersionRange.from(range.lowest).toString()) {
      this.problems.push(Resources.noldovaDesktopInvalid);
      return null;
    }
    return range;
  }

  private checkPins(packageManifest: JsonObject, windowManifest: JsonObject, rootManifest: JsonObject, noldovaDesktop: VersionRange | null): void {
    const builtAgainst: JsonObject[] = [];
    for (const field of Resources.dependencyFields.slice(1)) {
      if (field !== Resources.peersField)
        this.readPins(packageManifest, field, Resources.packageManifest);
      const pins: JsonObject = this.readPins(rootManifest, field, Resources.rootManifest);
      if (field === Resources.devDependenciesField)
        builtAgainst.push(pins);
    }
    this.checkPeers(packageManifest, noldovaDesktop);
    const packagePins: JsonObject = this.readPins(packageManifest, Resources.dependenciesField, Resources.packageManifest);
    const windowPins: JsonObject = this.readPins(windowManifest, Resources.dependenciesField, Resources.windowPackageManifest);
    const rootPins: JsonObject = this.readPins(rootManifest, Resources.dependenciesField, Resources.rootManifest);
    for (const name of Object.keys(packagePins).filter(t => !t.startsWith(Resources.ownPackagePrefix))) {
      if (packagePins[name] !== rootPins[name])
        this.problems.push(Resources.formatPinDiffers(name, Resources.packageManifestName));
    }
    for (const name of Object.keys(windowPins).filter(t => Object.hasOwn(rootPins, t))) {
      if (windowPins[name] !== rootPins[name])
        this.problems.push(Resources.formatPinDiffers(name, Resources.windowPackageManifestName));
    }
    for (const [name, pin] of [...builtAgainst, windowPins].flatMap(t => Object.entries(t)))
      if (VersionRange.isNoldovaDesktop(name) && noldovaDesktop !== null && typeof pin === "string" && !noldovaDesktop.includes(pin))
        this.problems.push(Resources.formatNoldovaDesktopBuildOutsideRange(name, pin, noldovaDesktop.toString()));
    for (const name of Object.keys(rootPins)) {
      if (!Object.hasOwn(packagePins, name) && !Object.hasOwn(windowPins, name))
        this.problems.push(Resources.formatRootPinUnlisted(name));
    }
  }

  private checkPeers(packageManifest: JsonObject, noldovaDesktop: VersionRange | null): void {
    const peers: unknown = packageManifest[Resources.peersField] ?? {};
    if (!DeclarationCheck.isObject(peers)) {
      this.problems.push(Resources.packagePeersInvalid);
      return;
    }
    for (const [name, needed] of Object.entries(peers)) {
      const text: string = typeof needed === "string" ? needed : '';
      if (VersionRange.isNoldovaDesktop(name)) {
        if (noldovaDesktop !== null && text !== noldovaDesktop.toString())
          this.problems.push(Resources.formatPackageNoldovaDesktopPeerDiffers(name, noldovaDesktop.toString()));
      }
      else if (!Resources.declarationPinPattern.test(text) && !(VersionRange.isRanged(name) && VersionRange.parse(text) !== null))
        this.problems.push(Resources.formatPackagePeerPinInvalid(name, VersionRange.isRanged(name)));
    }
  }

  private readPins(manifest: JsonObject, field: string, description: string): JsonObject {
    const dependencies: unknown = manifest[field] ?? {};
    if (!DeclarationCheck.isObject(dependencies)) {
      this.problems.push(Resources.formatFieldNotObject(description, field));
      return {};
    }
    for (const [name, version] of Object.entries(dependencies)) {
      if (typeof version !== "string" || !Resources.declarationPinPattern.test(version))
        this.problems.push(Resources.formatManifestPinInvalid(description, name, field));
    }
    return dependencies;
  }

  private readTexts(owner: JsonObject, field: string): readonly string[] {
    const values: unknown = owner[field];
    if (!Array.isArray(values) || values.some(t => typeof t !== "string")) {
      this.problems.push(Resources.formatModuleListInvalid(field));
      return [];
    }
    if (new Set(values).size !== values.length)
      this.problems.push(Resources.formatModuleListRepeats(field));
    return values;
  }

  private readObject(path: string): JsonObject | null {
    let value: unknown;
    try {
      value = JSON.parse(readFileSync(path, Resources.textEncoding));
    }
    catch (error) {
      this.problems.push(Resources.formatReadFailed(path, error));
      return null;
    }
    if (DeclarationCheck.isObject(value))
      return value;
    this.problems.push(Resources.formatObjectRequired(path));
    return null;
  }

  private static isObject(value: unknown): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}

const problems: readonly string[] = new DeclarationCheck(process.cwd()).run();
for (const problem of problems)
  console.error(problem);
process.exitCode = problems.length > 0 ? 1 : 0;
