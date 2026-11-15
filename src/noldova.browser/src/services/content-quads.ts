/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageBox, PagePoint } from "@noldova/browser.protocol";

import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import { Resources } from "../resources.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";
import { JsonShapes } from "./json-shapes.ts";

export class ContentQuads {
  public static readFirst(reply: JsonObject): readonly number[] | null {
    const quads: JsonValue | undefined = reply[Resources.quadsField];
    if (!JsonShapes.isArray(quads))
      throw new MalformedReplyException();
    const quad: JsonValue | undefined = quads[0];
    if (quad === undefined)
      return null;
    if (!JsonShapes.isArray(quad) || quad.length !== Resources.quadPoints * 2)
      throw new MalformedReplyException();
    const values: number[] = [];
    for (const value of quad) {
      if (typeof value !== "number")
        throw new MalformedReplyException();
      values.push(value);
    }
    return values;
  }

  public static toBox(quad: readonly number[]): PageBox {
    const xs: readonly number[] = ContentQuads.xs(quad);
    const ys: readonly number[] = ContentQuads.ys(quad);
    const x: number = Math.min(...xs);
    const y: number = Math.min(...ys);
    return new PageBox(x, y, Math.max(...xs) - x, Math.max(...ys) - y);
  }

  public static toCentre(quad: readonly number[]): PagePoint {
    return new PagePoint(ContentQuads.sum(ContentQuads.xs(quad)) / Resources.quadPoints, ContentQuads.sum(ContentQuads.ys(quad)) / Resources.quadPoints);
  }

  private static xs(quad: readonly number[]): readonly number[] {
    return quad.filter((_value, index) => index % 2 === 0);
  }

  private static ys(quad: readonly number[]): readonly number[] {
    return quad.filter((_value, index) => index % 2 === 1);
  }

  private static sum(values: readonly number[]): number {
    return values.reduce((total, t) => total + t, 0);
  }
}
