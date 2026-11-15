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

export class BrowsingDataRequest {
  private static readonly FIELDS: readonly string[] = [Resources.profileKeyField];

  public readonly profileKey: string;

  public constructor(profileKey: string) {
    this.profileKey = profileKey;
  }

  public static fromJson(value: unknown, path?: string): BrowsingDataRequest {
    const reader: JsonReader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, BrowsingDataRequest.FIELDS);
    return new BrowsingDataRequest(reader.readString(Resources.profileKeyField));
  }

  public toJson(): JsonObject {
    return { [Resources.profileKeyField]: this.profileKey };
  }
}
