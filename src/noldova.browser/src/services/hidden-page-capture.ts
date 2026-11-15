/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IModuleLog } from "@noldova/desktop.runtime";

import { CallFailureException } from "../exceptions/call-failure.exception.ts";
import { CallTimedOutException } from "../exceptions/call-timed-out.exception.ts";
import { PageCrashedException } from "../exceptions/page-crashed.exception.ts";
import { PageHiddenException } from "../exceptions/page-hidden.exception.ts";
import { ProfileClearedException } from "../exceptions/profile-cleared.exception.ts";
import { ViewClosedException } from "../exceptions/view-closed.exception.ts";
import { BrowserLimits } from "../models/browser-limits.ts";
import type { CallOptions } from "../models/call-options.ts";
import type { LayoutMetrics } from "../models/layout-metrics.ts";
import { Resources } from "../resources.ts";
import { LayoutMetricsReader } from "./layout-metrics.reader.ts";
import { ViewCalls } from "./view-calls.ts";

export class HiddenPageCapture {
  private readonly calls: ViewCalls;
  private readonly log: IModuleLog;

  public constructor(calls: ViewCalls, log: IModuleLog) {
    this.calls = calls;
    this.log = log;
  }

  public async captureAsync<TResult>(viewId: string, options: CallOptions, capture: (metrics: LayoutMetrics, isLaidOut: boolean) => Promise<TResult>): Promise<TResult> {
    const metrics: LayoutMetrics = await this.readMetricsAsync(viewId, options);
    if (HiddenPageCapture.hasSize(metrics) && await this.drawsInTimeAsync(viewId, options))
      return capture(metrics, false);

    try {
      await this.calls.sendAsync(viewId, Resources.setDeviceMetricsOverrideMethod, Resources.hiddenPageMetrics, options);
      const laidOut: LayoutMetrics = await this.readMetricsAsync(viewId, options);
      if (!HiddenPageCapture.hasSize(laidOut))
        throw new PageHiddenException();
      return await capture(laidOut, true);
    }
    finally {
      await this.releaseAsync(viewId, options);
    }
  }

  private async readMetricsAsync(viewId: string, options: CallOptions): Promise<LayoutMetrics> {
    return LayoutMetricsReader.read(await this.calls.sendAsync(viewId, Resources.getLayoutMetricsMethod, {}, options));
  }

  private async drawsInTimeAsync(viewId: string, options: CallOptions): Promise<boolean> {
    const deadline: number = Math.min(options.deadline, Date.now() + BrowserLimits.screenshotDrawMilliseconds);
    try {
      await this.calls.sendAsync(viewId, Resources.captureScreenshotMethod, { format: Resources.pngFormat, clip: { x: 0, y: 0, width: 1, height: 1, scale: 1 } },
        options.withDeadline(deadline).withMaximumReplyBytes(BrowserLimits.maximumTreeReplyBytes));
      return true;
    }
    catch (error) {
      if (error instanceof CallTimedOutException && deadline < options.deadline)
        return false;
      throw error;
    }
  }

  private async releaseAsync(viewId: string, options: CallOptions): Promise<void> {
    try {
      await this.calls.sendAsync(viewId, Resources.clearDeviceMetricsOverrideMethod, {}, ViewCalls.releasing(options));
    }
    catch (error) {
      if (!(error instanceof CallFailureException))
        throw error;
      if (!(error instanceof ViewClosedException || error instanceof PageCrashedException || error instanceof ProfileClearedException))
        this.log.write(Resources.formatLayoutNotReleased(viewId, String(error)));
    }
  }

  private static hasSize(metrics: LayoutMetrics): boolean {
    return metrics.width > 0 && metrics.height > 0;
  }
}
