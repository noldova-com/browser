/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { ToolSchemas } from "../../src/models/tool-schemas.ts";

describe("ToolSchemas", () => {
  it("builds a closed object schema with its properties and a copy of its required names", () => {
    const required: string[] = ["a"];

    const schema: object = ToolSchemas.objectSchema({ a: { type: "string" } }, required);
    required.push("b");

    expect(schema).toEqual({ type: "object", properties: { a: { type: "string" } }, required: ["a"], additionalProperties: false });
  });

  it("describes a result's page and element, each text cut to its shown length", () => {
    expect(ToolSchemas.output).toEqual({
      type: "object",
      properties: {
        page: {
          type: "object",
          properties: { url: { type: "string", maxLength: 2_048 }, title: { type: "string", maxLength: 1_024 } },
          required: ["url", "title"],
          additionalProperties: false
        },
        element: {
          type: "object",
          properties: { role: { type: "string", maxLength: 1_024 }, name: { type: "string", maxLength: 1_024 }, isSecret: { type: "boolean" } },
          required: ["role", "name", "isSecret"],
          additionalProperties: false
        }
      },
      required: ["page"],
      additionalProperties: false
    });
  });

  it("hints that an acting tool changes the page and a reading one doesn't, both on the open web, and refuses an empty reference", () => {
    expect([ToolSchemas.acting, ToolSchemas.reading, ToolSchemas.reference]).toEqual([
      { isReadOnly: false, isDestructive: true, isOpenWorld: true },
      { isReadOnly: true, isDestructive: false, isOpenWorld: true },
      { type: "string", minLength: 1 }
    ]);
  });

  it("gives a step 15 seconds and a wait its 30 seconds and 5 more for the answer, each at most a minute", () => {
    expect([ToolSchemas.stepDeadline, ToolSchemas.waitDeadline]).toEqual([{ default: 15_000, maximum: 60_000 }, { default: 35_000, maximum: 60_000 }]);
  });
});
