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
    ]).toEqual(["Click \"Choose Team\" on docs.example.com", "Submit the form \"Create your Team account\" on docs.example.com"]);
  });

  it("titles typing by the field, and typing that submits its form by the form", () => {
    const field: NodeFacts = node("INPUT", [["type", "text"]]);
    const shown: ShownElement = new ShownElement("textbox", "Team name", false);

    expect([
      PermissionCards.typeTitle(facts([FORM, field]), shown, false, "https://docs.example.com"),
      PermissionCards.typeTitle(facts([field]), shown, true, "https://docs.example.com"),
      PermissionCards.typeTitle(facts([FORM, field], [FORM, field], "Sign up"), shown, true, "https://docs.example.com")
    ]).toEqual(["Type into the Team name field on docs.example.com", "Type into the Team name field on docs.example.com", "Submit the form \"Sign up\" on docs.example.com"]);
  });

  it("titles a key by its chord and the site's host, and an Enter that submits its form by the form", () => {
    const field: NodeFacts = node("INPUT", [["type", "text"]]);

    expect([
      PermissionCards.keyTitle(null, "Enter", "Enter", "https://docs.example.com"),
      PermissionCards.keyTitle(facts([FORM, field]), "a", "Control+a", "https://docs.example.com"),
      PermissionCards.keyTitle(facts([FORM, field], [FORM, field], "Search"), "Enter", "Enter", "https://docs.example.com")
    ]).toEqual(["Press Enter on docs.example.com", "Press Control+a on docs.example.com", "Submit the form \"Search\" on docs.example.com"]);
  });

  it("says the page by its URL first, then its title on one line, or its URL alone when it has no title", () => {
    expect([PermissionCards.page("https://docs.example.com/", "Plans\n and pricing"), PermissionCards.page("https://docs.example.com/", " ")]).toEqual([
      { label: "Page", kind: PermissionDetailKind.Text, value: "https://docs.example.com/, \"Plans and pricing\"" },
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

  it("cuts a long element name at 80 characters, so the title still names the host, and a long form name the same way", () => {
    const name: string = "Pay ".repeat(60);
    const submit: NodeFacts = node("BUTTON", [["type", "submit"]]);
    const click: string = PermissionCards.clickTitle(facts([node("BUTTON")]), new ShownElement("button", name, false), "https://docs.example.com");
    const form: string = PermissionCards.clickTitle(facts([FORM, submit], [FORM, submit], name), new ShownElement("button", "Pay", false), "https://docs.example.com");

    expect([click, form]).toEqual([`Click "${"Pay ".repeat(19)}Pay…" on docs.example.com`, `Submit the form "${"Pay ".repeat(19)}Pay…" on docs.example.com`]);
    expect(PermissionCards.element(facts([node("BUTTON")]), new ShownElement("button", name, false))[0]?.value).toBe(`"${"Pay ".repeat(19)}Pay…", button`);
  });

  it("cuts a host too long for the title from its start, so its end, the site's own domain, still shows", () => {
    const host: string = `bank.example.com.${"a".repeat(210)}.evil.example`;
    const title: string = PermissionCards.clickTitle(facts([node("BUTTON")]), new ShownElement("button", "Pay", false), `https://${host}`);

    expect([host.length, title]).toEqual([240, `Click "Pay" on …${"a".repeat(86)}.evil.example`]);
    expect(title).not.toContain("bank.example.com");
  });

  it("cuts a name never inside a character", () => {
    const title: string = PermissionCards.clickTitle(facts([node("BUTTON")]), new ShownElement("button", "\u{1F600}".repeat(41), false), "https://docs.example.com");

    expect(title).toBe(`Click "${"\u{1F600}".repeat(39)}…" on docs.example.com`);
  });

  it("cuts a long page title at 300 characters after the URL, so the URL shows whole", () => {
    const value: string | undefined = PermissionCards.page("https://docs.example.com/", "Title ".repeat(100)).value;

    expect(value).toBe(`https://docs.example.com/, "${"Title ".repeat(49)}Title…"`);
  });

  it("takes out the format characters page text may hide its direction or words with, from names, titles and field names", () => {
    const name: string = "Pay‮​moc.liame‬";
    const form: readonly NodeFacts[] = [FORM, node("INPUT", [["type", "text"], ["name", "co­upon"]])];

    expect([
      PermissionCards.clickTitle(facts([node("BUTTON")]), new ShownElement("button", name, false), "https://docs.example.com"),
      PermissionCards.element(facts([node("BUTTON")]), new ShownElement("button", name, false))[0]?.value,
      PermissionCards.page("https://docs.example.com/", "⁧Cart⁩").value,
      PermissionCards.sends(facts(null, form))[0]?.value
    ]).toEqual(["Click \"Paymoc.liame\" on docs.example.com", "\"Paymoc.liame\", button", "https://docs.example.com/, \"Cart\"", "coupon"]);
  });

  it("cuts a detail over its limit with an ellipsis, so it ends at the limit", () => {
    const from: string | undefined = PermissionCards.move(`https://docs.example.com/${"a".repeat(3000)}`, "https://docs.example.com/")[0]?.value;

    expect([from?.length, from?.endsWith("a…")]).toEqual([2000, true]);
  });
});
