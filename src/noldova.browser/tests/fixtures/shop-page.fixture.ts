/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonShapes } from "../../src/services/json-shapes.ts";
import type { JsonObject, JsonValue } from "../../src/types/json-value.ts";
import type { ToolBench } from "./tool-bench.fixture.ts";

// What the page shows the pinned element facts function: its document, and the one element whose attributes changed, if any.
class ShownDocument {
  public document: JsonObject;
  public changed: number | null = null;
  public attributes: readonly string[] = [];

  public constructor(document: JsonObject) {
    this.document = document;
  }
}

export class ShopPage {
  public static readonly FORM_BUTTON: number = 5;
  public static readonly BUTTON_LABEL: number = 6;
  public static readonly LINK: number = 7;
  public static readonly BANNER: number = 8;
  public static readonly PASSWORD: number = 9;
  public static readonly SEARCH: number = 10;
  public static readonly SIGN_IN: number = 12;
  public static readonly EMAIL: number = 13;
  public static readonly COUPON: number = 14;
  public static readonly CART_PIN: number = 15;
  public static readonly ORIGIN: string = "https://shop.test";
  private static readonly LABELS: ReadonlyMap<number, readonly [string, string]> = new Map<number, readonly [string, string]>([
    [5, ["button", "Pay"]],
    [6, ["StaticText", "Pay"]],
    [7, ["link", "Help"]],
    [8, ["generic", ""]],
    [9, ["textbox", "PIN"]],
    [10, ["searchbox", "Search"]],
    [12, ["button", "Sign in"]],
    [13, ["textbox", "Email"]],
    [14, ["textbox", "Coupon"]]
  ]);
  private static readonly NODES: ReadonlyMap<number, JsonObject> = new Map<number, JsonObject>([
    [5, { backendNodeId: 5, nodeName: "BUTTON", attributes: ["type", "submit"], children: [{ backendNodeId: 6, nodeName: "SPAN" }] }],
    [7, { backendNodeId: 7, nodeName: "A", attributes: ["href", "/help"] }],
    [8, { backendNodeId: 8, nodeName: "DIV", attributes: ["class", "banner"] }],
    [9, { backendNodeId: 9, nodeName: "INPUT", attributes: ["type", "password", "name", "pin"] }],
    [10, { backendNodeId: 10, nodeName: "INPUT", attributes: ["type", "search"] }],
    [12, { backendNodeId: 12, nodeName: "BUTTON", attributes: [] }],
    [13, { backendNodeId: 13, nodeName: "INPUT", attributes: ["type", "email"] }],
    [14, { backendNodeId: 14, nodeName: "INPUT", attributes: ["type", "text", "name", "coupon"] }],
    [15, { backendNodeId: 15, nodeName: "INPUT", attributes: ["type", "password", "name", "cart-pin"] }]
  ]);

  private static readonly HEAD: JsonObject = { backendNodeId: 20, nodeName: "HEAD", children: [
    { backendNodeId: 21, nodeName: "TITLE", children: [{ backendNodeId: 22, nodeName: "#text", nodeValue: "Cart" }] }
  ] };

  private static readonly SHOWN: WeakMap<ToolBench, ShownDocument> = new WeakMap<ToolBench, ShownDocument>();

  public static frame(documentId: string = "L1"): JsonObject {
    return { frameTree: { frame: { id: "F1", loaderId: documentId, url: "https://shop.test/cart/", securityOrigin: ShopPage.ORIGIN } } };
  }

  public static document(hasCartPin: boolean = false): JsonObject {
    const node: (id: number) => JsonObject = (id: number): JsonObject => ShopPage.NODES.get(id) ?? {};
    return { root: { backendNodeId: 1, nodeName: "#document", baseURL: "https://shop.test/cart/", children: [
      { backendNodeId: 2, nodeName: "HTML", children: [ShopPage.HEAD, { backendNodeId: 3, nodeName: "BODY", children: [
        { backendNodeId: 4, nodeName: "FORM", children: hasCartPin ? [node(14), node(15), node(5)] : [node(14), node(5)] },
        { backendNodeId: 11, nodeName: "FORM", attributes: ["id", "sign-in", "aria-label", "Sign in to the shop"], children: [node(13), node(9), node(12)] },
        node(7), node(8), node(10)
      ] }] }
    ] } };
  }

  public static serve(bench: ToolBench, hit: number): void {
    bench.surface.answer("Page.getFrameTree", ShopPage.frame());
    ShopPage.showDocument(bench, ShopPage.document());
    bench.surface.answerWith("DOM.resolveNode", (params: JsonObject) => ({ object: { type: "object", objectId: `node-${String(params["backendNodeId"])}` } }));
    bench.surface.answerWith("Runtime.callFunctionOn", (params: JsonObject) => {
      const objectId: JsonValue | undefined = params["objectId"];
      const shown: ShownDocument | undefined = ShopPage.SHOWN.get(bench);
      return typeof objectId === "string" && shown !== undefined
        ? { result: { type: "object", value: ShopPage.facts(shown, Number(objectId.slice("node-".length))) } }
        : { result: { type: "boolean", value: true } };
    });
    bench.surface.answerWith("Accessibility.getPartialAXTree", (params: JsonObject) => {
      const id: number = Number(params["backendNodeId"]);
      const [role, name]: readonly [string, string] = ShopPage.LABELS.get(id) ?? ["generic", ""];
      return { nodes: [{ nodeId: `ax-${id}`, role: { value: role }, name: { value: name }, backendDOMNodeId: id }] };
    });
    ShopPage.describe(bench, null);
    bench.surface.answer("DOM.getContentQuads", { quads: [[10, 10, 30, 10, 30, 20, 10, 20]] });
    bench.surface.answer("Page.getLayoutMetrics", { cssVisualViewport: { pageX: 0, pageY: 0, clientWidth: 800, clientHeight: 600 }, cssContentSize: { width: 800, height: 600 },
      visualViewport: { clientWidth: 800 } });
    bench.surface.answer("DOM.getNodeForLocation", { backendNodeId: hit, frameId: "F1" });
  }

  // The document the element facts function reads from now on, as when the page changes after the person was asked.
  public static showDocument(bench: ToolBench, document: JsonObject): void {
    const shown: ShownDocument | undefined = ShopPage.SHOWN.get(bench);
    if (shown === undefined)
      ShopPage.SHOWN.set(bench, new ShownDocument(document));
    else
      shown.document = document;
  }

  public static describe(bench: ToolBench, changed: number | null, attributes: readonly string[] = ["type", "password"]): void {
    const shown: ShownDocument | undefined = ShopPage.SHOWN.get(bench);
    if (shown !== undefined) {
      shown.changed = changed;
      shown.attributes = attributes;
    }
    bench.surface.answerWith("DOM.describeNode", (params: JsonObject) => {
      const id: number = Number(params["backendNodeId"]);
      const whole: JsonObject = ShopPage.NODES.get(id) ?? { nodeName: "DIV" };
      const { children: _children, ...node }: JsonObject = whole;
      const described: JsonObject = params["depth"] === -1 ? whole : node;
      return { node: id === changed ? { ...described, attributes: [...attributes] } : described };
    });
  }

  // The facts the pinned function gives for the element on this document, as it reads them: the path from the document, the elements of
  // the nearest form above the element, the form's label or title, and the page's title and base URL.
  private static facts(shown: ShownDocument, backendNodeId: number): JsonObject {
    const root: JsonObject = ShopPage.objectOf(shown.document["root"]);
    const page: JsonObject = { title: "Cart", baseUrl: String(root["baseURL"]) };
    const path: readonly JsonObject[] | null = ShopPage.pathTo(root, backendNodeId);
    if (path === null)
      return { path: null, form: [], formName: "", ...page };
    const read = (node: JsonObject): JsonValue => [String(node["nodeName"]), node["backendNodeId"] === shown.changed ? [...shown.attributes] : ShopPage.listOf(node["attributes"])];
    const form: JsonObject | undefined = path.slice(0, -1).findLast(t => t["nodeName"] === "FORM");
    const attributes: readonly JsonValue[] = form === undefined ? [] : ShopPage.listOf(form["attributes"]);
    const label: number = attributes.indexOf("aria-label");
    return {
      path: path.map(read),
      form: form === undefined ? [] : ShopPage.elementsOf(form).map(read),
      formName: label === -1 ? "" : String(attributes[label + 1]),
      ...page
    };
  }

  private static pathTo(node: JsonObject, backendNodeId: number): readonly JsonObject[] | null {
    if (node["backendNodeId"] === backendNodeId)
      return [node];
    for (const child of ShopPage.listOf(node["children"])) {
      const below: readonly JsonObject[] | null = ShopPage.pathTo(ShopPage.objectOf(child), backendNodeId);
      if (below !== null)
        return [node, ...below];
    }
    return null;
  }

  private static elementsOf(node: JsonObject): readonly JsonObject[] {
    return [node, ...ShopPage.listOf(node["children"]).flatMap(t => ShopPage.elementsOf(ShopPage.objectOf(t)))];
  }

  private static listOf(value: JsonValue | undefined): readonly JsonValue[] {
    return JsonShapes.isArray(value) ? value : [];
  }

  private static objectOf(value: JsonValue | undefined): JsonObject {
    if (!JsonShapes.isObject(value))
      throw new Error("The shop page's document holds a node that isn't an object.");
    return value;
  }
}
