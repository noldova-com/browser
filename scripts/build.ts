/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import path from "node:path";

import { AngularPackageBuilder } from "./angular/angular-package-builder.ts";
import { CdkCopyCheck } from "./checks/cdk-copy-check.ts";
import { PackageException } from "./exceptions/package.exception.ts";
import { ProcessException } from "./exceptions/process.exception.ts";
import { Resources } from "./resources.ts";
import { NpmCommand } from "./services/npm-command.ts";
import { PackageInstall } from "./services/package-install.ts";
import { PackagePacker } from "./services/package-packer.ts";
import { ProcessRunner } from "./services/process-runner.ts";

const root = path.dirname(import.meta.dirname);
const runner = new ProcessRunner();
const npm = new NpmCommand(runner, process.env);
const report = (line: string): void => console.error(line);
const packer = new PackagePacker(root, npm, runner, new AngularPackageBuilder(root, runner), new PackageInstall(root, npm), report);
const options = process.argv.slice(2);

async function hasOneCdkCopyAsync(): Promise<boolean> {
  try {
    return await new CdkCopyCheck(root, npm).runAsync(process.stderr);
  }
  catch (error) {
    if (!(error instanceof ProcessException))
      throw error;
    report(error.message);
    return false;
  }
}

async function listCopiesAsync(): Promise<number> {
  if (options.length !== 1) {
    report(Resources.formatTakesNoOtherOption(Resources.listCopiesOption));
    return 1;
  }
  try {
    for (const [source, name, entry] of await packer.listCopiesAsync())
      process.stdout.write(Resources.formatListedCopy(source, name, entry));
  }
  catch (error) {
    if (!(error instanceof PackageException))
      throw error;
    report(error.message);
    return 1;
  }
  process.stdout.write(Resources.endOfCopies);
  return 0;
}

async function installAsync(): Promise<number> {
  if (existsSync(path.join(root, Resources.modulesFolder)))
    return 0;
  const npmPath = process.env[Resources.npmPathVariable];
  if (npmPath === undefined || npmPath.length === 0) {
    report(Resources.runThroughNpmRunBuild);
    return 1;
  }
  report(Resources.installingPackages);
  return await runner.runAsync(process.execPath, [npmPath, ...Resources.cleanInstallArguments], root);
}

async function buildAsync(): Promise<number> {
  const installed = await installAsync();
  if (installed !== 0)
    return installed;
  if (!await hasOneCdkCopyAsync())
    return 1;
  return await packer.runAsync();
}

process.exitCode = options.includes(Resources.listCopiesOption) ? await listCopiesAsync() : await buildAsync();
