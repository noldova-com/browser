/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IModuleLog } from "@noldova/desktop.runtime";

import { CallFailureException } from "../exceptions/call-failure.exception.ts";
import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import { PageCrashedException } from "../exceptions/page-crashed.exception.ts";
import { PageNotShowingException } from "../exceptions/page-not-showing.exception.ts";
import { ProfileClearedException } from "../exceptions/profile-cleared.exception.ts";
import { ViewClosedException } from "../exceptions/view-closed.exception.ts";
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
      await press();
      return;
    }
    try {
      await this.calls.sendAsync(viewId, Resources.setDeviceMetricsOverrideMethod, Resources.hiddenPageMetrics, options);
      if (!await this.readHasSizeAsync(viewId, options))
        throw new PageNotShowingException();
      await press();
    }
    finally {
      await this.releaseAsync(viewId, options);
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
