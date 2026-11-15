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

export class PageRecord {
  private static readonly FIELDS: readonly string[] = [Resources.instanceField, Resources.profileKeyField, Resources.urlField];

  public readonly instance: string;
  public readonly profileKey: string;
  public readonly url: string;

  public constructor(instance: string, profileKey: string, url: string) {
    this.instance = instance;
    this.profileKey = profileKey;
    this.url = url;
  }

  public static fromJson(value: unknown, path?: string): PageRecord {
    const reader: JsonReader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, PageRecord.FIELDS);
    return new PageRecord(reader.readString(Resources.instanceField), reader.readString(Resources.profileKeyField), reader.readString(Resources.urlField));
  }

  public toJson(): JsonObject {
    return { [Resources.instanceField]: this.instance, [Resources.profileKeyField]: this.profileKey, [Resources.urlField]: this.url };
  }
}
