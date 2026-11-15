/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { WireContract } from "../services/wire-contract.ts";

export class PagePoint {
  private static readonly FIELDS: readonly string[] = [Resources.xField, Resources.yField];

  public readonly x: number;
  public readonly y: number;

  public constructor(x: number, y: number) {
    if (!Number.isFinite(x))
      throw new ArgumentException(Resources.coordinateNotFinite, Resources.xField);
    if (!Number.isFinite(y))
      throw new ArgumentException(Resources.coordinateNotFinite, Resources.yField);

    this.x = x;
    this.y = y;
  }

  public static fromJson(value: unknown, path?: string): PagePoint {
    const reader: JsonReader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, PagePoint.FIELDS);
    return WireContract.create(reader, () => new PagePoint(reader.readNumber(Resources.xField), reader.readNumber(Resources.yField)));
  }

  public toJson(): JsonObject {
    return { [Resources.xField]: this.x, [Resources.yField]: this.y };
  }
}
