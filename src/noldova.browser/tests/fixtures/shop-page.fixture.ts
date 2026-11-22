/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";
import { WebViewFailureException } from "@noldova/desktop.runtime";
import { FieldSelectScript } from "../../src/models/field-select-script.ts";
import { FocusedElementScript } from "../../src/models/focused-element-script.ts";
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
  public static readonly CART_FORM: number = 4;
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
  public static readonly PIN_HOST: number = 16;
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
  private static readonly NOT_FIELDS: WeakSet<ToolBench> = new WeakSet<ToolBench>();
  private static readonly FAILING_SELECTIONS: WeakSet<ToolBench> = new WeakSet<ToolBench>();
  private static readonly FOCUSED: WeakMap<ToolBench, number | null> = new WeakMap<ToolBench, number | null>();

  public static frame(documentId: string = "L1"): JsonObject {
    return { frameTree: { frame: { id: "F1", loaderId: documentId, url: "https://shop.test/cart/", securityOrigin: ShopPage.ORIGIN } } };
  }

  // The cart, whose first form may hold the cart PIN field, in the open or inside a closed shadow root.
  public static document(hasCartPin: boolean = false, hidesCartPin: boolean = false): JsonObject {
    const node: (id: number) => JsonObject = (id: number): JsonObject => ShopPage.NODES.get(id) ?? {};
    const hidden: JsonObject = { backendNodeId: 16, nodeName: "DIV", shadowRoots: [{ backendNodeId: 17, nodeName: "#document-fragment", shadowRootType: "closed", children: [node(15)] }] };
    const pin: readonly JsonObject[] = hidesCartPin ? [hidden] : [];
    return { root: { backendNodeId: 1, nodeName: "#document", baseURL: "https://shop.test/cart/", children: [
      { backendNodeId: 2, nodeName: "HTML", children: [ShopPage.HEAD, { backendNodeId: 3, nodeName: "BODY", children: [
        { backendNodeId: 4, nodeName: "FORM", children: hasCartPin ? [node(14), node(15), node(5)] : [node(14), ...pin, node(5)] },
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
      if (typeof objectId !== "string" || shown === undefined)
        return { result: { type: "boolean", value: true } };
      const backendNodeId: number = Number(objectId.slice("node-".length));
      if (params["functionDeclaration"] === FocusedElementScript.functionDeclaration) {
        const focused: number | null | undefined = ShopPage.FOCUSED.has(bench) ? ShopPage.FOCUSED.get(bench) : backendNodeId;
        return { result: typeof focused === "number" ? { type: "object", subtype: "node", objectId: `node-${String(focused)}` } : { type: "object", subtype: "null", value: null } };
      }
      if (params["functionDeclaration"] === FieldSelectScript.functionDeclaration && ShopPage.FAILING_SELECTIONS.has(bench))
        throw new WebViewFailureException(new WebViewFailure(WebViewFailureKind.Protocol, -32000, "Gone"));
      if (params["functionDeclaration"] === FieldSelectScript.functionDeclaration)
        return { result: { type: "boolean", value: !ShopPage.NOT_FIELDS.has(bench) } };
      if (params["returnByValue"] === true)
        return { result: { type: "object", value: ShopPage.facts(shown, backendNodeId) } };
      const form: JsonObject | undefined = ShopPage.formOf(shown, backendNodeId);
      return { result: form === undefined ? { type: "object", subtype: "null", value: null } : { type: "object", subtype: "node", objectId: `form-${String(form["backendNodeId"])}` } };
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

  // The field selection then answers that no element is a field it can select in.
  public static treatAsNoField(bench: ToolBench): void {
    ShopPage.NOT_FIELDS.add(bench);
  }

  // The element that holds the focus from then on, as when a focus handler moves it, or none; by default the element the call focused.
  public static focus(bench: ToolBench, backendNodeId: number | null): void {
    ShopPage.FOCUSED.set(bench, backendNodeId);
  }

  // The field selection then fails, as when the engine no longer knows the field's object.
  public static failFieldSelection(bench: ToolBench): void {
    ShopPage.FAILING_SELECTIONS.add(bench);
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
      const objectId: JsonValue | undefined = params["objectId"];
      const document: JsonObject | undefined = ShopPage.SHOWN.get(bench)?.document;
      if (typeof objectId === "string" && document !== undefined) {
        const objectOf: number = Number(objectId.slice(objectId.indexOf("-") + 1));
        return { node: ShopPage.pathTo(ShopPage.objectOf(document["root"]), objectOf)?.at(-1) ?? { backendNodeId: objectOf, nodeName: "DIV" } };
      }
      const id: number = Number(params["backendNodeId"]);
      const shown: JsonObject | undefined = document === undefined ? undefined : ShopPage.pathTo(ShopPage.objectOf(document["root"]), id)?.at(-1);
      const whole: JsonObject = ShopPage.NODES.get(id) ?? shown ?? { nodeName: "DIV" };
      const { children: _children, ...node }: JsonObject = whole;
      const described: JsonObject = params["depth"] === -1 ? whole : node;
      return { node: id === changed ? { ...described, attributes: [...attributes] } : described };
    });
  }

  // The facts the pinned function gives by value for the element on this document, as it reads them: the path from the document, the
  // elements that name its form, none here, the form's label, and the page's title and base URL.
  private static facts(shown: ShownDocument, backendNodeId: number): JsonObject {
    const root: JsonObject = ShopPage.objectOf(shown.document["root"]);
    const path: readonly JsonObject[] | null = ShopPage.pathTo(root, backendNodeId);
    const read = (node: JsonObject): JsonValue => [String(node["nodeName"]), node["backendNodeId"] === shown.changed ? [...shown.attributes] : ShopPage.listOf(node["attributes"])];
    const form: JsonObject | undefined = ShopPage.formOf(shown, backendNodeId);
    const attributes: readonly JsonValue[] = form === undefined ? [] : ShopPage.listOf(form["attributes"]);
    const label: number = attributes.indexOf("aria-label");
    return { path: path === null ? null : path.map(read), linked: [], formName: label === -1 ? "" : String(attributes[label + 1]), title: "Cart", baseUrl: String(root["baseURL"]) };
  }

  // The nearest form above the element, which the function gives as an object for the form's subtree to be described.
  private static formOf(shown: ShownDocument, backendNodeId: number): JsonObject | undefined {
    return ShopPage.pathTo(ShopPage.objectOf(shown.document["root"]), backendNodeId)?.slice(0, -1).findLast(t => t["nodeName"] === "FORM");
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

  private static listOf(value: JsonValue | undefined): readonly JsonValue[] {
    return JsonShapes.isArray(value) ? value : [];
  }

  private static objectOf(value: JsonValue | undefined): JsonObject {
    if (!JsonShapes.isObject(value))
      throw new Error("The shop page's document holds a node that isn't an object.");
    return value;
  }
}
