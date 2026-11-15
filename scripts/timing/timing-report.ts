/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { Resources } from "../resources.ts";

export class TimingReport {
  private constructor() {
  }

  public static field(value: unknown, name: string): unknown {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value))[name] : undefined;
  }

  public static list(value: unknown): readonly unknown[] {
    return Array.isArray(value) ? value : [];
  }

  public static files(report: unknown): readonly unknown[] {
    return TimingReport.list(TimingReport.field(report, Resources.vitestFiles));
  }

  public static relative(root: string, file: string): string {
    return path.relative(root, file).replaceAll(Resources.windowsSeparator, Resources.posixSeparator);
  }

  public static median(values: readonly number[]): number {
    const sorted: readonly number[] = [...values].sort((a, b) => a - b);
    const middle: number = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[middle] ?? 0 : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  }

  public static readAccepted(root: string, header: string): ReadonlySet<string> {
    const lines: readonly string[] = readFileSync(path.join(root, Resources.readmeFile), Resources.textEncoding).split(Resources.lineFeed);
    const start: number = lines.indexOf(header);
    const files: Set<string> = new Set<string>();
    if (start === -1)
      return files;
    for (const line of lines.slice(start + 2)) {
      if (!line.startsWith(Resources.tableRowPrefix))
        break;
      const file: string | undefined = Resources.slowFileListRow.exec(line)?.[1];
      if (file !== undefined)
        files.add(file);
    }
    return files;
  }
}
