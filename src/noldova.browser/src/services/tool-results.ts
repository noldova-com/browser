/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolContent, ToolResult } from "@noldova/desktop.runtime";

import { BrowserLimits } from "../models/browser-limits.ts";
import type { ShownElement } from "../models/shown-element.ts";
import type { ShownPage } from "../models/shown-page.ts";
import { Resources } from "../resources.ts";
import type { JsonObject } from "../types/json-value.ts";

export class ToolResults {
  public static text(text: string, page: ShownPage): ToolResult {
    return new ToolResult([ToolContent.fromText(text, null)], ToolResults.shown(page, null));
  }

  public static done(message: string, origin: string, page: ShownPage, element: ShownElement | null): ToolResult {
    return new ToolResult([ToolContent.fromText(message, null), ...ToolResults.untrusted(origin, [ToolContent.fromText(Resources.formatUrl(page.url), origin)])],
      ToolResults.shown(page, element));
  }

  public static page(origin: string, content: readonly ToolContent[], page: ShownPage): ToolResult {
    return new ToolResult(ToolResults.untrusted(origin, content), ToolResults.shown(page, null));
  }

  public static untrusted(origin: string, content: readonly ToolContent[]): readonly ToolContent[] {
    return [ToolContent.fromText(Resources.formatPageContent(origin), null), ...content];
  }

  public static shown(page: ShownPage, element: ShownElement | null): JsonObject {
    const text: number = BrowserLimits.maximumShownTextLength;
    const shownPage: JsonObject = { url: ToolResults.cut(ToolResults.shownUrl(page.url), BrowserLimits.maximumShownUrlLength), title: ToolResults.cut(page.title, text) };
    return element === null
      ? { page: shownPage }
      : { page: shownPage, element: { role: ToolResults.cut(element.role, text), name: ToolResults.cut(element.name, text), isSecret: element.isSecret } };
  }

  private static shownUrl(url: string): string {
    const parsed: URL | null = URL.parse(url);
    if (parsed === null)
      return "";
    if (parsed.origin !== Resources.opaqueOrigin)
      return `${parsed.origin}${parsed.pathname}`;
    return parsed.protocol === Resources.aboutProtocol ? `${parsed.protocol}${parsed.pathname}` : parsed.protocol;
  }

  private static cut(text: string, limit: number): string {
    const points: readonly string[] = [...text];
    return points.length <= limit ? text : `${points.slice(0, limit - 1).join("")}${Resources.shownCut}`;
  }
}
