/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/context.json";

import { TypedAddressAnswerKind } from "../enums/typed-address-answer-kind.ts";
import { Resources } from "../resources.ts";
import { WireContract } from "../services/wire-contract.ts";

export class TypedAddressLeft {
  private static readonly FIELDS: readonly string[] = [Resources.kindField];
  private static readonly KINDS: readonly (typeof TypedAddressAnswerKind.Left)[] = [TypedAddressAnswerKind.Left];

  public readonly kind: typeof TypedAddressAnswerKind.Left;

  public constructor() {
    this.kind = TypedAddressAnswerKind.Left;
  }

  public static fromJson(value: unknown, path?: string): TypedAddressLeft {
    const reader: JsonReader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, TypedAddressLeft.FIELDS);
    reader.readOneOf(Resources.kindField, TypedAddressLeft.KINDS);
    return new TypedAddressLeft();
  }

  public toJson(): JsonObject {
    return { [Resources.kindField]: this.kind };
  }
}
