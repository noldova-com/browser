/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawnSync } from "node:child_process";
import type { SpawnSyncReturns } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Writable } from "node:stream";

import { Resources } from "../resources.ts";

class OnPushCheck {
  private readonly root: string;
  private readonly output: Writable;

  public constructor(root: string, output: Writable) {
    this.root = root;
    this.output = output;
  }

  public async runAsync(): Promise<boolean> {
    const listed: SpawnSyncReturns<string> = spawnSync(Resources.gitCommand, Resources.trackedSourcesArguments, { cwd: this.root, encoding: Resources.textEncoding });
    if (listed.error !== undefined || listed.status !== 0) {
      this.output.write(Resources.formatListFilesFailed(listed.error?.message ?? listed.stderr));
      return false;
    }
    const files: string[] = listed.stdout.split(Resources.nullSeparator).filter(t => Resources.componentSourcePattern.test(t)).sort();
    if (files.length === 0) {
      this.output.write(Resources.onPushFilesMissing);
      return false;
    }
    let passed: boolean = true;
    for (const file of files) {
      const text: string = await readFile(join(this.root, file), Resources.textEncoding);
      for (const match of text.matchAll(Resources.changeDetectionPattern)) {
        const line: number = text.slice(0, match.index).split(Resources.lineFeed).length;
        this.output.write(Resources.formatChangeDetectionRefused(file, line));
        passed = false;
      }
    }
    return passed;
  }
}

process.exitCode = await new OnPushCheck(process.cwd(), process.stderr).runAsync() ? 0 : 1;
