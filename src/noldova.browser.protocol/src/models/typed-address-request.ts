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

export class TypedAddressRequest {
  private static readonly FIELDS: readonly string[] = [Resources.profileKeyField, Resources.urlField];

  public readonly profileKey: string;
  public readonly url: string;

  public constructor(profileKey: string, url: string) {
    this.profileKey = profileKey;
    this.url = url;
  }

  public static fromJson(value: unknown, path?: string): TypedAddressRequest {
    const reader: JsonReader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, TypedAddressRequest.FIELDS);
    return new TypedAddressRequest(reader.readString(Resources.profileKeyField), reader.readString(Resources.urlField));
  }

  public toJson(): JsonObject {
    return { [Resources.profileKeyField]: this.profileKey, [Resources.urlField]: this.url };
  }
}
