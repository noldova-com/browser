/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, JsonReader } from "@noldova/context.json";
import { describe, expect, it } from "vitest";

import { WireContract } from "../../src/services/wire-contract.ts";

describe("WireContract", () => {
  it("accepts an object of known fields, and refuses an unknown one at its path", () => {
    const reader: JsonReader = JsonReader.fromValue({ inner: { a: 1, b: 2 } }).readObject("inner");

    expect(() => WireContract.requireKnownFields(reader, ["a", "b"])).not.toThrow();
    expect(() => WireContract.requireKnownFields(reader, ["a"])).toThrow(JsonException);
    expect(() => WireContract.requireKnownFields(reader, ["a"])).toThrow("$.inner.b: The field isn't part of the message.");
  });

  it("gives the factory's value", () => {
    expect(WireContract.create(JsonReader.fromValue({}), () => 7)).toBe(7);
  });

  it("turns an argument failure into a JSON failure at the argument's field, or at the object without one, keeping it as the cause", () => {
    const reader: JsonReader = JsonReader.fromValue({ box: {} }).readObject("box");
    const named: ArgumentException = new ArgumentException("Too small.", "width");
    const unnamed: ArgumentException = new ArgumentException("Wrong.");
    const read = (error: ArgumentException): unknown => {
      try {
        return WireContract.create(reader, () => {
          throw error;
        });
      }
      catch (failure) {
        return failure;
      }
    };

    expect([read(named), read(unnamed)].map(t => t instanceof JsonException ? [t.path, t.cause] : t)).toEqual([["$.box.width", named], ["$.box", unnamed]]);
  });

  it("passes any other failure on unchanged", () => {
    const error: Error = new Error("Broken.");

    expect(() => WireContract.create(JsonReader.fromValue({}), () => {
      throw error;
    })).toThrow(error);
  });
});
