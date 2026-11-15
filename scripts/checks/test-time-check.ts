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
import { TimingReport } from "../timing/timing-report.ts";

class TestTimeCheck {
  private readonly root: string;
  private readonly report: string;

  public constructor(root: string, report: string) {
    this.root = root;
    this.report = report;
  }

  public run(): void {
    const accepted: ReadonlySet<string> = TimingReport.readAccepted(this.root, Resources.slowFileListHeader);
    const files: readonly unknown[] = TimingReport.files(JSON.parse(readFileSync(path.join(this.root, this.report), Resources.textEncoding)));
    let over: number = 0;
    let accepts: number = 0;
    let measured: number = 0;
    for (const file of files) {
      const name: unknown = TimingReport.field(file, Resources.vitestFileName);
      const start: unknown = TimingReport.field(file, Resources.vitestStartTime);
      const end: unknown = TimingReport.field(file, Resources.vitestEndTime);
      if (typeof name !== "string" || typeof start !== "number" || typeof end !== "number")
        continue;
      measured++;
      const relative: string = TimingReport.relative(this.root, name);
      const time: number = end - start;
      if (time <= Resources.unitFileBudget)
        continue;
      over++;
      accepts += Number(accepted.has(relative));
      console.log(Resources.formatTestFileSlow(relative, time));
    }
    console.log(Resources.formatTestTimesChecked(measured, over, accepts));
  }
}

const [report] = process.argv.slice(2);
if (report === undefined) {
  console.error(Resources.testTimeUsage);
  process.exitCode = 1;
}
else
  new TestTimeCheck(process.cwd(), report).run();
