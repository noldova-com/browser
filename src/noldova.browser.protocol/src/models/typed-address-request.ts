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
  private static readonly FIELDS: readonly string[] = [Resources.profileKeyField, Resources.urlField, Resources.instanceField];

  public readonly profileKey: string;
  public readonly url: string;
  public readonly instance: string | null;

  public constructor(profileKey: string, url: string, instance: string | null = null) {
    this.profileKey = profileKey;
    this.url = url;
    this.instance = instance;
  }

  public static fromJson(value: unknown, path?: string): TypedAddressRequest {
    const reader: JsonReader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, TypedAddressRequest.FIELDS);
    return new TypedAddressRequest(reader.readString(Resources.profileKeyField), reader.readString(Resources.urlField), reader.readOptionalString(Resources.instanceField) ?? null);
  }

  public toJson(): JsonObject {
    const json: JsonObject = { [Resources.profileKeyField]: this.profileKey, [Resources.urlField]: this.url };
    return this.instance === null ? json : { ...json, [Resources.instanceField]: this.instance };
  }
}
