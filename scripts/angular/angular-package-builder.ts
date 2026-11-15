/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { AngularCompileFailedException } from "../exceptions/angular-compile-failed.exception.ts";
import { AngularCompileTimedOutException } from "../exceptions/angular-compile-timed-out.exception.ts";
import { AngularCompilerCommandMissingException } from "../exceptions/angular-compiler-command-missing.exception.ts";
import { AngularCompilerMissingException } from "../exceptions/angular-compiler-missing.exception.ts";
import { AngularEntriesMissingException } from "../exceptions/angular-entries-missing.exception.ts";
import { ProcessTimeoutException } from "../exceptions/process-timeout.exception.ts";
import { Resources } from "../resources.ts";
import type { ProcessRunner } from "../services/process-runner.ts";

export class AngularPackageBuilder {
  private readonly root: string;
  private readonly runner: ProcessRunner;

  public constructor(root: string, runner: ProcessRunner) {
    this.root = root;
    this.runner = runner;
  }

  public async compileAsync(project: string, sources: string, output: string): Promise<void> {
    const entries = path.join(sources, Resources.apiFolder);
    const files = existsSync(entries)
      ? (await readdir(entries)).filter(t => t.endsWith(Resources.sourceExtension) && !t.endsWith(Resources.declarationExtension)).sort().map(t => path.join(entries, t))
      : [];
    if (files.length === 0)
      throw new AngularEntriesMissingException(entries);

    const workFolder = path.join(this.root, ...Resources.angularWorkSegments);
    await mkdir(workFolder, { recursive: true });
    const work = await mkdtemp(path.join(workFolder, Resources.angularWorkPrefix));
    try {
      const configuration = path.join(work, Resources.projectFile);
      await writeFile(configuration, `${JSON.stringify({
        extends: path.join(project, Resources.projectFile),
        compilerOptions: {
          rootDir: sources,
          outDir: output,
          declaration: false,
          sourceMap: true,
          types: []
        },
        angularCompilerOptions: { compilationMode: Resources.partialCompilationMode },
        files,
        include: []
      }, null, Resources.jsonIndent)}${Resources.lineFeed}`);
      const compiler = await this.locateCompilerAsync();
      const result = await this.runner.captureAsync(process.execPath, [compiler, Resources.compilerProjectOption, configuration], project, Resources.angularCompileTimeout)
        .catch((error: unknown) => {
          if (error instanceof ProcessTimeoutException)
            throw new AngularCompileTimedOutException(sources, Resources.angularCompileTimeout, error);
          throw error;
        });
      if (!result.isSuccessful)
        throw new AngularCompileFailedException(sources, result.exitCode, result.text);
    }
    finally {
      await rm(work, { recursive: true, force: true });
    }
  }

  private async locateCompilerAsync(): Promise<string> {
    const manifest = path.join(this.root, ...Resources.compilerManifest);
    if (!existsSync(manifest))
      throw new AngularCompilerMissingException(this.root);
    const parsed: unknown = JSON.parse(await readFile(manifest, Resources.textEncoding));
    const commands: unknown = typeof parsed === "object" && parsed !== null && "bin" in parsed ? parsed.bin : undefined;
    const command: unknown = typeof commands === "object" && commands !== null ? Object.fromEntries(Object.entries(commands))[Resources.compilerCommand] : undefined;
    if (typeof command !== "string")
      throw new AngularCompilerCommandMissingException(manifest, Resources.compilerCommand);
    return path.join(path.dirname(manifest), command);
  }
}
