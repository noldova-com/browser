/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageAction } from "@noldova/browser.protocol";
import { type IToolDescriptor, type ToolCall, ToolContent, ToolResult } from "@noldova/desktop.runtime";

import { ConsoleLevel } from "../enums/console-level.ts";
import { CallTimedOutException } from "../exceptions/call-timed-out.exception.ts";
import { ConsoleCursorRefusedException } from "../exceptions/console-cursor-refused.exception.ts";
import type { IBrowserTool } from "../interfaces/i-browser-tool.ts";
import type { ActionProgress } from "../models/action-progress.ts";
import type { CallOptions } from "../models/call-options.ts";
import type { ConsoleEntry } from "../models/console-entry.ts";
import type { ConsoleRead } from "../models/console-read.ts";
import { ConsoleRun } from "../models/console-run.ts";
import type { FrameFacts } from "../models/frame-facts.ts";
import { OriginPage } from "../models/origin-page.ts";
import type { SessionPage } from "../models/session-page.ts";
import { ShownPage } from "../models/shown-page.ts";
import { ToolDescriptors } from "../models/tool-descriptors.ts";
import { ToolKit } from "../models/tool-kit.ts";
import { Resources } from "../resources.ts";
import { HistoryPageReader } from "../services/history-page.reader.ts";
import { InputValidator } from "../services/input.validator.ts";
import { OutputLimits } from "../services/output-limits.ts";
import { ToolResults } from "../services/tool-results.ts";
import type { JsonObject } from "../types/json-value.ts";

export class ConsoleTool implements IBrowserTool {
  private static readonly LEVELS_FROM_LOWEST: readonly ConsoleLevel[] = Object.values(ConsoleLevel);
  private readonly kit: ToolKit;
  public readonly descriptor: IToolDescriptor = ToolDescriptors.console;

  public constructor(kit: ToolKit) {
    this.kit = kit;
  }

  public async callAsync(call: ToolCall, progress: ActionProgress): Promise<ToolResult> {
    const input: JsonObject = InputValidator.readObject(call.arguments);
    const cursor: number | null = Object.isUndefined(input[Resources.cursorField]) ? null : InputValidator.readIndex(input, Resources.cursorField);
    const level: string = InputValidator.readChoice(input, Resources.levelField, Object.values(Resources.consoleLevelNames), Resources.consoleLevelNames[ConsoleLevel.Debug]);
    const minimum: number = ConsoleTool.LEVELS_FROM_LOWEST.findIndex(t => Resources.consoleLevelNames[t] === level);
    const page: SessionPage = this.kit.pages.find(call);
    return this.kit.actAsync(call, page, PageAction.Reading, async activity => {
      const options: CallOptions = ToolKit.optionsFor(activity, call, progress, false);
      // The buffer is the module's own, so while the page waits for its next document the read doesn't wait, and names the page the view's
      // history still shows; the console starts with the next read.
      const read: OriginPage | null = await this.kit.readSettledAsync(page.viewId, Date.now(), options.signal, () => this.readPageAsync(page.viewId, options));
      const shown: OriginPage = read ?? await HistoryPageReader.readAsync(this.kit.calls, page.viewId, options);
      const given: number = this.kit.sessions.readCursor(call.session, page.viewId);
      const from: number = cursor ?? given;
      if (from > given)
        throw new ConsoleCursorRefusedException();
      const isTimedOut: boolean = !Object.isNull(read) && !await this.startAsync(page.viewId, shown.origin, options);
      const result: ToolResult = this.write(page.viewId, from, minimum, call.session, shown.page);
      if (isTimedOut)
        this.kit.domains.drop(page.viewId);
      return result;
    });
  }

  private async readPageAsync(viewId: string, options: CallOptions): Promise<OriginPage> {
    const frame: FrameFacts = await this.kit.readFrameAsync(viewId, options);
    return new OriginPage(frame.origin, new ShownPage(frame.url, await this.kit.readTitleOfAsync(viewId, frame.documentId, options)));
  }

  private async startAsync(viewId: string, origin: string, options: CallOptions): Promise<boolean> {
    try {
      await this.kit.domains.startAsync(viewId, origin, (method, params) => this.kit.calls.sendAsync(viewId, method, params, options));
      return true;
    }
    catch (error) {
      if (error instanceof CallTimedOutException)
        return false;
      this.kit.domains.drop(viewId);
      throw error;
    }
  }

  private write(viewId: string, from: number, minimum: number, session: string, page: ShownPage): ToolResult {
    const read: ConsoleRead = this.kit.consoles.read(viewId, from);
    const runs: ConsoleRun[] = [];
    let bytes: number = 0;
    let next: number = read.next;
    for (const entry of read.entries) {
      if (!Object.isNull(entry.level) && ConsoleTool.LEVELS_FROM_LOWEST.indexOf(entry.level) < minimum)
        continue;
      const line: string = ConsoleTool.format(entry);
      bytes += OutputLimits.byteLength(line) + 1;
      if (bytes > Resources.maximumResultBytes) {
        next = entry.sequence;
        break;
      }
      const run: ConsoleRun | undefined = runs.at(-1);
      if (run?.origin === entry.origin)
        run.lines.push(line);
      else
        runs.push(new ConsoleRun(entry.origin, line));
    }
    this.kit.sessions.writeCursor(session, viewId, next);
    const count: number = runs.reduce((total, t) => total + t.lines.length, 0);
    return new ToolResult([
      ToolContent.fromText(Resources.formatConsoleRead(count, next, from < read.oldest, next < read.next, read.mayRepeat), null),
      ...runs.flatMap(t => ToolResults.untrusted(t.origin, [ToolContent.fromText(t.lines.join(Resources.lineSeparator), t.origin)]))
    ], ToolResults.shown(page, null));
  }

  private static format(entry: ConsoleEntry): string {
    const time: string = new Date(entry.time).toISOString();
    return Object.isNull(entry.level)
      ? Resources.formatConsoleEntry(time, entry.source, entry.text)
      : Resources.formatLeveledConsoleEntry(time, Resources.consoleLevelNames[entry.level], entry.source, entry.text);
  }
}
