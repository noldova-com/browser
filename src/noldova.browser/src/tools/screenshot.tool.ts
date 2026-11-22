/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageAction, type PageBox } from "@noldova/browser.protocol";
import { type IToolDescriptor, type ToolCall, ToolContent, ToolResult } from "@noldova/desktop.runtime";

import { CallTooLargeException } from "../exceptions/call-too-large.exception.ts";
import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import { ResultTooLargeException } from "../exceptions/result-too-large.exception.ts";
import { ScreenshotChangedException } from "../exceptions/screenshot-changed.exception.ts";
import { ScreenshotNotVisibleException } from "../exceptions/screenshot-not-visible.exception.ts";
import { ScreenshotTargetException } from "../exceptions/screenshot-target.exception.ts";
import type { IBrowserTool } from "../interfaces/i-browser-tool.ts";
import type { ActionProgress } from "../models/action-progress.ts";
import { BrowserLimits } from "../models/browser-limits.ts";
import type { CallOptions } from "../models/call-options.ts";
import type { FrameFacts } from "../models/frame-facts.ts";
import type { LayoutMetrics } from "../models/layout-metrics.ts";
import type { ScreenshotArea } from "../models/screenshot-area.ts";
import { ScreenshotCapture } from "../models/screenshot-capture.ts";
import type { SessionPage } from "../models/session-page.ts";
import { ShownPage } from "../models/shown-page.ts";
import { ToolDescriptors } from "../models/tool-descriptors.ts";
import { ToolKit } from "../models/tool-kit.ts";
import { Resources } from "../resources.ts";
import { HiddenPageCapture } from "../services/hidden-page-capture.ts";
import { InputValidator } from "../services/input.validator.ts";
import { OutputLimits } from "../services/output-limits.ts";
import { ScreenshotAreas } from "../services/screenshot-areas.ts";
import { ToolResults } from "../services/tool-results.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";

export class ScreenshotTool implements IBrowserTool {
  private readonly kit: ToolKit;
  private readonly hidden: HiddenPageCapture;
  public readonly descriptor: IToolDescriptor = ToolDescriptors.screenshot;

  public constructor(kit: ToolKit) {
    this.kit = kit;
    this.hidden = new HiddenPageCapture(kit.calls, kit.log);
  }

  public async callAsync(call: ToolCall, progress: ActionProgress): Promise<ToolResult> {
    const input: JsonObject = InputValidator.readObject(call.arguments);
    const reference: string | null = Object.isUndefined(input[Resources.referenceField]) ? null
      : InputValidator.readText(input, Resources.referenceField, BrowserLimits.maximumReferenceLength);
    const isFullPage: boolean = InputValidator.readFlag(input, Resources.fullPageField);
    if (!Object.isNull(reference) && isFullPage)
      throw new ScreenshotTargetException();
    const page: SessionPage = this.kit.pages.find(call);
    return this.kit.actAsync(call, page, PageAction.Reading, async activity => {
      const options: CallOptions = ToolKit.optionsFor(activity, call, progress, !Object.isNull(reference));
      const result: ToolResult | null = await this.kit.readSettledAsync(page.viewId, options.deadline - Resources.readMarginMilliseconds, options.signal,
        () => this.readAsync(call.session, page.viewId, reference, isFullPage, options));
      return result ?? await this.kit.stillLoadingAsync(page.viewId, options);
    });
  }

  private async readAsync(session: string, viewId: string, reference: string | null, isFullPage: boolean, options: CallOptions): Promise<ToolResult> {
    const frame: FrameFacts = await this.kit.readFrameAsync(viewId, options);
    const element: number | null = Object.isNull(reference) ? null : (await this.kit.findReferencedNodeAsync(session, reference, viewId, frame.documentId, options)).backendNodeId;
    const capture: ScreenshotCapture = await this.hidden.captureAsync(viewId, options, async (metrics: LayoutMetrics, laidOut: boolean) => {
      const box: PageBox | null = Object.isNull(element) ? null : await this.kit.readBoxAsync(viewId, element, options);
      if (!Object.isNull(element) && Object.isNull(box))
        throw new ScreenshotNotVisibleException();
      const planned: ScreenshotArea = ScreenshotAreas.plan(metrics, box, isFullPage);
      if (planned.imageWidth < 1 || planned.imageHeight < 1)
        throw new ScreenshotNotVisibleException();
      return this.captureAsync(viewId, planned, laidOut, !Object.isNull(reference) || isFullPage, options);
    });
    if ((await this.kit.readFrameAsync(viewId, options)).documentId !== frame.documentId)
      throw new ScreenshotChangedException();
    const content: ToolContent[] = [ToolContent.fromImage(capture.data, capture.mimeType, frame.origin)];
    if (capture.area.isCut)
      content.push(ToolContent.fromText(Resources.formatScreenshotCut(Resources.maximumClipLength), null));
    if (capture.isLaidOut)
      content.push(ToolContent.fromText(Resources.screenshotLaidOut, null));
    const title: string = await this.kit.readTitleOfAsync(viewId, frame.documentId, options);
    return new ToolResult([ToolContent.fromText(Resources.formatScreenshot(capture.area.imageWidth, capture.area.imageHeight), null),
      ...ToolResults.untrusted(frame.origin, content)], ToolResults.shown(new ShownPage(frame.url, title), null));
  }

  private async captureAsync(viewId: string, area: ScreenshotArea, isLaidOut: boolean, isBeyondViewport: boolean, options: CallOptions): Promise<ScreenshotCapture> {
    for (const { format, quality } of Resources.screenshotEncodings) {
      let reply: JsonObject;
      try {
        reply = await this.kit.calls.sendAsync(viewId, Resources.captureScreenshotMethod, { format, ...(Object.isNull(quality) ? {} : { quality }),
          clip: { x: area.x, y: area.y, width: area.width, height: area.height, scale: area.scale }, captureBeyondViewport: isBeyondViewport },
          options.withMaximumReplyBytes(BrowserLimits.maximumTreeReplyBytes));
      }
      catch (error) {
        if (error instanceof CallTooLargeException)
          continue;
        throw error;
      }
      const data: JsonValue | undefined = reply[Resources.dataField];
      if (!Object.isString(data))
        throw new MalformedReplyException();
      if (OutputLimits.decodedLength(data) <= BrowserLimits.maximumScreenshotBytes)
        return new ScreenshotCapture(area, data, Resources.formatImageMimeType(format), isLaidOut);
    }
    throw new ResultTooLargeException();
  }
}
