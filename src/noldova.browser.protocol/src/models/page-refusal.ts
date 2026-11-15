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

export class PageRefusal {
  private static readonly FIELDS: readonly string[] = [Resources.urlField, Resources.originField];

  public readonly url: string;
  public readonly origin: string;

  public constructor(url: string, origin: string) {
    const parsed: URL | null = URL.parse(url);
    if (parsed === null || !Resources.webSchemes.includes(parsed.protocol))
      throw new ArgumentException(Resources.refusalUrlNotWeb, Resources.urlField);
    if (parsed.origin !== origin)
      throw new ArgumentException(Resources.refusalOriginDiffers, Resources.originField);

    this.url = url;
    this.origin = origin;
  }

  public static fromJson(value: unknown, path?: string): PageRefusal {
    const reader: JsonReader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, PageRefusal.FIELDS);
    return WireContract.create(reader, () => new PageRefusal(reader.readString(Resources.urlField), reader.readString(Resources.originField)));
  }

  public toJson(): JsonObject {
    return { [Resources.urlField]: this.url, [Resources.originField]: this.origin };
  }
}
