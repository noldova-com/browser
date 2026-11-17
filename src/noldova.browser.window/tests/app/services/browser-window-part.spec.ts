/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { JsonObject } from "@noldova/context.json";
import { BrowserEvents, BrowserMethods } from "@noldova/browser.protocol";
import { ContentPadding, LinkPlace } from "@noldova/desktop.window";
import { LinkGesture } from "@noldova/ui.components.angular";
import { describe, expect, it } from "vitest";

import { PageComponent } from "../../../src/app/components/page/page.component.ts";
import { PaneState } from "../../../src/app/enums/pane-state.ts";
import { OpenPageArgumentsInvalidException } from "../../../src/app/exceptions/open-page-arguments-invalid.exception.ts";
import { PagesInactiveException } from "../../../src/app/exceptions/pages-inactive.exception.ts";
import { BrowserWindowPart } from "../../../src/app/services/browser-window-part.ts";
import { Pages } from "../../../src/app/services/pages.ts";
import { WindowContext } from "../../fixtures/window-context.fixture.ts";

describe("BrowserWindowPart", () => {
  it("is the browser module's part, and has nothing to continue before it activates", async () => {
    const part: BrowserWindowPart = new BrowserWindowPart();

    expect(part.moduleId).toBe("browser");
    expect(await part.reconnectAsync()).toBe(false);
  });

  it("registers the page document, edge to edge with its tab row's place, and the pages of its context, and continues when the runtime starts again", async () => {
    const part: BrowserWindowPart = new BrowserWindowPart();
    const context: WindowContext = new WindowContext();

    await part.activateAsync(context);

    expect(context.documents.map(t => [t.name, t.padding, t.tabRowPlace])).toEqual([["browser.page", ContentPadding.None, "browser.pageTabRow"]]);
    expect(await context.documents[0]?.loadComponent()).toBe(PageComponent);
    expect(Pages.of(context)).toBeInstanceOf(Pages);
    expect(await part.reconnectAsync()).toBe(true);
  });

  it("shows each page's calls as the runtime answers them when it starts again, and none of the run that ended", async () => {
    const part: BrowserWindowPart = new BrowserWindowPart();
    const context: WindowContext = new WindowContext();
    await part.activateAsync(context);
    const acting: JsonObject = { instance: "page-1", activity: "call-1", agentName: "Scout", action: "Clicking", state: "Acting", box: null, point: null, refusal: null, isHandedOver: false };
    context.emit(BrowserEvents.pageActivity, acting);
    const answer = context.answerRequest;
    context.answerRequest = (method, parameters) => method === BrowserMethods.readActivities
      ? Promise.resolve([{ ...acting, instance: "page-2", activity: "call-2" }]) : answer(method, parameters);

    expect(await part.reconnectAsync()).toBe(true);

    expect([...Pages.of(context).activities().keys()]).toEqual(["page-2"]);
  });

  it("asks to be rebuilt when the runtime starts again but the window can't tell it its open pages or read the pages' calls again", async () => {
    const part: BrowserWindowPart = new BrowserWindowPart();
    const context: WindowContext = new WindowContext();
    await part.activateAsync(context);
    context.openDocuments = ["0f8fad5b-d9cb-469f-a165-70867728950e"];
    const answer = context.answerRequest;
    context.answerRequest = (method, parameters) => method === BrowserMethods.holdPages ? Promise.reject(new TypeError("The runtime part went away.")) : answer(method, parameters);
    const unreported: boolean = await part.reconnectAsync();
    context.answerRequest = (method, parameters) => method === BrowserMethods.readActivities ? Promise.resolve(null) : answer(method, parameters);

    expect([unreported, await part.reconnectAsync()]).toEqual([false, false]);
  });

  it("checks browser.systemSites, refusing a list with an entry that isn't a host by naming it, and saving hosts and addresses read as their hosts", async () => {
    const context: WindowContext = new WindowContext();
    await new BrowserWindowPart().activateAsync(context);
    const check = context.settingChecks.get("browser.systemSites");

    expect([...context.settingChecks.keys()]).toEqual(["browser.systemSites", "browser.localSites"]);
    expect([check?.(""), check?.("code.example, *.example.org"), check?.("https://example.com, http://code.example/team")]).toEqual([null, null, null]);
    expect(check?.("code.example, code example")).toBe("\"code example\" isn't a host. Enter hosts separated by commas, such as example.com.");
    expect(check?.("https://, code.example, 1.2.3.256")).toBe("\"https://\", \"1.2.3.256\" aren't hosts. Enter hosts separated by commas, such as example.com.");
  });

  it("checks browser.localSites, refusing by name an entry the runtime part leaves out, and saving exact local http: and https: origins", async () => {
    const context: WindowContext = new WindowContext();
    await new BrowserWindowPart().activateAsync(context);
    const check = context.settingChecks.get("browser.localSites");

    expect([check?.(""), check?.("http://127.0.0.1:4173, https://192.168.1.20:8443/, HTTP://LOCALHOST:3000, http://[::1]:5000")]).toEqual([null, null]);
    expect(check?.("http://127.0.0.1:4173/form")).toBe("\"http://127.0.0.1:4173/form\" isn't a site's address on this computer or network. Enter addresses with no path, as localhost or an IP address, separated by commas, such as http://127.0.0.1:4173; for a server on 0.0.0.0, enter 127.0.0.1.");
    expect(check?.("127.0.0.1:4173, http://127.0.0.1:4173, http://user:secret@127.0.0.1, ftp://127.0.0.1"))
      .toBe("\"127.0.0.1:4173\", \"http://user:secret@127.0.0.1\", \"ftp://127.0.0.1\" aren't sites' addresses on this computer or network. Enter addresses with no path, as localhost or an IP address, separated by commas, such as http://127.0.0.1:4173; for a server on 0.0.0.0, enter 127.0.0.1.");
    expect(check?.("http://0.0.0.0:3000, http://[::]:3000, http://[fe80::1]:3000, http://169.254.1.1, http://server.local:5000, https://example.com, http://*.localhost:3000, http://127.0.0.1..:4173, http://localhost..:4173"))
      .toBe("\"http://0.0.0.0:3000\", \"http://[::]:3000\", \"http://[fe80::1]:3000\", \"http://169.254.1.1\", \"http://server.local:5000\", \"https://example.com\", \"http://*.localhost:3000\", \"http://127.0.0.1..:4173\", \"http://localhost..:4173\" aren't sites' addresses on this computer or network. Enter addresses with no path, as localhost or an IP address, separated by commas, such as http://127.0.0.1:4173; for a server on 0.0.0.0, enter 127.0.0.1.");
  });

  it("registers browser.openPage, which opens a page on the workspace it names, at the address it gives", async () => {
    const context: WindowContext = new WindowContext();
    await new BrowserWindowPart().activateAsync(context);
    const command = context.commands[0];

    expect([context.commands.length, command?.name, command?.title]).toEqual([2, "browser.openPage", "Open a page"]);
    expect(await command?.runAsync({ profileKey: "workspace-1", url: "https://docs.example.com/" })).toBeNull();
    expect(await command?.runAsync({ profileKey: "workspace-2" })).toBeNull();
    expect(await command?.runAsync({ profileKey: "workspace-1", instance: "3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d" })).toBeNull();
    expect(context.opened.map(t => t.title)).toEqual(["https://docs.example.com/", "New tab", "New tab"]);
    expect(context.opened[2]?.instance).toBe("3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d");
  });

  it("applies browser.openPage only to its arguments, and rejects others", async () => {
    const context: WindowContext = new WindowContext();
    await new BrowserWindowPart().activateAsync(context);
    const command = context.commands[0];

    expect([command?.isApplicable({ profileKey: "workspace-1" }), command?.isApplicable(null), command?.isEnabled(null)]).toEqual([true, false, true]);
    await expect(command?.runAsync(null)).rejects.toThrow(OpenPageArgumentsInvalidException);
    expect(context.opened).toEqual([]);
  });

  it("registers browser.newPage, New page with the add glyph on Ctrl+T, or Cmd+T on macOS, which opens an empty page on the workspace of the page the tab row names, and is unavailable for any other", async () => {
    const context: WindowContext = new WindowContext();
    await new BrowserWindowPart().activateAsync(context);
    const pages: Pages = Pages.of(context);
    const instance: string = pages.open("workspace-2", "https://docs.example.com/");
    await pages.showAsync(instance);
    const command = context.commands[1];
    const row: JsonObject = { tabGroup: "2", document: "browser.page", instance };

    expect([command?.name, command?.title, command?.icon, command?.defaultKey?.text]).toEqual(["browser.newPage", "New page", "add", "Mod+T"]);
    expect([command?.isEnabled(row), command?.isEnabled({ tabGroup: "2" }), command?.isEnabled({ ...row, document: "notes.note" }),
      command?.isEnabled({ ...row, instance: "3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d" }), command?.isEnabled({ ...row, instance: 2 }), command?.isEnabled([row])])
      .toEqual([true, false, false, false, false, false]);
    expect(await command?.runAsync({ tabGroup: "2" })).toBeNull();
    expect(await command?.runAsync(row)).toBeNull();
    const shown = await pages.showAsync(context.opened.at(-1)?.instance ?? "");

    expect([context.opened.map(t => t.title), shown?.controller.status.state, context.views.views.at(-1)?.profileKey])
      .toEqual([["https://docs.example.com/", "New tab"], PaneState.Empty, "workspace-2"]);
  });

  it("registers as the in-app browser, which places a link as the settings say and opens one in a new tab on the links workspace", async () => {
    const context: WindowContext = new WindowContext();
    const answer = context.answerRequest;
    context.answerRequest = (method, parameters) => method === BrowserMethods.allowTypedAddress
      ? Promise.resolve({ kind: "Allowed", origin: "https://example.com" }) : answer(method, parameters);
    await new BrowserWindowPart().activateAsync(context);
    const browser = context.inAppBrowser;
    context.settings.set("browser.systemSites", "code.example");

    const places = [browser?.placeFor("https://example.com/", LinkGesture.Plain), browser?.placeFor("https://example.com/", LinkGesture.Middle),
      browser?.placeFor("https://code.example/", LinkGesture.Plain)];
    await browser?.openAsync("https://example.com/docs");

    expect(places).toEqual([LinkPlace.InApp, LinkPlace.System, LinkPlace.System]);
    expect([context.requests.at(-1)?.parameters, context.opened.map(t => t.title)]).toEqual([{ profileKey: "links", url: "https://example.com/docs" }, ["https://example.com/docs"]]);
  });

  it("closes its pages once it deactivates, so none can be reached, and has the window activate it again rather than continue", async () => {
    const part: BrowserWindowPart = new BrowserWindowPart();
    const context: WindowContext = new WindowContext();
    await part.activateAsync(context);
    const pages: Pages = Pages.of(context);
    const instance: string = pages.open("workspace-1", null);

    await part.deactivateAsync();
    await part.deactivateAsync();

    expect(await pages.showAsync(instance)).toBeNull();
    expect(() => Pages.of(context)).toThrow(PagesInactiveException);
    expect(await part.reconnectAsync()).toBe(false);
  });
});
