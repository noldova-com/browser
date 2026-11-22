/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { describe, expect, it } from "vitest";

import { OpenPageArgumentsInvalidException } from "../../../src/app/exceptions/open-page-arguments-invalid.exception.ts";
import { PageOpening } from "../../../src/app/models/page-opening.ts";
import { OpenPageArguments } from "../../../src/app/services/open-page-arguments.ts";

const INSTANCE: string = "3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d";

describe("OpenPageArguments", () => {
  it("reads the workspace's profile key and the first address, or none", () => {
    expect(OpenPageArguments.read({ profileKey: "workspace-1", url: "https://docs.example.com/" })).toStrictEqual(new PageOpening("workspace-1", "https://docs.example.com/", null));
    expect(OpenPageArguments.read({ profileKey: "workspace-1" })).toStrictEqual(new PageOpening("workspace-1", null, null));
    expect(OpenPageArguments.isValid({ profileKey: `a${"b".repeat(63)}` })).toBe(true);
  });

  it("reads the page document's instance the app picked, a lowercase UUID", () => {
    expect(OpenPageArguments.read({ profileKey: "workspace-1", instance: INSTANCE })).toStrictEqual(new PageOpening("workspace-1", null, INSTANCE));
  });

  it("reads a blank address as no address, so the page opens empty", () => {
    expect([OpenPageArguments.read({ profileKey: "workspace-1", url: "" }), OpenPageArguments.read({ profileKey: "workspace-1", url: " 	" })])
      .toStrictEqual([new PageOpening("workspace-1", null, null), new PageOpening("workspace-1", null, null)]);
  });

  it("refuses arguments that aren't an object, lack or misspell their fields, or name the person's own links workspace", () => {
    for (const commandArguments of [null, "workspace-1", ["workspace-1"], {}, { profileKey: 1 }, { profileKey: "Workspace" }, { profileKey: `a${"b".repeat(64)}` }, { profileKey: "links" },
      { profileKey: "workspace-1", url: 1 }, { profileKey: "workspace-1", url: null },
      { profileKey: "workspace-1", instance: 1 }, { profileKey: "workspace-1", instance: "page-1" }, { profileKey: "workspace-1", instance: INSTANCE.toUpperCase() },
      { profileKey: "workspace-1", instance: `${INSTANCE}0` }, { profileKey: "workspace-1", instance: null }]) {
      expect(OpenPageArguments.isValid(commandArguments), JSON.stringify(commandArguments)).toBe(false);
      expect(() => OpenPageArguments.read(commandArguments), JSON.stringify(commandArguments)).toThrow(OpenPageArgumentsInvalidException);
    }
  });
});
