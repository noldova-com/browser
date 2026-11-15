/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { WireContract } from "../services/wire-contract.ts";

export class PageStopRequest {
  private static readonly FIELDS: readonly string[] = [Resources.instanceField, Resources.isTakingOverField];

  public readonly instance: string;
  public readonly isTakingOver: boolean;

  public constructor(instance: string, isTakingOver: boolean) {
    this.instance = instance;
    this.isTakingOver = isTakingOver;
  }

  public static fromJson(value: unknown, path?: string): PageStopRequest {
    const reader: JsonReader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, PageStopRequest.FIELDS);
    return new PageStopRequest(reader.readString(Resources.instanceField), reader.readBoolean(Resources.isTakingOverField));
  }

  public toJson(): JsonObject {
    return { [Resources.instanceField]: this.instance, [Resources.isTakingOverField]: this.isTakingOver };
  }
}
