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

export class OpenPagesRequest {
  private static readonly FIELDS: readonly string[] = [Resources.instancesField];

  public readonly instances: readonly string[];

  public constructor(instances: readonly string[]) {
    this.instances = instances;
  }

  public static fromJson(value: unknown, path?: string): OpenPagesRequest {
    const reader: JsonReader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, OpenPagesRequest.FIELDS);
    return new OpenPagesRequest(reader.readStringArray(Resources.instancesField));
  }

  public toJson(): JsonObject {
    return { [Resources.instancesField]: this.instances };
  }
}
