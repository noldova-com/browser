/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElementFactsScript } from "@noldova/browser.protocol";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MissingPartError } from "../../fixtures/missing-part.error.ts";
import { PagePartsFixture } from "../../fixtures/page-parts.fixture.ts";

// The test harness sets its own attributes on the root element.
const HARNESS_ATTRIBUTES: unknown = expect.any(Array);

describe("ElementFactsScript", () => {
  let read: (element: Node) => unknown;
  let formOf: (element: Node, isForm?: unknown) => unknown;
  let root: HTMLElement;
  let title: string;

  beforeEach(() => {
    const made: unknown = new Function(`return (${ElementFactsScript.functionDeclaration});`)();
    if (!Object.isFunction(made))
      throw new MissingPartError("function in the script's declaration");
    read = (element: Node): unknown => made.call(element, false);
    formOf = (element: Node, isForm: unknown = true): unknown => made.call(element, isForm);
    title = document.title;
    root = document.createElement("div");
    document.body.append(root);
  });

  afterEach(() => {
    root.remove();
    document.title = title;
  });

  it("reads the element's path from the document, root first, with each element's attributes as name and value in turn", () => {
    root.innerHTML = "<form id=\"checkout\" class=\"Wide\"><button type=\"submit\">Pay</button></form>";
    const button: Element = PagePartsFixture.find(root, "button");

    expect(read(button)).toMatchObject({ path: [["#document", []], ["HTML", HARNESS_ATTRIBUTES], ["BODY", []], ["DIV", []], ["FORM", ["id", "checkout", "class", "Wide"]], ["BUTTON", ["type", "submit"]]] });
  });

  it("goes up through open and closed shadow roots to their hosts", () => {
    const outer: HTMLElement = document.createElement("section");
    root.append(outer);
    const open: ShadowRoot = outer.attachShadow({ mode: "open" });
    const inner: HTMLElement = document.createElement("span");
    open.append(inner);
    const closed: ShadowRoot = inner.attachShadow({ mode: "closed" });
    closed.innerHTML = "<a href=\"/plans\">Plans</a>";
    const link: Element = PagePartsFixture.find(closed, "a");

    expect(read(link)).toMatchObject({ path: [["#document", []], ["HTML", HARNESS_ATTRIBUTES], ["BODY", []], ["DIV", []], ["SECTION", []], ["#document-fragment", []], ["SPAN", []], ["#document-fragment", []],
      ["A", ["href", "/plans"]]] });
  });

  it("gives no path, linked elements or form name for an element outside the document, and still the page's title and base URL", () => {
    document.title = "Plans";
    const loose: HTMLElement = document.createElement("form");
    loose.innerHTML = "<button>Pay</button>";
    const button: Element = PagePartsFixture.find(loose, "button");

    expect(read(button)).toEqual({ path: null, linked: [], formName: "", title: "Plans", baseUrl: document.baseURI });
  });

  it("gives the element's form as the element itself: the nearest form above it, even from inside a closed shadow root, or the form its form attribute names", () => {
    root.innerHTML = "<form id=\"checkout\"><div id=\"host\"></div></form><form id=\"sign-in\"></form><button id=\"named\" form=\"sign-in\">Go</button>"
      + "<button id=\"missing\" form=\"missing\">Lost</button><a href=\"/\">Home</a>";
    const checkout: Element = PagePartsFixture.find(root, "#checkout");
    const signIn: Element = PagePartsFixture.find(root, "#sign-in");
    const named: Element = PagePartsFixture.find(root, "#named");
    const missing: Element = PagePartsFixture.find(root, "#missing");
    const link: Element = PagePartsFixture.find(root, "a");
    const closed: ShadowRoot = PagePartsFixture.find(root, "#host").attachShadow({ mode: "closed" });
    closed.innerHTML = "<button>Pay</button>";
    const pay: Element = PagePartsFixture.find(closed, "button");

    expect(formOf(pay)).toBe(checkout);
    expect(formOf(named)).toBe(signIn);
    expect([formOf(missing), formOf(link), formOf(document.createElement("button")), formOf(pay, "yes")]).toEqual([null, null, null, null]);
  });

  it("takes the form a form attribute names in the element's own tree, and lists only that tree's elements naming it, when another tree has a form of the same id", () => {
    root.innerHTML = "<form id=\"checkout\"><button>Pay</button></form><div id=\"host\"></div>";
    const outer: Element = PagePartsFixture.find(root, "form");
    const pay: Element = PagePartsFixture.find(root, "button");
    const shadow: ShadowRoot = PagePartsFixture.find(root, "#host").attachShadow({ mode: "open" });
    shadow.innerHTML = "<form id=\"checkout\"></form><button form=\"checkout\">Go</button><a form=\"checkout\" href=\"/\">Home</a>";
    const inner: Element = PagePartsFixture.find(shadow, "form");
    const go: Element = PagePartsFixture.find(shadow, "button");
    const home: Element = PagePartsFixture.find(shadow, "a");

    expect([formOf(go) === inner, formOf(home) === inner, formOf(pay) === outer]).toEqual([true, true, true]);
    expect(read(pay)).toMatchObject({ linked: [] });
  });

  it("gives a link whose form attribute names an element other than a form, or an id nothing holds, no form and no linked elements", () => {
    root.innerHTML = "<div id=\"panel\"></div><a id=\"other\" form=\"panel\" href=\"/\">Panel</a><a id=\"lost\" form=\"missing\" href=\"/\">Lost</a>";
    const other: Element = PagePartsFixture.find(root, "#other");
    const lost: Element = PagePartsFixture.find(root, "#lost");

    expect([formOf(other), formOf(lost)]).toEqual([null, null]);
    expect([read(other), read(lost)]).toMatchObject([{ linked: [] }, { linked: [] }]);
  });

  it("lists the elements that name the element's form by its id, never a field's typed value", () => {
    root.innerHTML = "<form id=\"checkout\"><button>Pay</button></form><input form=\"checkout\" type=\"password\" name=\"pin\" value=\"preset\"><input form=\"elsewhere\">";
    const button: Element = PagePartsFixture.find(root, "button");
    const pin: HTMLInputElement = PagePartsFixture.find<HTMLInputElement>(root, "input");
    pin.value = "typed";

    expect(read(button)).toMatchObject({ linked: [["INPUT", ["form", "checkout", "type", "password", "name", "pin", "value", "preset"]]] });
  });

  it("reads a form's name from the elements that label it, in order, then its label, then its title, on one line, and none outside a form", () => {
    root.innerHTML = "<h2 id=\"heading\">Create your <em>Team</em>\n account</h2><p id=\"note\">today</p><form><button>Join</button></form><a href=\"/\">Home</a>";
    const form: Element = PagePartsFixture.find(root, "form");
    const button: Element = PagePartsFixture.find(root, "button");
    const link: Element = PagePartsFixture.find(root, "a");
    const named: (attributes: ReadonlyMap<string, string>) => unknown = (attributes: ReadonlyMap<string, string>): unknown => {
      for (const name of ["aria-labelledby", "aria-label", "title"])
        form.removeAttribute(name);
      attributes.forEach((value, name) => form.setAttribute(name, value));
      return read(button);
    };

    expect([
      named(new Map<string, string>().set("aria-labelledby", " heading  note ").set("aria-label", "Sign up").set("title", "Join")),
      named(new Map<string, string>().set("aria-labelledby", "missing").set("aria-label", " Sign\nup ").set("title", "Join")),
      named(new Map<string, string>().set("aria-label", " ").set("title", "Join")),
      named(new Map<string, string>()),
      read(link)
    ]).toMatchObject(["Create your Team account today", "Sign up", "Join", "", ""].map(formName => ({ formName })));
  });

  it("reads the page's title from its first HTML title element on one line, never an SVG title, and the document's base URL", () => {
    document.title = " Plans\n and pricing ";
    root.innerHTML = "<svg><title>Chart</title></svg><button>Go</button>";
    const button: Element = PagePartsFixture.find(root, "button");

    expect(read(button)).toMatchObject({ title: "Plans and pricing", baseUrl: document.baseURI });
  });
});
