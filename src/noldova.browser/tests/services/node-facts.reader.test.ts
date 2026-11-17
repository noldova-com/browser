/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { MalformedReplyException } from "../../src/exceptions/malformed-reply.exception.ts";
import { ElementFacts } from "../../src/models/element-facts.ts";
import { NodeFacts } from "../../src/models/node-facts.ts";
import { PageFacts } from "../../src/models/page-facts.ts";
import { NodeFactsReader } from "../../src/services/node-facts.reader.ts";
import type { JsonObject, JsonValue } from "../../src/types/json-value.ts";

function expectMalformed(read: () => unknown): void {
  try {
    read();
  }
  catch (error) {
    expect(error).toBeInstanceOf(MalformedReplyException);
    expect(error).toMatchObject({ reason: "Unavailable", moduleCode: "browser.malformedReply" });
    return;
  }
  expect.fail("The reply was accepted.");
}

function answer(value: JsonValue): JsonObject {
  return { result: { type: "object", value } };
}

const FACTS: JsonObject = {
  path: [["#document", []], ["HTML", []], ["form", ["ID", "checkout"]], ["button", ["type", "submit"]]],
  form: [["form", ["ID", "checkout"]], ["input", ["Type", "Password"]]],
  formName: "Checkout",
  title: "Cart",
  baseUrl: "https://shop.test/cart/"
};

describe("NodeFactsReader", () => {
  it("reads a node's kind and attributes, with names normalized", () => {
    const facts: NodeFacts = NodeFactsReader.readNode({ node: { nodeName: "input", attributes: ["TYPE", "Password", "name", "pin"] } });

    expect(facts).toBeInstanceOf(NodeFacts);
    expect(facts.nodeName).toBe("INPUT");
    expect([...facts.attributes]).toEqual([["type", "Password"], ["name", "pin"]]);
  });

  it("reads a node without attributes", () => {
    expect(NodeFactsReader.readNode({ node: { nodeName: "#text" } }).attributes.size).toBe(0);
  });

  it("refuses a node reply of another shape", () => {
    const replies: readonly JsonObject[] = [
      {},
      { node: null },
      { node: [] },
      { node: "A" },
      { node: { nodeName: 1 } },
      { node: { nodeName: "A", attributes: "href" } },
      { node: { nodeName: "A", attributes: ["href"] } },
      { node: { nodeName: "A", attributes: ["href", 1] } },
      { node: { nodeName: "A", attributes: [1, "x"] } }
    ];
    for (const reply of replies)
      expectMalformed(() => NodeFactsReader.readNode(reply));
  });

  it("reads the pinned function's facts: the path root first and the form's elements, with names normalized, the form's name and the page", () => {
    const facts: ElementFacts = NodeFactsReader.readElement(answer(FACTS));

    expect(facts).toBeInstanceOf(ElementFacts);
    expect(facts.path?.map(t => t.nodeName)).toEqual(["#DOCUMENT", "HTML", "FORM", "BUTTON"]);
    expect(facts.path?.at(-2)?.attributes.get("id")).toBe("checkout");
    expect(facts.form.map(t => [t.nodeName, [...t.attributes]])).toEqual([["FORM", [["id", "checkout"]]], ["INPUT", [["type", "Password"]]]]);
    expect([facts.formName, facts.page]).toEqual(["Checkout", new PageFacts("https://shop.test/cart/", "Cart")]);
  });

  it("reads no path for an element outside the main frame's document", () => {
    expect(NodeFactsReader.readElement(answer({ ...FACTS, path: null, form: [] })).path).toBeNull();
  });

  it("refuses an answer of another shape", () => {
    const answers: readonly JsonObject[] = [
      {},
      { result: "facts" },
      { result: {} },
      answer("facts"),
      answer({ ...FACTS, path: "none" }),
      answer({ ...FACTS, path: [["A"]] }),
      answer({ ...FACTS, path: ["A", []] }),
      answer({ ...FACTS, path: [[1, []]] }),
      answer({ ...FACTS, path: [["A", "href"]] }),
      answer({ ...FACTS, form: null }),
      answer({ ...FACTS, form: [["INPUT", ["type"]]] }),
      answer({ ...FACTS, formName: null }),
      answer({ ...FACTS, title: 1 }),
      answer({ ...FACTS, baseUrl: null })
    ];
    for (const reply of answers)
      expectMalformed(() => NodeFactsReader.readElement(reply));
  });

  it("says whether a node is the described node or inside its subtree, through shadow roots, and not when it is outside or missing", () => {
    const form: JsonObject = { node: { backendNodeId: 4, nodeName: "FORM", children: [{ backendNodeId: 5, nodeName: "BUTTON" }] } };
    const host: JsonObject = { node: { backendNodeId: 6, nodeName: "DIV", shadowRoots: [{ backendNodeId: 7, nodeName: "#document-fragment", children: [{ backendNodeId: 8, nodeName: "A" }] }] } };

    expect([
      NodeFactsReader.holds(form, 5),
      NodeFactsReader.holds(form, 4),
      NodeFactsReader.holds(host, 8),
      NodeFactsReader.holds(form, 8),
      NodeFactsReader.holds(form, 99)
    ]).toEqual([true, true, true, false, false]);
    expectMalformed(() => NodeFactsReader.holds({}, 5));
  });
});
