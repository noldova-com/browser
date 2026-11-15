/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolRisk } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { NodeFacts } from "../../src/models/node-facts.ts";
import { RiskClassifier } from "../../src/services/risk-classifier.ts";

const BODY: readonly NodeFacts[] = [node("#DOCUMENT"), node("HTML"), node("BODY")];
const FORM: readonly NodeFacts[] = [...BODY, node("FORM")];
const NO_FORM: readonly NodeFacts[] = [];

function node(nodeName: string, attributes: Record<string, string> = {}): NodeFacts {
  return new NodeFacts(nodeName, new Map(Object.entries(attributes)));
}

function inBody(...path: NodeFacts[]): readonly NodeFacts[] {
  return [...BODY, ...path];
}

function inForm(...path: NodeFacts[]): readonly NodeFacts[] {
  return [...FORM, ...path];
}

describe("RiskClassifier", () => {
  describe("classifyClick", () => {
    it("asks every time when the click can't be classified", () => {
      expect(RiskClassifier.classifyClick(null, NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyClick([], NO_FORM)).toBe(ToolRisk.Medium);
    });

    it("treats a click on plain content as medium", () => {
      expect(RiskClassifier.classifyClick(inBody(node("DIV"), node("SPAN")), NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyClick(inBody(node("A")), NO_FORM)).toBe(ToolRisk.Medium);
    });

    it("treats a submit control in a form as medium", () => {
      expect(RiskClassifier.classifyClick(inForm(node("BUTTON")), NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyClick(inForm(node("BUTTON", { type: "submit" })), NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyClick(inForm(node("BUTTON", { type: "anything" })), NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyClick(inForm(node("INPUT", { type: "Submit" })), NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyClick(inForm(node("INPUT", { type: "image" })), NO_FORM)).toBe(ToolRisk.Medium);
    });

    it("treats a submit control as high when its form holds a secret field, and as medium when it holds none or the control doesn't submit", () => {
      const signIn: readonly NodeFacts[] = [node("INPUT", { type: "email" }), node("INPUT", { autocomplete: "current-password" })];
      expect(RiskClassifier.classifyClick(inForm(node("BUTTON")), signIn)).toBe(ToolRisk.High);
      expect(RiskClassifier.classifyClick(inForm(node("INPUT", { type: "submit" })), signIn)).toBe(ToolRisk.High);
      expect(RiskClassifier.classifyClick(inForm(node("BUTTON")), [node("INPUT", { type: "email" })])).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyClick(inForm(node("BUTTON", { type: "button" })), signIn)).toBe(ToolRisk.Medium);
    });

    it("treats a submit control tied to a form by its form attribute as medium", () => {
      expect(RiskClassifier.classifyClick(inBody(node("BUTTON", { form: "checkout" })), NO_FORM)).toBe(ToolRisk.Medium);
    });

    it("treats buttons that don't submit as medium", () => {
      expect(RiskClassifier.classifyClick(inForm(node("BUTTON", { type: "button" })), NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyClick(inForm(node("BUTTON", { type: "reset" })), NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyClick(inForm(node("INPUT", { type: "checkbox" })), NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyClick(inBody(node("BUTTON")), NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyClick(inBody(node("INPUT", { type: "submit" })), NO_FORM)).toBe(ToolRisk.Medium);
    });

    it("classifies the control around the clicked node", () => {
      expect(RiskClassifier.classifyClick(inForm(node("BUTTON"), node("SPAN")), NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyClick(inBody(node("A", { href: "https://other.test/" }), node("IMG")), NO_FORM)).toBe(ToolRisk.Medium);
    });

    it("treats a link within the page's origin as medium", () => {
      expect(RiskClassifier.classifyClick(inBody(node("A", { href: "/checkout" })), NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyClick(inBody(node("A", { href: "#top", target: "_self" })), NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyClick(inBody(node("AREA", { href: "item", target: "_top" })), NO_FORM)).toBe(ToolRisk.Medium);
    });

    it("treats a link that leaves, downloads or opens a window as medium", () => {
      expect(RiskClassifier.classifyClick(inBody(node("A", { href: "https://other.test/" })), NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyClick(inBody(node("A", { href: "http://shop.test/" })), NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyClick(inBody(node("A", { href: "/report.pdf", download: "" })), NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyClick(inBody(node("A", { href: "/help", target: "_blank" })), NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyClick(inBody(node("A", { href: "/help", target: "help" })), NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyClick(inBody(node("A", { href: "javascript:void(0)" })), NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyClick(inBody(node("A", { href: "https://[" })), NO_FORM)).toBe(ToolRisk.Medium);
    });
  });

  describe("classifyTyping", () => {
    it("asks every time when the field can't be read", () => {
      expect(RiskClassifier.classifyTyping(null, false, NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyTyping([], false, NO_FORM)).toBe(ToolRisk.Medium);
    });

    it("treats a secret field as high", () => {
      expect(RiskClassifier.classifyTyping(inForm(node("INPUT", { type: "password" })), false, NO_FORM)).toBe(ToolRisk.High);
      expect(RiskClassifier.classifyTyping(inBody(node("INPUT", { autocomplete: "one-time-code" })), false, NO_FORM)).toBe(ToolRisk.High);
    });

    it("treats submitting from a text field in a form as medium", () => {
      expect(RiskClassifier.classifyTyping(inForm(node("INPUT")), true, NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyTyping(inForm(node("INPUT", { type: "search" })), true, NO_FORM)).toBe(ToolRisk.Medium);
    });

    it("treats submitting from a text field of a form that holds a secret field as high, and typing into it alone as medium", () => {
      expect(RiskClassifier.classifyTyping(inForm(node("INPUT", { type: "email" })), true, [node("INPUT", { type: "password" })])).toBe(ToolRisk.High);
      expect(RiskClassifier.classifyTyping(inForm(node("INPUT", { type: "email" })), false, [node("INPUT", { type: "password" })])).toBe(ToolRisk.Medium);
    });

    it("treats other typing as medium", () => {
      expect(RiskClassifier.classifyTyping(inForm(node("INPUT")), false, NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyTyping(inBody(node("INPUT")), true, NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyTyping(inForm(node("TEXTAREA")), true, NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyTyping(inForm(node("INPUT", { type: "checkbox" })), true, NO_FORM)).toBe(ToolRisk.Medium);
    });
  });

  describe("classifyKey", () => {
    it("asks every time when the focused element can't be read", () => {
      expect(RiskClassifier.classifyKey("a", null, NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyKey("a", [], NO_FORM)).toBe(ToolRisk.Medium);
    });

    it("treats any key in a secret field as high", () => {
      expect(RiskClassifier.classifyKey("a", inForm(node("INPUT", { type: "password" })), NO_FORM)).toBe(ToolRisk.High);
      expect(RiskClassifier.classifyKey("Enter", inForm(node("INPUT", { autocomplete: "cc-number" })), NO_FORM)).toBe(ToolRisk.High);
    });

    it("treats Enter in a text field in a form as medium", () => {
      expect(RiskClassifier.classifyKey("Enter", inForm(node("INPUT", { type: "email" })), NO_FORM)).toBe(ToolRisk.Medium);
    });

    it("treats Enter in a text field, or Enter or Space on a submit control, of a form that holds a secret field as high, and other keys there as medium", () => {
      const signIn: readonly NodeFacts[] = [node("INPUT", { type: "password" })];
      expect(RiskClassifier.classifyKey("Enter", inForm(node("INPUT", { type: "email" })), signIn)).toBe(ToolRisk.High);
      expect(RiskClassifier.classifyKey(" ", inForm(node("BUTTON")), signIn)).toBe(ToolRisk.High);
      expect(RiskClassifier.classifyKey("Enter", inForm(node("BUTTON")), signIn)).toBe(ToolRisk.High);
      expect(RiskClassifier.classifyKey("a", inForm(node("INPUT", { type: "email" })), signIn)).toBe(ToolRisk.Medium);
    });

    it("classifies Enter or Space on a control as a click on it", () => {
      expect(RiskClassifier.classifyKey("Enter", inForm(node("BUTTON")), NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyKey(" ", inBody(node("A", { href: "https://other.test/" })), NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyKey("Enter", inBody(node("A", { href: "/next" })), NO_FORM)).toBe(ToolRisk.Medium);
    });

    it("treats other keys as medium", () => {
      expect(RiskClassifier.classifyKey("a", inForm(node("INPUT")), NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyKey("Tab", inForm(node("BUTTON")), NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyKey("Enter", inBody(node("INPUT")), NO_FORM)).toBe(ToolRisk.Medium);
      expect(RiskClassifier.classifyKey("Enter", BODY, NO_FORM)).toBe(ToolRisk.Medium);
    });
  });

  describe("isSecret", () => {
    it("knows password inputs and secret autocomplete tokens", () => {
      expect(RiskClassifier.isSecret(node("INPUT", { type: " PASSWORD " }))).toBe(true);
      for (const autocomplete of ["current-password", "new-password", "one-time-code", "cc-number", "billing cc-csc", "section-pay  CC-EXP"])
        expect(RiskClassifier.isSecret(node("INPUT", { autocomplete }))).toBe(true);
    });

    it("leaves ordinary fields alone", () => {
      expect(RiskClassifier.isSecret(node("INPUT"))).toBe(false);
      expect(RiskClassifier.isSecret(node("INPUT", { type: "text", autocomplete: "email" }))).toBe(false);
      expect(RiskClassifier.isSecret(node("DIV", { type: "password" }))).toBe(false);
      expect(RiskClassifier.isSecret(node("INPUT", { autocomplete: "occ-name" }))).toBe(false);
    });
  });

  describe("isSecretField", () => {
    it("knows a path that ends at a secret field, and nothing else", () => {
      expect([
        RiskClassifier.isSecretField(inForm(node("INPUT", { type: "password" }))),
        RiskClassifier.isSecretField(inForm(node("INPUT"))),
        RiskClassifier.isSecretField([]),
        RiskClassifier.isSecretField(null)
      ]).toEqual([true, false, false, false]);
    });
  });

  describe("submit controls", () => {
    it("needs a submitting control and a form", () => {
      const signIn: readonly NodeFacts[] = [node("INPUT", { type: "password" })];
      expect([
        RiskClassifier.classifyClick(inForm(node("BUTTON")), signIn),
        RiskClassifier.classifyClick(inBody(node("BUTTON")), signIn),
        RiskClassifier.classifyClick(inForm(node("A", { href: "/" })), signIn)
      ]).toEqual([ToolRisk.High, ToolRisk.Medium, ToolRisk.Medium]);
    });
  });
});
