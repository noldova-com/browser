/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import { LayoutMetrics } from "../models/layout-metrics.ts";
import { Resources } from "../resources.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";
import { JsonShapes } from "./json-shapes.ts";

export class LayoutMetricsReader {
  public static read(reply: JsonObject): LayoutMetrics {
    const viewport: JsonObject = LayoutMetricsReader.readObject(reply, Resources.cssVisualViewportField);
    const content: JsonObject = LayoutMetricsReader.readObject(reply, Resources.cssContentSizeField);
    const width: number = LayoutMetricsReader.readSize(viewport, Resources.clientWidthField);
    const deviceWidth: number = LayoutMetricsReader.readSize(LayoutMetricsReader.readObject(reply, Resources.visualViewportField), Resources.clientWidthField);
    return new LayoutMetrics(
      LayoutMetricsReader.readNumber(viewport, Resources.pageXField),
      LayoutMetricsReader.readNumber(viewport, Resources.pageYField),
      width,
      LayoutMetricsReader.readSize(viewport, Resources.clientHeightField),
      LayoutMetricsReader.readSize(content, Resources.widthField),
      LayoutMetricsReader.readSize(content, Resources.heightField),
      deviceWidth > 0 && width > 0 ? deviceWidth / width : 1
    );
  }

  private static readObject(reply: JsonObject, name: string): JsonObject {
    const value: JsonValue | undefined = reply[name];
    if (!JsonShapes.isObject(value))
      throw new MalformedReplyException();
    return value;
  }

  private static readSize(object: JsonObject, name: string): number {
    const size: number = LayoutMetricsReader.readNumber(object, name);
    if (size < 0)
      throw new MalformedReplyException();
    return size;
  }

  private static readNumber(object: JsonObject, name: string): number {
    const value: JsonValue | undefined = object[name];
    if (typeof value !== "number")
      throw new MalformedReplyException();
    return value;
  }
}
