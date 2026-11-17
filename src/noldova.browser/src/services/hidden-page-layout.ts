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
import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import { PageCrashedException } from "../exceptions/page-crashed.exception.ts";
import { PageNotShowingException } from "../exceptions/page-not-showing.exception.ts";
import { ProfileClearedException } from "../exceptions/profile-cleared.exception.ts";
import { ViewClosedException } from "../exceptions/view-closed.exception.ts";
import { BrowserLimits } from "../models/browser-limits.ts";
import type { CallOptions } from "../models/call-options.ts";
import { Resources } from "../resources.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";
import { JsonShapes } from "./json-shapes.ts";
import { ViewCalls } from "./view-calls.ts";

export class HiddenPageLayout {
  private readonly calls: ViewCalls;
  private readonly log: IModuleLog;

  public constructor(calls: ViewCalls, log: IModuleLog) {
    this.calls = calls;
    this.log = log;
  }

  public async holdAsync(viewId: string, options: CallOptions, press: () => Promise<void>): Promise<void> {
    if (await this.readHasSizeAsync(viewId, options)) {
      await this.wakeAsync(viewId, options);
      await press();
      return;
    }
    try {
      await this.calls.sendAsync(viewId, Resources.setDeviceMetricsOverrideMethod, Resources.hiddenPageMetrics, options);
      if (!await this.readHasSizeAsync(viewId, options))
        throw new PageNotShowingException();
      await this.wakeAsync(viewId, options);
      await press();
    }
    finally {
      await this.releaseAsync(viewId, options);
    }
  }

  // A hidden view's document that loaded while it was hidden never draws, and its input takes no press until a capture is asked of it, which
  // the hidden view never answers; so before a press the page is asked for one pixel, and a capture that doesn't come in time is let go.
  private async wakeAsync(viewId: string, options: CallOptions): Promise<void> {
    const deadline: number = Math.min(options.deadline, Date.now() + BrowserLimits.inputWakeMilliseconds);
    try {
      await this.calls.sendAsync(viewId, Resources.captureScreenshotMethod, Resources.wakeScreenshot,
        options.withDeadline(deadline).withMaximumReplyBytes(BrowserLimits.maximumTreeReplyBytes));
    }
    catch (error) {
      if (!(error instanceof CallTimedOutException && deadline < options.deadline))
        throw error;
    }
  }

  private async readHasSizeAsync(viewId: string, options: CallOptions): Promise<boolean> {
    return HiddenPageLayout.hasSize(await this.calls.sendAsync(viewId, Resources.getLayoutMetricsMethod, {}, options));
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

  private static hasSize(reply: JsonObject): boolean {
    const viewport: JsonValue | undefined = reply[Resources.cssVisualViewportField];
    if (!JsonShapes.isObject(viewport))
      throw new MalformedReplyException();
    const { clientWidth: width, clientHeight: height }: JsonObject = viewport;
    if (typeof width !== "number" || typeof height !== "number")
      throw new MalformedReplyException();
    return width > 0 && height > 0;
  }
}
