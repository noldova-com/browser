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

export class PageAgent {
  private static readonly FIELDS: readonly string[] = [Resources.instanceField, Resources.agentNameField];

  public readonly instance: string;
  public readonly agentName: string;

  public constructor(instance: string, agentName: string) {
    this.instance = instance;
    this.agentName = agentName;
  }

  public static fromJson(value: unknown, path?: string): PageAgent {
    const reader: JsonReader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, PageAgent.FIELDS);
    return new PageAgent(reader.readString(Resources.instanceField), reader.readString(Resources.agentNameField));
  }

  public toJson(): JsonObject {
    return { [Resources.instanceField]: this.instance, [Resources.agentNameField]: this.agentName };
  }
}
