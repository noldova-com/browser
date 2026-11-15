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

export class PageRequest {
  private static readonly FIELDS: readonly string[] = [Resources.instanceField];

  public readonly instance: string;

  public constructor(instance: string) {
    this.instance = instance;
  }

  public static fromJson(value: unknown, path?: string): PageRequest {
    const reader: JsonReader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, PageRequest.FIELDS);
    return new PageRequest(reader.readString(Resources.instanceField));
  }

  public toJson(): JsonObject {
    return { [Resources.instanceField]: this.instance };
  }
}
