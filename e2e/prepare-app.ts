/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { copyFile, cp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { JsonReader, type JsonObject } from "@noldova/context.json";

import { PlainIcons } from "./fixtures/icons/plain-icons.ts";
import { LockfileParts } from "./fixtures/lockfile-parts.ts";
import { PackedPart } from "./fixtures/packed-part.ts";
import { TestAppLayout } from "./fixtures/test-app-layout.ts";

class FixtureAppPreparation {
  private static readonly MODULE_PACKAGE: string = "@noldova/browser";
  private static readonly MODULE_ID: string = "browser";
  private static readonly DOUBLE_DECLARATION: readonly string[] = ["src", "modules", "agent-double", "module.json"];
  private static readonly WEB_VIEWS_DECLARATION: string = "webViews.json";
  private static readonly RELAY_DOUBLE_FOLDER: readonly string[] = ["src", "modules", "relay-double"];
  private static readonly PART_FOLDERS: readonly string[] = ["noldova.browser", "noldova.browser.protocol", "noldova.browser.window"];
  private static readonly MANIFEST: string = "package.json";
  private static readonly LOCKFILE: string = "package-lock.json";
  private static readonly NPM_PATH_VARIABLE: string = "npm_execpath";
  private static readonly NO_NPM: string = "Run the preparation through npm run, which names npm's own script in npm_execpath.";
  private static readonly REFRESH_OPTION: string = "--refresh-lockfile";
  private static readonly INSTALL_FROM_LOCKFILE: readonly string[] = ["ci", "--ignore-scripts", "--no-audit", "--no-fund"];
  private static readonly INSTALL_AFRESH: readonly string[] = ["install", "--ignore-scripts", "--no-audit", "--no-fund"];
  private static readonly APP_STEPS: readonly (readonly string[])[] = [["run", "install:app"], ["run", "build:app"], ["run", "desktop-tools", "--", "help"]];

  private readonly npm: string;
  private readonly isRefresh: boolean;

  private constructor(npm: string, isRefresh: boolean) {
    this.npm = npm;
    this.isRefresh = isRefresh;
  }

  public static async runAsync(): Promise<void> {
    const npm = process.env[FixtureAppPreparation.NPM_PATH_VARIABLE];
    if (npm === undefined || npm === "")
      throw new Error(FixtureAppPreparation.NO_NPM);
    await new FixtureAppPreparation(npm, process.argv.includes(FixtureAppPreparation.REFRESH_OPTION)).prepareAsync();
  }

  private static formatFailure(command: readonly string[], code: number | null): string {
    return `npm ${command.join(" ")} in ${TestAppLayout.APP_FOLDER} ended with ${code === null ? "no exit code" : `exit code ${code}`}.`;
  }

  private static formatUnlisted(names: readonly string[]): string {
    return `The module's parts need ${names.join(", ")}, which the fixture app's ${FixtureAppPreparation.MANIFEST} doesn't list; add each to e2e/app/${FixtureAppPreparation.MANIFEST}, since the lockfile holds no part and a relock would prune a package only the parts reach.`;
  }

  private async prepareAsync(): Promise<void> {
    await cp(TestAppLayout.TEMPLATE_FOLDER, TestAppLayout.APP_FOLDER, { recursive: true, force: true, filter: t => !t.split(path.sep).includes("node_modules") });
    await copyFile(path.join(TestAppLayout.REPOSITORY_ROOT, "LICENSE"), path.join(TestAppLayout.APP_FOLDER, "LICENSE"));
    await PlainIcons.writeAsync(path.join(TestAppLayout.APP_FOLDER, "assets", "icons"));
    await copyFile(path.join(TestAppLayout.REPOSITORY_ROOT, "src", "noldova.browser", FixtureAppPreparation.WEB_VIEWS_DECLARATION),
      path.join(TestAppLayout.APP_FOLDER, ...FixtureAppPreparation.RELAY_DOUBLE_FOLDER, FixtureAppPreparation.WEB_VIEWS_DECLARATION));
    const parts = await Promise.all(FixtureAppPreparation.PART_FOLDERS.map(t => PackedPart.readAsync(path.join(TestAppLayout.REPOSITORY_ROOT, "src", t))));
    const template = JsonReader.parse(await readFile(path.join(TestAppLayout.TEMPLATE_FOLDER, FixtureAppPreparation.MANIFEST), "utf8"));
    const dependencies = template.readObject("dependencies").toJson();
    const archives = Object.fromEntries(parts.map(t => [t.name, t.fileSpecifier(TestAppLayout.APP_FOLDER)]));
    const unlisted = LockfileParts.findUnlisted(new Map(parts.map(t => [t.name, t.published])), dependencies);
    if (unlisted.length > 0)
      throw new Error(FixtureAppPreparation.formatUnlisted(unlisted));
    const installed = { ...dependencies, ...archives };
    await this.writeManifestAsync(template.toJson(), installed);
    if (this.isRefresh) {
      await rm(path.join(TestAppLayout.APP_FOLDER, FixtureAppPreparation.LOCKFILE), { force: true });
      await this.runAsync(FixtureAppPreparation.INSTALL_AFRESH);
      await FixtureAppPreparation.saveLockfileAsync(parts, dependencies);
    }
    else {
      await FixtureAppPreparation.swapPartsAsync(parts, installed);
      await this.runAsync(FixtureAppPreparation.INSTALL_FROM_LOCKFILE);
    }
    const module = parts.find(t => t.name === FixtureAppPreparation.MODULE_PACKAGE);
    if (module === undefined)
      throw new Error(`No part folder holds ${FixtureAppPreparation.MODULE_PACKAGE}.`);
    await FixtureAppPreparation.pinDoubleDependencyAsync(module.version);
    const pinned = { ...dependencies, [module.name]: module.version };
    await this.writeManifestAsync(template.toJson(), pinned);
    await this.pinLockfileAsync(pinned);
    for (const step of FixtureAppPreparation.APP_STEPS)
      await this.runAsync(step);
  }

  private static async pinDoubleDependencyAsync(version: string): Promise<void> {
    const file = path.join(TestAppLayout.APP_FOLDER, ...FixtureAppPreparation.DOUBLE_DECLARATION);
    const declaration = JsonReader.parse(await readFile(file, "utf8")).toJson();
    await writeFile(file, `${JSON.stringify({ ...declaration, dependencies: { [FixtureAppPreparation.MODULE_ID]: version } }, null, 2)}\n`);
  }

  private static async swapPartsAsync(parts: readonly PackedPart[], dependencies: JsonObject): Promise<void> {
    const file = path.join(TestAppLayout.APP_FOLDER, FixtureAppPreparation.LOCKFILE);
    const entries = new Map(parts.map(t => [t.name, LockfileParts.entry(t.published, t.fileSpecifier(TestAppLayout.APP_FOLDER))]));
    const lock = LockfileParts.withParts(JsonReader.parse(await readFile(file, "utf8")), entries, dependencies);
    await writeFile(file, `${JSON.stringify(lock, null, 2)}\n`);
  }

  private static async saveLockfileAsync(parts: readonly PackedPart[], dependencies: JsonObject): Promise<void> {
    const lock = JsonReader.parse(await readFile(path.join(TestAppLayout.APP_FOLDER, FixtureAppPreparation.LOCKFILE), "utf8"));
    const saved = LockfileParts.withoutParts(lock, parts.map(t => t.name), dependencies);
    await writeFile(path.join(TestAppLayout.TEMPLATE_FOLDER, FixtureAppPreparation.LOCKFILE), `${JSON.stringify(saved, null, 2)}\n`);
  }

  private async writeManifestAsync(template: JsonObject, dependencies: JsonObject): Promise<void> {
    await writeFile(path.join(TestAppLayout.APP_FOLDER, FixtureAppPreparation.MANIFEST), `${JSON.stringify({ ...template, dependencies }, null, 2)}\n`);
  }

  private async pinLockfileAsync(dependencies: JsonObject): Promise<void> {
    const file = path.join(TestAppLayout.APP_FOLDER, FixtureAppPreparation.LOCKFILE);
    const lock = JsonReader.parse(await readFile(file, "utf8"));
    const packages = lock.readObject("packages");
    const root = packages.readObject("").toJson();
    await writeFile(file, `${JSON.stringify({ ...lock.toJson(), packages: { ...packages.toJson(), "": { ...root, dependencies } } }, null, 2)}\n`);
  }

  private async runAsync(command: readonly string[]): Promise<void> {
    const child = spawn(process.execPath, [this.npm, ...command], { cwd: TestAppLayout.APP_FOLDER, stdio: "inherit" });
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", resolve);
    });
    if (code !== 0)
      throw new Error(FixtureAppPreparation.formatFailure(command, code));
  }
}

await FixtureAppPreparation.runAsync();
