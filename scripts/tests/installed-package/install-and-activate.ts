/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { copyFile, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ProcessException } from "../../exceptions/process.exception.ts";
import { Resources } from "../../resources.ts";
import { NpmCommand } from "../../services/npm-command.ts";
import { ProcessRunner } from "../../services/process-runner.ts";

class InstalledPackage {
  private static readonly root: string = path.resolve(import.meta.dirname, "..", "..", "..");
  private readonly runner: ProcessRunner = new ProcessRunner();
  private readonly npm: NpmCommand = new NpmCommand(this.runner, process.env);

  private static async listAsync(folder: string, prefix: string): Promise<readonly string[]> {
    return (await readdir(folder)).filter(t => t.startsWith(prefix) && t.endsWith(Resources.archiveExtension)).sort().map(t => path.join(folder, t));
  }

  private static async emptyAsync(folder: string): Promise<string> {
    await rm(folder, { recursive: true, force: true });
    await mkdir(folder, { recursive: true });
    return folder;
  }

  public async runAsync(): Promise<number> {
    const npmPath: string | undefined = process.env[Resources.npmPathVariable];
    if (npmPath === undefined || npmPath.length === 0) {
      console.error(Resources.fixtureNpmMissing);
      return 1;
    }
    const archives: readonly string[] = await InstalledPackage.listAsync(path.join(InstalledPackage.root, Resources.archivesFolder), Resources.fixtureArchivePrefix);
    if (archives.length !== Resources.fixtureArchiveCount) {
      console.error(Resources.fixtureArchivesMissing);
      return 1;
    }
    const variable: string | undefined = process.env[Resources.runnerTempVariable];
    const work: string = variable === undefined || variable.length === 0 ? await mkdtemp(path.join(tmpdir(), Resources.fixtureWorkPrefix)) : variable;
    const app: string = await InstalledPackage.emptyAsync(path.join(work, Resources.fixtureAppFolder));
    const peers: string = await InstalledPackage.emptyAsync(path.join(work, Resources.fixturePeersFolder));
    for (const name of Resources.fixturePeers) {
      const result = await this.npm.runAsync([...Resources.fixturePackArguments, path.join(InstalledPackage.root, Resources.modulesFolder, ...name.split("/"))], peers);
      if (!result.isSuccessful) {
        console.error(`${result.output}${result.errorOutput}${Resources.lineFeed}${Resources.fixturePeersMissing}`);
        return 1;
      }
    }
    const packed: readonly string[] = await InstalledPackage.listAsync(peers, "");
    if (packed.length !== Resources.fixturePeers.length) {
      console.error(Resources.fixturePeersMissing);
      return 1;
    }
    for (const file of Resources.fixtureScriptFiles) {
      await mkdir(path.dirname(path.join(app, file)), { recursive: true });
      await copyFile(path.join(InstalledPackage.root, file), path.join(app, file));
    }
    await writeFile(path.join(app, Resources.manifestFile), Resources.fixtureManifest);
    await writeFile(path.join(app, Resources.projectFile), Resources.fixtureProject);
    const installed: number = await this.runner.runAsync(process.execPath, [npmPath, ...Resources.fixtureInstallArguments, ...archives, ...packed], app);
    if (installed !== 0)
      return installed;
    const compiled: number = await this.runner.runAsync(process.execPath, [path.join(InstalledPackage.root, Resources.typeScriptCompilerPath), Resources.projectOption, Resources.projectFile], app);
    return compiled !== 0 ? compiled : await this.runner.runAsync(process.execPath, [Resources.fixtureActivateScript], app);
  }
}

try {
  process.exitCode = await new InstalledPackage().runAsync();
}
catch (error) {
  if (!(error instanceof ProcessException))
    throw error;
  console.error(error.message);
  process.exitCode = 1;
}
