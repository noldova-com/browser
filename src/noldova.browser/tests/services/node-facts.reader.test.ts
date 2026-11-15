/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { MalformedReplyException } from "../../src/exceptions/malformed-reply.exception.ts";
import { NodeFacts } from "../../src/models/node-facts.ts";
import { NodeFactsReader } from "../../src/services/node-facts.reader.ts";
import type { JsonObject } from "../../src/types/json-value.ts";

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

const DOCUMENT: JsonObject = {
  root: {
    backendNodeId: 1,
    nodeName: "#document",
    baseURL: "https://shop.test/cart/",
    children: [{
      backendNodeId: 2,
      nodeName: "HTML",
      children: [{
        backendNodeId: 3,
        nodeName: "BODY",
        children: [
          { backendNodeId: 4, nodeName: "FORM", attributes: ["id", "checkout"], children: [{ backendNodeId: 5, nodeName: "BUTTON", attributes: ["type", "submit"] }] },
          { backendNodeId: 6, nodeName: "DIV", shadowRoots: [{ backendNodeId: 7, nodeName: "#document-fragment", children: [{ backendNodeId: 8, nodeName: "A" }] }] },
          { backendNodeId: 20, nodeName: "FORM", children: [{ backendNodeId: 21, nodeName: "INPUT", attributes: ["type", "password"] }, { backendNodeId: 22, nodeName: "BUTTON" }] },
          { backendNodeId: 23, nodeName: "INPUT", attributes: ["form", "checkout", "type", "password"] },
          { backendNodeId: 24, nodeName: "BUTTON", attributes: ["form", "checkout"] },
          { backendNodeId: 25, nodeName: "BUTTON", attributes: ["form", "missing"] }
        ]
      }]
    }]
  }
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

  it("reads a node's ancestors from the document, root first", () => {
    expect(NodeFactsReader.readAncestors(DOCUMENT, 5)?.map(t => t.nodeName)).toEqual(["#DOCUMENT", "HTML", "BODY", "FORM"]);
    expect(NodeFactsReader.readAncestors(DOCUMENT, 5)?.at(-1)?.attributes.get("id")).toBe("checkout");
    expect(NodeFactsReader.readAncestors(DOCUMENT, 5)?.every(t => t instanceof NodeFacts)).toBe(true);
  });

  it("finds a node inside a shadow root", () => {
    expect(NodeFactsReader.readAncestors(DOCUMENT, 8)?.map(t => t.nodeName)).toEqual(["#DOCUMENT", "HTML", "BODY", "DIV", "#DOCUMENT-FRAGMENT"]);
  });

  it("gives the root no ancestors and a missing node none at all", () => {
    expect(NodeFactsReader.readAncestors(DOCUMENT, 1)).toEqual([]);
    expect(NodeFactsReader.readAncestors(DOCUMENT, 99)).toBeNull();
  });

  it("refuses a document of another shape", () => {
    const documents: readonly JsonObject[] = [
      {},
      { root: { backendNodeId: 1, nodeName: "#document", children: "none" } },
      { root: { backendNodeId: 1, nodeName: "#document", children: [3] } },
      { root: { backendNodeId: 1, nodeName: 3, children: [{ backendNodeId: 2, nodeName: "HTML" }] } }
    ];
    for (const document of documents)
      expectMalformed(() => NodeFactsReader.readAncestors(document, 2));
  });

  it("reads the document's base URL", () => {
    expect(NodeFactsReader.readBaseUrl(DOCUMENT)).toBe("https://shop.test/cart/");
    expectMalformed(() => NodeFactsReader.readBaseUrl({ root: { nodeName: "#document" } }));
  });

  it("reads the nodes of a node's form: its nearest form's own and those that name the form, or the form its form attribute names", () => {
    const names = (backendNodeId: number): string[] => NodeFactsReader.readFormNodes(DOCUMENT, backendNodeId).map(t => t.nodeName).sort();

    expect([names(5), names(24), names(21)]).toEqual([["BUTTON", "BUTTON", "FORM", "INPUT"], ["BUTTON", "BUTTON", "FORM", "INPUT"], ["BUTTON", "FORM", "INPUT"]]);
    expect(NodeFactsReader.readFormNodes(DOCUMENT, 24).find(t => t.nodeName === "INPUT")?.attributes.get("type")).toBe("password");
    expect(NodeFactsReader.readFormNodes(DOCUMENT, 24).every(t => t instanceof NodeFacts)).toBe(true);
  });

  it("reads no form nodes for a node outside any form, one naming a form the document doesn't hold, or a node it doesn't hold", () => {
    expect([NodeFactsReader.readFormNodes(DOCUMENT, 8), NodeFactsReader.readFormNodes(DOCUMENT, 25), NodeFactsReader.readFormNodes(DOCUMENT, 99)]).toEqual([[], [], []]);
    expectMalformed(() => NodeFactsReader.readFormNodes({}, 5));
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
