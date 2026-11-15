/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawnSync } from "node:child_process";
import type { SpawnSyncReturns } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { Resources } from "../resources.ts";
import { TimingReport } from "./timing-report.ts";

class TimingCheck {
  private static readonly root: string = path.dirname(path.dirname(import.meta.dirname));
  private static readonly window: string = path.join(TimingCheck.root, Resources.windowFolder);
  private static readonly folder: string = path.join(TimingCheck.root, ...Resources.timingFolder);

  private readonly fileTimes: Map<string, number[]> = new Map<string, number[]>();
  private readonly testTimes: Map<string, Map<string, number[]>> = new Map<string, Map<string, number[]>>();

  public run(): number {
    mkdirSync(TimingCheck.folder, { recursive: true });
    for (let run = 1; run <= Resources.timingRuns; run++) {
      const unitReport: string = path.join(TimingCheck.folder, Resources.formatTimingReport(Resources.unitTimingName, run));
      const unitStatus: number = TimingCheck.spawn(TimingCheck.root, [...Resources.unitTimingArguments, `${Resources.outputFileJsonOption}${unitReport}`]);
      if (unitStatus !== 0)
        return unitStatus;
      this.readUnit(unitReport);
      const specReport: string = path.join(TimingCheck.folder, Resources.formatTimingReport(Resources.specTimingName, run));
      const specStatus: number = TimingCheck.spawn(TimingCheck.window,
        [path.join(TimingCheck.root, ...Resources.angularCliEntry), ...Resources.specTimingArguments, specReport]);
      if (specStatus !== 0)
        return specStatus;
      this.readSpecs(specReport);
    }
    const slowFiles: number = this.reportUnitFiles(TimingReport.readAccepted(TimingCheck.root, Resources.slowFileListHeader));
    const slowSpecs: number = this.reportSpecs(TimingReport.readAccepted(TimingCheck.root, Resources.slowSpecListHeader));
    console.log(Resources.formatTimingSummary(slowFiles, slowSpecs));
    return slowFiles + slowSpecs > 0 ? 1 : 0;
  }

  private static spawn(folder: string, step: readonly string[]): number {
    const result: SpawnSyncReturns<string | Buffer> = spawnSync(process.execPath, step, { cwd: folder, stdio: Resources.inheritedStdio });
    if (result.error !== undefined)
      console.error(result.error.message);
    return result.status ?? 1;
  }

  private static read(report: string): readonly unknown[] {
    return TimingReport.files(JSON.parse(readFileSync(report, Resources.textEncoding)));
  }

  private readUnit(report: string): void {
    for (const file of TimingCheck.read(report)) {
      const name: unknown = TimingReport.field(file, Resources.vitestFileName);
      const start: unknown = TimingReport.field(file, Resources.vitestStartTime);
      const end: unknown = TimingReport.field(file, Resources.vitestEndTime);
      if (typeof name !== "string" || typeof start !== "number" || typeof end !== "number")
        continue;
      const relative: string = TimingReport.relative(TimingCheck.root, name);
      this.fileTimes.set(relative, [...this.fileTimes.get(relative) ?? [], end - start]);
    }
  }

  private readSpecs(report: string): void {
    for (const file of TimingCheck.read(report)) {
      const name: unknown = TimingReport.field(file, Resources.vitestFileName);
      if (typeof name !== "string")
        continue;
      const relative: string = TimingReport.relative(TimingCheck.root, name);
      const tests: Map<string, number[]> = this.testTimes.get(relative) ?? new Map<string, number[]>();
      for (const test of TimingReport.list(TimingReport.field(file, Resources.vitestTests))) {
        const title: unknown = TimingReport.field(test, Resources.vitestName);
        const duration: unknown = TimingReport.field(test, Resources.vitestDuration);
        if (typeof title === "string" && typeof duration === "number")
          tests.set(title, [...tests.get(title) ?? [], duration]);
      }
      this.testTimes.set(relative, tests);
    }
  }

  private reportUnitFiles(accepted: ReadonlySet<string>): number {
    let slow: number = 0;
    for (const [file, times] of [...this.fileTimes].sort(([left], [right]) => left.localeCompare(right))) {
      const time: number = TimingReport.median(times);
      if (time <= Resources.unitFileBudget * Resources.timingMargin)
        continue;
      const isAccepted: boolean = accepted.has(file);
      slow += Number(!isAccepted);
      console.log(Resources.formatUnitFileTiming(file, time, isAccepted));
    }
    return slow;
  }

  private reportSpecs(accepted: ReadonlySet<string>): number {
    let slow: number = 0;
    for (const [file, tests] of [...this.testTimes].sort(([left], [right]) => left.localeCompare(right))) {
      const median: number = TimingReport.median([...tests.values()].map(t => TimingReport.median(t)));
      const isOver: boolean = median > Resources.specMedianBudget * Resources.timingMargin;
      const isAccepted: boolean = accepted.has(file);
      slow += Number(isOver && !isAccepted);
      console.log(Resources.formatSpecMedian(file, median, tests.size, isOver, isAccepted));
      for (const [title, times] of tests) {
        const time: number = TimingReport.median(times);
        if (time > Resources.slowComponentTest)
          console.log(Resources.formatSlowComponentTest(file, title, time));
      }
    }
    return slow;
  }
}

process.exitCode = new TimingCheck().run();
