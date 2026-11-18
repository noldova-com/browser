/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { MalformedReplyException } from "../../src/exceptions/malformed-reply.exception.ts";
import { StaleReferenceException } from "../../src/exceptions/stale-reference.exception.ts";
import { CutText } from "../../src/models/cut-text.ts";
import { PageSnapshot } from "../../src/models/page-snapshot.ts";
import { SnapshotLine } from "../../src/models/snapshot-line.ts";
import { PageSnapshotReader } from "../../src/services/page-snapshot.reader.ts";
import type { JsonObject, JsonValue } from "../../src/types/json-value.ts";

const REPLY: JsonObject = {
  title: "Sign in", lines: [[0, "RootWebArea", "Sign in", "", false, -1, -1], [1, "textbox", "PIN", "4321", true, 0, -1], [1, "generic", "", "", false, 1, 0]],
  isCut: true, isDeeper: false, isFromView: true
};

describe("PageSnapshotReader", () => {
  it("reads the function's answer, a line's -1 as no element or host and a masked line's value as none", () => {
    expect(PageSnapshotReader.read(REPLY)).toStrictEqual(new PageSnapshot("Sign in", [
      new SnapshotLine(0, "RootWebArea", "Sign in", "", false, null),
      new SnapshotLine(1, "textbox", "PIN", "", true, 0),
      new SnapshotLine(1, "generic", "", "", false, 1, 0)
    ], true, false, true));
  });

  it("reads a part whose element left the page as stale", () => {
    expect(() => PageSnapshotReader.read({ stale: true })).toThrow(StaleReferenceException);
  });

  it.each([
    ["no title", { ...REPLY, title: 1 }],
    ["no lines", { ...REPLY, lines: {} }],
    ["no cut", { ...REPLY, isCut: "no" }],
    ["no depth", { ...REPLY, isDeeper: null }],
    ["no view", { ...REPLY, isFromView: 0 }]
  ])("reads an answer with %s as malformed", (_name: string, reply: JsonObject) => {
    expect(() => PageSnapshotReader.read(reply)).toThrow(MalformedReplyException);
  });

  it.each<[string, JsonValue]>([
    ["not a list", "line"],
    ["a negative depth", [-1, "button", "", "", false, -1, -1]],
    ["a part depth", [1.5, "button", "", "", false, -1, -1]],
    ["a text depth", ["1", "button", "", "", false, -1, -1]],
    ["an empty role", [1, "", "", "", false, -1, -1]],
    ["a role that isn't text", [1, 2, "", "", false, -1, -1]],
    ["a name that isn't text", [1, "button", 2, "", false, -1, -1]],
    ["a value that isn't text", [1, "button", "", 2, false, -1, -1]],
    ["a mask that isn't a flag", [1, "button", "", "", "no", -1, -1]],
    ["an index below -1", [1, "button", "", "", false, -2, -1]],
    ["a part index", [1, "button", "", "", false, 0.5, -1]],
    ["a text index", [1, "button", "", "", false, "0", -1]],
    ["no host", [1, "button", "", "", false, -1]],
    ["a host below -1", [1, "button", "", "", false, -1, -2]]
  ])("reads a line with %s as malformed", (_name: string, line: JsonValue) => {
    expect(() => PageSnapshotReader.read({ ...REPLY, lines: [line] })).toThrow(MalformedReplyException);
  });

  it("writes each line with its depth, role, name, value or mask, and the reference it issues for the element, in order", () => {
    const issued: number[] = [];
    const lines: readonly SnapshotLine[] = [
      new SnapshotLine(0, "RootWebArea", "Sign in", "", false, null),
      new SnapshotLine(1, "generic", "", "", false, null),
      new SnapshotLine(2, "textbox", "Email", "a\"b", false, 4),
      new SnapshotLine(2, "textbox", "PIN", "", true, 9),
      new SnapshotLine(2, "button", "Buy", "", false, null, null, 27)
    ];

    const text: CutText = PageSnapshotReader.write(lines, t => `e${issued.push(t)}`, t => `e${issued.push(-t)}`, 1_000);

    expect(text).toStrictEqual(new CutText([
      "- RootWebArea \"Sign in\"",
      "  - generic",
      "    - textbox \"Email\" value=\"a\\\"b\" [e1]",
      "    - textbox \"PIN\" value=\"••••••\" [e2]",
      "    - button \"Buy\" [e3]"
    ].join("\n"), false));
    expect(issued).toEqual([4, 9, -27]);
  });

  it("cuts at the last line that fits with its newline and the most a reference takes, issuing no reference past it", () => {
    const issued: number[] = [];
    const lines: readonly SnapshotLine[] = [new SnapshotLine(0, "link", "a", "", false, 1), new SnapshotLine(0, "link", "b", "", false, 2)];
    // "- link \"a\"" is 10 bytes: with its newline and the most a reference takes, 22; kept with its reference and newline, 16.
    const fits: CutText = PageSnapshotReader.write(lines.slice(0, 1), t => `e${issued.push(t)}`, () => "", 22);
    const cut: CutText = PageSnapshotReader.write(lines.slice(0, 1), t => `e${issued.push(t)}`, () => "", 21);
    const second: CutText = PageSnapshotReader.write(lines, t => `e${issued.push(t)}`, () => "", 16 + 22 - 1);
    const node: CutText = PageSnapshotReader.write([new SnapshotLine(0, "link", "a", "", false, null, null, 3)], () => "", t => `e${t}`, 21);

    expect([fits, cut, second, node]).toStrictEqual([new CutText("- link \"a\" [e1]", false), new CutText("", true), new CutText("- link \"a\" [e2]", true),
      new CutText("", true)]);
    expect(issued).toEqual([1, 1]);
  });

  it("counts a line without an element without the reference's bytes", () => {
    const text: CutText = PageSnapshotReader.write([new SnapshotLine(0, "heading", "a", "", false, null)], () => "e1", () => "e1", 14);

    expect(text).toStrictEqual(new CutText("- heading \"a\"", false));
  });
});
