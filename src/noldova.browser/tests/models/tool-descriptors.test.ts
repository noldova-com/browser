/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BrowserToolNames } from "@noldova/browser.protocol";
import { type IToolDescriptor, ToolDescriptor, ToolRisk } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { NodeFacts } from "../../src/models/node-facts.ts";
import { ToolDescriptors } from "../../src/models/tool-descriptors.ts";
import { RiskClassifier } from "../../src/services/risk-classifier.ts";

const LEVELS: readonly ToolRisk[] = [ToolRisk.Low, ToolRisk.Medium, ToolRisk.High];

function node(nodeName: string, attributes: Record<string, string> = {}): NodeFacts {
  return new NodeFacts(nodeName, new Map(Object.entries(attributes)));
}

function paths(): readonly (readonly NodeFacts[] | null)[] {
  const body: readonly NodeFacts[] = [node("#DOCUMENT"), node("HTML"), node("BODY")];
  const form: readonly NodeFacts[] = [...body, node("FORM")];
  return [
    null,
    [],
    [...body, node("DIV")],
    [...form, node("BUTTON")],
    [...form, node("INPUT", { type: "text" })],
    [...body, node("A", { href: "https://elsewhere.test/" })],
    [...body, node("A", { href: "/file", download: "" })],
    [...form, node("INPUT", { type: "password" })],
    [...form, node("INPUT", { autocomplete: "cc-number" })]
  ];
}

function byName(name: string): IToolDescriptor | undefined {
  return ToolDescriptors.all.find(t => t.name === name);
}

describe("ToolDescriptors", () => {
  it("describes the eight tools, in the protocol's order", () => {
    expect(ToolDescriptors.all.map(t => t.name)).toEqual([
      "browser_navigate",
      "browser_snapshot",
      "browser_click",
      "browser_type",
      "browser_press_key",
      "browser_screenshot",
      "browser_console",
      "browser_wait_for"
    ]);
  });

  it("marks the four acting tools non-resumable and the four reading ones read-only", () => {
    const acting: readonly string[] = ["browser_navigate", "browser_click", "browser_type", "browser_press_key"];
    for (const descriptor of ToolDescriptors.all) {
      expect(descriptor.isResumable).toBe(!acting.includes(descriptor.name));
      expect(descriptor.marksSending).toBe(acting.includes(descriptor.name));
      expect(descriptor.hints?.isReadOnly).toBe(!acting.includes(descriptor.name));
      expect(descriptor.hints?.isOpenWorld).toBe(true);
      expect(descriptor.title).not.toBe("");
      expect(descriptor.description).not.toBe("");
    }
  });

  it("closes every input schema to unknown arguments", () => {
    for (const descriptor of ToolDescriptors.all) {
      expect(descriptor.inputSchema["type"]).toBe("object");
      expect(descriptor.inputSchema["additionalProperties"]).toBe(false);
    }
  });

  it("gives every tool one output schema: the page always, and the element with no field for a value or typed text", () => {
    for (const descriptor of ToolDescriptors.all)
      expect(descriptor.outputSchema).toBe(ToolDescriptors.navigate.outputSchema);
    expect(ToolDescriptors.navigate.outputSchema).toEqual({
      type: "object",
      properties: {
        page: { type: "object", properties: { url: { type: "string", maxLength: 2_048 }, title: { type: "string", maxLength: 1_024 } }, required: ["url", "title"],
          additionalProperties: false },
        element: { type: "object", properties: { role: { type: "string", maxLength: 1_024 }, name: { type: "string", maxLength: 1_024 }, isSecret: { type: "boolean" } },
          required: ["role", "name", "isSecret"], additionalProperties: false }
      },
      required: ["page"],
      additionalProperties: false
    });
  });

  it("keeps every schema within Noldova Desktop's subset, and names the exactly-one groups the tools check in code", () => {
    for (const descriptor of ToolDescriptors.all)
      expect(JSON.stringify([descriptor.inputSchema, descriptor.outputSchema])).not.toMatch(/"(?:oneOf|format|uniqueItems)"/);
    expect(ToolDescriptors.navigateChoices).toEqual(["url", "action"]);
    expect(ToolDescriptors.waitForChoices).toEqual(["text", "reference", "load"]);
  });

  it("gives every tool a default that is the lowest classification of its calls, and a maximum that none exceeds", () => {
    const reached: Map<string, ToolRisk[]> = new Map([["browser_click", []], ["browser_type", []], ["browser_press_key", []]]);
    const forms: readonly (readonly NodeFacts[])[] = [[], [new NodeFacts("INPUT", new Map([["type", "password"]]))]];
    for (const path of paths()) {
      for (const form of forms) {
        reached.get("browser_click")?.push(RiskClassifier.classifyClick(path, form));
        for (const isSubmitting of [false, true])
          reached.get("browser_type")?.push(RiskClassifier.classifyTyping(path, isSubmitting, form));
        for (const key of ["a", "Enter", " ", "Tab"])
          reached.get("browser_press_key")?.push(RiskClassifier.classifyKey(key, path, form));
      }
    }

    for (const descriptor of ToolDescriptors.all)
      for (const level of reached.get(descriptor.name) ?? [])
        expect(LEVELS.indexOf(level), descriptor.name).toBeLessThanOrEqual(LEVELS.indexOf(descriptor.risk.maximum));
    expect(ToolDescriptors.all.map(t => t.risk.default)).toEqual([ToolRisk.Low, ToolRisk.Low, ToolRisk.Medium, ToolRisk.Medium, ToolRisk.Medium, ToolRisk.Low, ToolRisk.Low, ToolRisk.Low]);
    expect(ToolDescriptors.all.map(t => t.risk.maximum)).toEqual([ToolRisk.Medium, ToolRisk.Low, ToolRisk.High, ToolRisk.High, ToolRisk.High, ToolRisk.Low, ToolRisk.Low, ToolRisk.Low]);
    for (const name of reached.keys())
      expect(new Set(reached.get(name)), name).toEqual(new Set([ToolRisk.Medium, ToolRisk.High]));
  });

  it("bounds the inputs by the module's limits", () => {
    expect(byName("browser_navigate")?.inputSchema["properties"]).toMatchObject({ url: { maxLength: 32768 } });
    expect(byName("browser_type")?.inputSchema["properties"]).toMatchObject({ text: { maxLength: 10000 } });
    expect(byName("browser_wait_for")?.inputSchema).toMatchObject({
      properties: { timeoutMilliseconds: { minimum: 1, maximum: 30000 } },
      required: ["timeoutMilliseconds"]
    });
    expect(byName("browser_click")?.inputSchema["required"]).toEqual(["reference"]);
    expect(byName("browser_type")?.inputSchema["required"]).toEqual(["reference", "text"]);
    expect(byName("browser_press_key")?.inputSchema["required"]).toEqual(["key"]);
  });

  it("passes Noldova Desktop's descriptor checks, against the tools module.json declares", () => {
    for (const descriptor of ToolDescriptors.all)
      expect(new ToolDescriptor(descriptor, BrowserToolNames.all).name).toBe(descriptor.name);
  });

  it("names the snapshot as where an acting tool's agent sees the page after an uncertain outcome, and gives each a deadline", () => {
    for (const descriptor of ToolDescriptors.all) {
      expect(descriptor.nextTool, descriptor.name).toBe(descriptor.isResumable === true ? undefined : "browser_snapshot");
      expect(descriptor.deadline.default, descriptor.name).toBeLessThanOrEqual(descriptor.deadline.maximum);
      expect(descriptor.deadline.maximum, descriptor.name).toBeLessThanOrEqual(120_000);
    }
    expect(byName("browser_wait_for")?.deadline.default).toBeGreaterThan(30_000);
  });
});
