/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { LinkPlace } from "@noldova/desktop.window";
import { LinkGesture } from "@noldova/ui.components.angular";
import { beforeEach, describe, expect, it } from "vitest";

import { LinkPlaces } from "../../../src/app/services/link-places.ts";
import { WindowContext } from "../../fixtures/window-context.fixture.ts";

describe("LinkPlaces", () => {
  const ADDRESS = "https://docs.example.com/a";
  const gestures: readonly LinkGesture[] = [LinkGesture.Plain, LinkGesture.Modified, LinkGesture.Middle];
  let context: WindowContext;
  let places: LinkPlaces;

  function placesOf(url: string = ADDRESS): LinkPlace[] {
    return gestures.map(t => places.placeFor(url, t));
  }

  beforeEach(() => {
    context = new WindowContext();
    places = new LinkPlaces(context);
  });

  it("opens a click here and Ctrl/Cmd or a middle click in the system's browser by default", () => {
    expect(placesOf()).toEqual([LinkPlace.InApp, LinkPlace.System, LinkPlace.System]);
  });

  it("opens a click where the click setting says, Ctrl/Cmd in the other place, and a middle click like Ctrl/Cmd", () => {
    context.settings.set("browser.linkClick", "System");
    const system = placesOf();
    context.settings.set("browser.linkClick", "InApp");

    expect([system, placesOf()]).toEqual([[LinkPlace.System, LinkPlace.InApp, LinkPlace.InApp], [LinkPlace.InApp, LinkPlace.System, LinkPlace.System]]);
  });

  it("opens a middle click like a click when its setting says so, in either place", () => {
    context.settings.set("browser.linkMiddleClick", "Plain");
    const inApp = placesOf();
    context.settings.set("browser.linkClick", "System");

    expect([inApp, placesOf()]).toEqual([[LinkPlace.InApp, LinkPlace.System, LinkPlace.InApp], [LinkPlace.System, LinkPlace.InApp, LinkPlace.System]]);
  });

  it("reads a value the settings don't offer as the default", () => {
    context.settings.set("browser.linkClick", "Elsewhere");
    context.settings.set("browser.linkMiddleClick", 2);

    expect(placesOf()).toEqual([LinkPlace.InApp, LinkPlace.System, LinkPlace.System]);
  });

  it("opens every gesture on a listed site, or a subdomain of one, in the system's browser, whatever the other settings say", () => {
    context.settings.set("browser.linkClick", "System");
    context.settings.set("browser.systemSites", "code.example, *.example.com");

    expect([placesOf("https://api.code.example/x"), placesOf(ADDRESS), placesOf("https://evilcode.example/")]).toEqual([
      [LinkPlace.System, LinkPlace.System, LinkPlace.System], [LinkPlace.System, LinkPlace.System, LinkPlace.System],
      [LinkPlace.System, LinkPlace.InApp, LinkPlace.InApp]
    ]);
  });

  it("follows a change to the site list, and reads a value that isn't text as no sites", () => {
    context.settings.set("browser.systemSites", "example.com");
    const listed = places.placeFor(ADDRESS, LinkGesture.Plain);
    context.settings.set("browser.systemSites", "");
    const cleared = places.placeFor(ADDRESS, LinkGesture.Plain);
    context.settings.set("browser.systemSites", ["example.com"]);

    expect([listed, cleared, places.placeFor(ADDRESS, LinkGesture.Plain)]).toEqual([LinkPlace.System, LinkPlace.InApp, LinkPlace.InApp]);
  });

  it("logs the places of the entries it ignores, never their text, once for each change of the list, and nothing for a list without any", () => {
    context.settings.set("browser.systemSites", "code.example, code example, 1.2.3.256");
    placesOf();
    placesOf();
    context.settings.set("browser.systemSites", "code.example");
    placesOf();

    expect(context.logs).toEqual(["The sites that always open in the system's browser ignore the entries that aren't hosts, at 2, 3 in the list."]);
  });
});
