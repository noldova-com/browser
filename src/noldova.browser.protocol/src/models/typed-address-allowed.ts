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

export class TypedAddressAllowed {
  private static readonly FIELDS: readonly string[] = [Resources.kindField, Resources.originField];
  private static readonly KINDS: readonly (typeof TypedAddressAnswerKind.Allowed)[] = [TypedAddressAnswerKind.Allowed];

  public readonly kind: typeof TypedAddressAnswerKind.Allowed;
  public readonly origin: string;

  public constructor(origin: string) {
    this.kind = TypedAddressAnswerKind.Allowed;
    this.origin = origin;
  }

  public static fromJson(value: unknown, path?: string): TypedAddressAllowed {
    const reader: JsonReader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, TypedAddressAllowed.FIELDS);
    reader.readOneOf(Resources.kindField, TypedAddressAllowed.KINDS);
    return new TypedAddressAllowed(reader.readString(Resources.originField));
  }

  public toJson(): JsonObject {
    return { [Resources.kindField]: this.kind, [Resources.originField]: this.origin };
  }
}
