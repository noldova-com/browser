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

export class PageBox {
  private static readonly FIELDS: readonly string[] = [Resources.xField, Resources.yField, Resources.widthField, Resources.heightField];

  public readonly x: number;
  public readonly y: number;
  public readonly width: number;
  public readonly height: number;

  public constructor(x: number, y: number, width: number, height: number) {
    if (!Number.isFinite(x))
      throw new ArgumentException(Resources.coordinateNotFinite, Resources.xField);
    if (!Number.isFinite(y))
      throw new ArgumentException(Resources.coordinateNotFinite, Resources.yField);
    if (!Number.isFinite(width) || width < 0)
      throw new ArgumentException(Resources.sizeNegative, Resources.widthField);
    if (!Number.isFinite(height) || height < 0)
      throw new ArgumentException(Resources.sizeNegative, Resources.heightField);

    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  public static fromJson(value: unknown, path?: string): PageBox {
    const reader: JsonReader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, PageBox.FIELDS);
    return WireContract.create(reader, () => new PageBox(
      reader.readNumber(Resources.xField),
      reader.readNumber(Resources.yField),
      reader.readNumber(Resources.widthField),
      reader.readNumber(Resources.heightField)));
  }

  public isSame(box: PageBox): boolean {
    return box.x === this.x && box.y === this.y && box.width === this.width && box.height === this.height;
  }

  public toJson(): JsonObject {
    return { [Resources.xField]: this.x, [Resources.yField]: this.y, [Resources.widthField]: this.width, [Resources.heightField]: this.height };
  }
}
