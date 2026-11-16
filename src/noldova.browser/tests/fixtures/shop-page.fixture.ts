/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "../../src/types/json-value.ts";
import type { ToolBench } from "./tool-bench.fixture.ts";

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
    bench.surface.answer("DOM.getDocument", ShopPage.document());
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

  public static describe(bench: ToolBench, changed: number | null, attributes: readonly string[] = ["type", "password"]): void {
    bench.surface.answerWith("DOM.describeNode", (params: JsonObject) => {
      const id: number = Number(params["backendNodeId"]);
      const whole: JsonObject = ShopPage.NODES.get(id) ?? { nodeName: "DIV" };
      const { children: _children, ...node }: JsonObject = whole;
      const described: JsonObject = params["depth"] === -1 ? whole : node;
      return { node: id === changed ? { ...described, attributes: [...attributes] } : described };
    });
  }
}
