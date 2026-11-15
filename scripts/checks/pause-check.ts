/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { Writable } from "node:stream";

import { PauseRefusal } from "../models/pause-refusal.ts";
import { Resources } from "../resources.ts";

class PauseCheck {
  private readonly root: string;
  private readonly output: Writable;

  public constructor(root: string, output: Writable) {
    this.root = root;
    this.output = output;
  }

  public async runAsync(): Promise<boolean> {
    const files: string[] = [];
    let passed: boolean = true;
    for (const folder of await PauseCheck.listFoldersAsync(join(this.root, Resources.sourceFolder))) {
      const tests: string[] = [];
      for (const candidate of [folder, ...await PauseCheck.listFoldersAsync(folder)])
        if (existsSync(join(candidate, Resources.testsFolder)))
          tests.push(join(candidate, Resources.testsFolder));
      for (const testsFolder of tests)
        files.push(...await PauseCheck.listTestFilesAsync(testsFolder));
      if (tests.length === 0 && existsSync(join(folder, Resources.manifestFile))) {
        this.output.write(Resources.formatPauseTestsMissing(relative(this.root, folder)));
        passed = false;
      }
    }
    if (files.length === 0) {
      this.output.write(Resources.pauseFilesMissing);
      return false;
    }
    for (const file of files) {
      const text: string = await readFile(file, Resources.textEncoding);
      for (const refusal of PauseCheck.refuse(text)) {
        this.output.write(Resources.formatPauseRefusal(relative(this.root, file), refusal.lineIn(text, Resources.lineFeed), refusal.form));
        passed = false;
      }
    }
    return passed;
  }

  private static refuse(text: string): readonly PauseRefusal[] {
    const refusals: PauseRefusal[] = [];
    for (const match of text.matchAll(Resources.waitForTimeoutPattern))
      refusals.push(new PauseRefusal(match.index, Resources.waitForTimeoutForm));
    for (const match of text.matchAll(Resources.atomicsWaitPattern))
      refusals.push(new PauseRefusal(match.index, match[0].replace(Resources.whitespaceRunPattern, '')));
    for (const match of text.matchAll(Resources.newPromisePattern)) {
      if (Resources.timerPattern.test(PauseCheck.callText(text, match.index, match.index + match[0].length)))
        refusals.push(new PauseRefusal(match.index, Resources.timerPromiseForm));
    }
    for (const match of text.matchAll(Resources.promisifiedTimerPattern))
      refusals.push(new PauseRefusal(match.index, Resources.timerPromiseForm));
    for (const match of text.matchAll(Resources.timersModulePattern))
      refusals.push(...PauseCheck.refuseTimersModule(text, match.index));
    return refusals.sort((a, b) => a.index - b.index);
  }

  private static callText(text: string, index: number, end: number): string {
    const open: number = text.indexOf(Resources.openParenthesis, PauseCheck.skipTypeArgument(text, end));
    if (open < 0)
      return '';
    let depth: number = 0;
    for (let position: number = open; position < text.length; position++) {
      if (text[position] === Resources.openParenthesis)
        depth++;
      else if (text[position] === Resources.closeParenthesis)
        depth--;
      if (depth === 0)
        return text.slice(index, position + 1);
    }
    return text.slice(index);
  }

  private static skipTypeArgument(text: string, from: number): number {
    let position: number = from;
    while (Resources.whitespacePattern.test(text[position] ?? ''))
      position++;
    if (text[position] !== Resources.openAngle)
      return from;
    let depth: number = 0;
    for (; position < text.length; position++) {
      if (text[position] === Resources.openAngle)
        depth++;
      else if (text[position] === Resources.closeAngle && text[position - 1] !== Resources.arrowStart)
        depth--;
      if (depth === 0)
        return position + 1;
    }
    return position;
  }

  private static refuseTimersModule(text: string, index: number): PauseRefusal[] {
    const before: string = text.slice(text.lastIndexOf(Resources.statementEnd, index) + 1, index);
    const names: RegExpExecArray | null = Resources.namedImportPattern.exec(before) ?? Resources.destructuredLoadPattern.exec(before);
    if (names !== null)
      return PauseCheck.refuseNames(text, index, names[1] ?? '');
    const namespace: RegExpExecArray | null = Resources.namespaceImportPattern.exec(before) ?? Resources.namespaceLoadPattern.exec(before);
    if (namespace !== null) {
      const member: RegExp = new RegExp(Resources.formatTimerMemberPattern(PauseCheck.escape(namespace[1] ?? '')), Resources.globalFlag);
      return [...text.matchAll(member)].map(t => new PauseRefusal(t.index, Resources.timersModuleForm));
    }
    return [new PauseRefusal(index, Resources.timersModuleUnfollowedForm)];
  }

  private static refuseNames(text: string, index: number, list: string): PauseRefusal[] {
    const refusals: PauseRefusal[] = [];
    for (const specifier of list.split(Resources.listSeparator)) {
      const [name, alias] = specifier.trim().split(Resources.aliasPattern);
      if (name !== undefined && Resources.timerNames.includes(name))
        refusals.push(new PauseRefusal(index, Resources.formatTimerImportForm(name)));
      else if (name === Resources.schedulerName) {
        const wait: RegExp = new RegExp(Resources.formatSchedulerWaitPattern(PauseCheck.escape(alias ?? name)), Resources.globalFlag);
        for (const match of text.matchAll(wait))
          refusals.push(new PauseRefusal(match.index, Resources.schedulerWaitForm));
      }
    }
    return refusals;
  }

  private static escape(name: string): string {
    return name.replace(Resources.dollarPattern, Resources.escapedDollar);
  }

  private static async listTestFilesAsync(tests: string): Promise<string[]> {
    const files: string[] = [];
    for (const file of await readdir(tests, { recursive: true, withFileTypes: true })) {
      if (file.isFile() && Resources.testFilePattern.test(file.name))
        files.push(join(file.parentPath, file.name));
    }
    return files.sort();
  }

  private static async listFoldersAsync(folder: string): Promise<string[]> {
    const entries: Dirent[] = await readdir(folder, { withFileTypes: true });
    return entries.filter(t => t.isDirectory()).map(t => join(folder, t.name)).sort();
  }
}

process.exitCode = await new PauseCheck(process.cwd(), process.stderr).runAsync() ? 0 : 1;
