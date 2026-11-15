/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ConsoleLevel } from "../enums/console-level.ts";
import { Resources } from "../resources.ts";
import { OutputLimits } from "../services/output-limits.ts";
import { BrowserLimits } from "./browser-limits.ts";
import { ConsoleEntry } from "./console-entry.ts";
import { ConsoleRead } from "./console-read.ts";

export class ConsoleRing {
  private readonly entries: ConsoleEntry[] = [];
  private bytes: number = 0;
  private next: number = 0;
  private origin: string;
  private resumes: readonly number[] = [];

  public constructor(origin: string) {
    this.origin = origin;
  }

  public resume(origin: string): void {
    this.origin = origin;
    this.resumes = [...this.resumes, this.next];
  }

  public navigate(origin: string): void {
    this.origin = origin;
  }

  public add(level: ConsoleLevel | null, source: string, text: string, time: number): void {
    const entry: ConsoleEntry = new ConsoleEntry(this.next, level, source, text, time, this.origin);
    this.next += 1;
    this.entries.push(entry);
    this.bytes += ConsoleRing.sizeOf(entry);
    let dropped: number = 0;
    for (const oldest of this.entries) {
      if (this.entries.length - dropped <= BrowserLimits.consoleRingEntries && this.bytes <= BrowserLimits.consoleRingBytes)
        break;
      this.bytes -= ConsoleRing.sizeOf(oldest);
      dropped += 1;
    }
    this.entries.splice(0, dropped);
    this.trimResumes();
  }

  public read(cursor: number): ConsoleRead {
    return new ConsoleRead(this.entries.filter(t => t.sequence >= cursor), this.oldest(), this.next, this.resumes.some(t => cursor <= t && t < this.next));
  }

  private oldest(): number {
    return this.next - this.entries.length;
  }

  private trimResumes(): void {
    const oldest: number = this.oldest();
    const dropped: readonly number[] = this.resumes.filter(t => t < oldest);
    if (dropped.length > 1)
      this.resumes = [Math.max(...dropped), ...this.resumes.filter(t => t >= oldest)];
  }

  private static sizeOf(entry: ConsoleEntry): number {
    return OutputLimits.byteLength(entry.text) + OutputLimits.byteLength(entry.source) + Resources.entryOverheadBytes;
  }
}
