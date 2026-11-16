/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PermissionDetailKind } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { ElementFacts } from "../../src/models/element-facts.ts";
import { NodeFacts } from "../../src/models/node-facts.ts";
import { PageFacts } from "../../src/models/page-facts.ts";
import { ShownElement } from "../../src/models/shown-element.ts";
import { PermissionCards } from "../../src/services/permission-cards.ts";

const PAGE: PageFacts = new PageFacts("https://docs.example.com/cart/", "Cart");
const FORM: NodeFacts = new NodeFacts("FORM", new Map());

function node(name: string, attributes: readonly [string, string][] = []): NodeFacts {
  return new NodeFacts(name, new Map(attributes));
}

function facts(path: readonly NodeFacts[] | null, form: readonly NodeFacts[] = [], formName: string = ""): ElementFacts {
  return new ElementFacts(path, form, formName, PAGE);
}

describe("PermissionCards", () => {
  it("titles a click by the element's name on one line and the site's host, and a click that submits by its form", () => {
    const submit: NodeFacts = node("BUTTON", [["type", "submit"]]);

    expect([
      PermissionCards.clickTitle(facts([node("BUTTON", [["type", "button"]])]), new ShownElement("button", "Choose\n  Team", false), "https://docs.example.com"),
      PermissionCards.clickTitle(facts([FORM, submit], [FORM, submit], "Create your\nTeam account"), new ShownElement("button", "Create", false), "https://docs.example.com")
    ]).toEqual(["Click \"Choose Team\" on docs.example.com", "Submit the form \"Create your Team account\""]);
  });

  it("titles typing by the field, and typing that submits its form by the form", () => {
    const field: NodeFacts = node("INPUT", [["type", "text"]]);
    const shown: ShownElement = new ShownElement("textbox", "Team name", false);

    expect([
      PermissionCards.typeTitle(facts([FORM, field]), shown, false, "https://docs.example.com"),
      PermissionCards.typeTitle(facts([field]), shown, true, "https://docs.example.com"),
      PermissionCards.typeTitle(facts([FORM, field], [FORM, field], "Sign up"), shown, true, "https://docs.example.com")
    ]).toEqual(["Type into the Team name field on docs.example.com", "Type into the Team name field on docs.example.com", "Submit the form \"Sign up\""]);
  });

  it("titles a key by its chord and the site's host, and an Enter that submits its form by the form", () => {
    const field: NodeFacts = node("INPUT", [["type", "text"]]);

    expect([
      PermissionCards.keyTitle(null, "Enter", "Enter", "https://docs.example.com"),
      PermissionCards.keyTitle(facts([FORM, field]), "a", "Control+a", "https://docs.example.com"),
      PermissionCards.keyTitle(facts([FORM, field], [FORM, field], "Search"), "Enter", "Enter", "https://docs.example.com")
    ]).toEqual(["Press Enter on docs.example.com", "Press Control+a on docs.example.com", "Submit the form \"Search\""]);
  });

  it("says the page by its title on one line and its URL, or its URL alone when it has no title", () => {
    expect([PermissionCards.page("https://docs.example.com/", "Plans\n and pricing"), PermissionCards.page("https://docs.example.com/", " ")]).toEqual([
      { label: "Page", kind: PermissionDetailKind.Text, value: "\"Plans and pricing\", https://docs.example.com/" },
      { label: "Page", kind: PermissionDetailKind.Text, value: "https://docs.example.com/" }
    ]);
  });

  it("names a button, a link, a field and any other element by their name and kind, or by their kind alone, and a link's destination against the page's base address", () => {
    expect([
      PermissionCards.element(facts([node("BUTTON")]), new ShownElement("button", "Choose Team", false)),
      PermissionCards.element(facts([node("A", [["href", "../checkout?step=1"]])]), new ShownElement("link", "Checkout", false)),
      PermissionCards.element(facts([node("A", [["href", "https://[broken"]])]), new ShownElement("link", "", false)),
      PermissionCards.element(facts([node("INPUT", [["type", "password"]])]), new ShownElement("textbox", "Password", true)),
      PermissionCards.element(facts([node("INPUT", [["type", "checkbox"]])]), new ShownElement("checkbox", "Accept", false)),
      PermissionCards.element(facts([node("DIV")]), new ShownElement("generic", "", false))
    ]).toEqual([
      [{ label: "Button", kind: PermissionDetailKind.Text, value: "\"Choose Team\", button" }],
      [{ label: "Link", kind: PermissionDetailKind.Text, value: "\"Checkout\", link" },
        { label: "Goes to", kind: PermissionDetailKind.Text, value: "https://docs.example.com/checkout?step=1" }],
      [{ label: "Link", kind: PermissionDetailKind.Text, value: "link" }],
      [{ label: "Field", kind: PermissionDetailKind.Text, value: "\"Password\", textbox" }],
      [{ label: "Element", kind: PermissionDetailKind.Text, value: "\"Accept\", checkbox" }],
      [{ label: "Element", kind: PermissionDetailKind.Text, value: "element" }]
    ]);
  });

  it("says the element can't be read when its path is unknown or empty", () => {
    const unknown: readonly unknown[] = [{ label: "Element", kind: PermissionDetailKind.Text, value: "An element the browser can't read, such as one in another site's frame" }];
    const shown: ShownElement = new ShownElement("button", "Pay", false);

    expect([PermissionCards.element(facts(null), shown), PermissionCards.element(facts([]), shown)]).toEqual([unknown, unknown]);
  });

  it("shows typed text as the agent's words, or only its length in characters when it is hidden", () => {
    expect([PermissionCards.typed("red shoes", false), PermissionCards.typed("pässwörd😀", true)]).toEqual([
      { label: "Text", kind: PermissionDetailKind.AgentText, value: "red shoes" },
      { label: "Text", kind: PermissionDetailKind.Text, value: "9 characters, hidden" }
    ]);
  });

  it("lists the names of the fields a form sends, leaving out its buttons and unnamed fields, or says it sends none", () => {
    const form: readonly NodeFacts[] = [FORM, node("INPUT", [["type", "email"], ["name", "email"]]), node("INPUT", [["type", "text"]]),
      node("SELECT", [["name", "plan"]]), node("TEXTAREA", [["name", "note"]]), node("INPUT", [["type", " Submit "], ["name", "go"]]),
      node("BUTTON", [["name", "send"]]), node("INPUT", [["type", "hidden"], ["name", "token"]])];

    expect([PermissionCards.sends(facts(null, form)), PermissionCards.sends(facts(null, [FORM, node("BUTTON")]))]).toEqual([
      [{ label: "Sends", kind: PermissionDetailKind.Text, value: "email, plan, note, token" }],
      [{ label: "Sends", kind: PermissionDetailKind.Text, value: "No named fields" }]
    ]);
  });

  it("says where a navigation goes from and to", () => {
    expect(PermissionCards.move("https://docs.example.com/", "https://status.example.net/")).toEqual([
      { label: "From", kind: PermissionDetailKind.Text, value: "https://docs.example.com/" },
      { label: "To", kind: PermissionDetailKind.Text, value: "https://status.example.net/" }
    ]);
  });

  it("cuts a detail over its limit with an ellipsis, so it ends at the limit", () => {
    const from: string | undefined = PermissionCards.move(`https://docs.example.com/${"a".repeat(3000)}`, "https://docs.example.com/")[0]?.value;

    expect([from?.length, from?.endsWith("a…")]).toEqual([2000, true]);
  });
});
