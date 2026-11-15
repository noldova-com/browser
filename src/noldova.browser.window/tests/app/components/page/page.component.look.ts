/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type WritableSignal, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { BrowserEvents } from "@noldova/browser.protocol";
import type { JsonObject } from "@noldova/context.json";
import { WindowPartTokens } from "@noldova/desktop.window";
import { DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import { PageComponent } from "../../../../src/app/components/page/page.component.ts";
import { RefusedRequest } from "../../../../src/app/enums/refused-request.ts";
import { ViewLoadFailureEvent } from "../../../../src/app/models/view-load-failure-event.ts";
import { ViewNewWindowEvent } from "../../../../src/app/models/view-new-window-event.ts";
import { ViewRefusalEvent } from "../../../../src/app/models/view-refusal-event.ts";
import { ViewRequestRefusalEvent } from "../../../../src/app/models/view-request-refusal-event.ts";
import { ViewStateEvent } from "../../../../src/app/models/view-state-event.ts";
import { ViewZoomEvent } from "../../../../src/app/models/view-zoom-event.ts";
import { Pages } from "../../../../src/app/services/pages.ts";
import type { FakeWebView } from "../../../fixtures/fake-web-views.fixture.ts";
import { WindowContext } from "../../../fixtures/window-context.fixture.ts";

@Component({
  imports: [PageComponent],
  template: `<div class="frame" style="width: 46rem; height: 15rem; background: var(--nol-panel)"><nol-browser-page [instance]="instance()" /></div>`
})
class HostComponent {
  public readonly instance: WritableSignal<string> = signal("");
}

describe("PageComponent in the design's look", () => {
  const screenshots: string = "../../../../../../_build/window/screenshots";
  let context: WindowContext;
  let pages: Pages;
  let fixture: ComponentFixture<HostComponent> | null;

  function frame(): HTMLElement {
    const found: HTMLElement | null = document.querySelector<HTMLElement>(".frame");
    if (found === null)
      throw new Error("The look has no frame.");
    return found;
  }

  function buttonNamed(name: string): HTMLButtonElement {
    const found: HTMLButtonElement | undefined = [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find(t => (t.getAttribute("aria-label") ?? t.querySelector(".nol-menu-item-label")?.textContent ?? t.textContent)?.trim() === name);
    if (found === undefined)
      throw new Error(`The look has no ${name} button.`);
    return found;
  }

  async function chooseAsync(...names: string[]): Promise<void> {
    for (const name of names) {
      const button: HTMLButtonElement = await vi.waitFor(() => buttonNamed(name));
      button.click();
      await fixture?.whenStable();
    }
  }

  async function openAsync(): Promise<FakeWebView> {
    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.instance.set(pages.open("workspace-1", null));
    fixture.autoDetectChanges();
    await vi.waitFor(() => expect(document.querySelector("nol-browser-toolbar")).not.toBeNull());
    const view: FakeWebView | undefined = context.views.views.at(-1);
    if (view === undefined)
      throw new Error("The page opened no view.");
    return view;
  }

  async function saveAsync(name: string, mode: ThemeMode, isWhole: boolean = false): Promise<void> {
    await fixture?.whenStable();
    if (!isWhole)
      document.querySelector<HTMLElement>(":focus")?.blur();
    const path: string = `${screenshots}/page-${name}-${mode}.png`;
    await (isWhole ? page.screenshot({ path }) : page.screenshot({ element: frame(), path }));
  }

  function loaded(view: FakeWebView, address: string, canGoBack: boolean): void {
    view.emit(new ViewStateEvent(address, "", true, canGoBack, false));
    view.emit(new ViewStateEvent(address, "Plans and pricing", false, canGoBack, false));
  }

  async function actAsync(fields: JsonObject): Promise<void> {
    context.emit(BrowserEvents.pageActivity, {
      instance: fixture?.componentInstance.instance() ?? "", activity: "call-1", agentName: "Scout", action: "Clicking", state: "Acting", box: null, point: null,
      refusal: null, isHandedOver: false, ...fields
    });
    await fixture?.whenStable();
  }

  const STATES: readonly [string, (view: FakeWebView) => void | Promise<void>, boolean][] = [
    ["loading", view => view.emit(new ViewStateEvent("https://docs.example.com/pricing", "", true, true, false)), false],
    ["loaded", view => loaded(view, "https://docs.example.com/pricing", true), false],
    ["not-secure", view => loaded(view, "http://intranet.example.org/wiki", false), false],
    ["failed", view => view.emit(new ViewLoadFailureEvent("https://docs.example.com/pricing", -105, "ERR_NAME_NOT_RESOLVED")), false],
    ["refused", view => {
      loaded(view, "https://docs.example.com/pricing", true);
      view.emit(new ViewRefusalEvent("https://intranet.example.org/", "https://intranet.example.org", false));
    }, false],
    ["crashed", view => {
      loaded(view, "https://docs.example.com/pricing", false);
      view.crash();
    }, false],
    ["notice", view => {
      loaded(view, "http://printer.local/settings", true);
      view.emit(new ViewRequestRefusalEvent(RefusedRequest.Download, "http://printer.local"));
    }, false],
    ["popup", view => {
      loaded(view, "https://docs.example.com/pricing", true);
      view.emit(new ViewNewWindowEvent("https://ads.example.com/", false, "https://docs.example.com"));
    }, false],
    ["menu", async view => {
      loaded(view, "https://docs.example.com/pricing", true);
      await fixture?.whenStable();
      await chooseAsync("More");
      await vi.waitFor(() => expect(document.querySelectorAll(".nol-browser-toolbar-menu button[nol-menu-item]")).toHaveLength(4));
    }, true],
    ["zoom", async view => {
      loaded(view, "https://docs.example.com/pricing", true);
      view.emit(new ViewZoomEvent(1.25));
      await fixture?.whenStable();
      await chooseAsync("More", "Zoom");
      await vi.waitFor(() => expect(document.querySelectorAll(".nol-browser-toolbar-zoom-menu button[nol-menu-item]")).toHaveLength(3));
    }, true],
    ["clear", async view => {
      loaded(view, "https://docs.example.com/pricing", true);
      await fixture?.whenStable();
      await chooseAsync("More", "Clear browsing data…");
      await vi.waitFor(() => expect(document.querySelector("nol-browser-clear-data-dialog")).not.toBeNull());
    }, true],
    ["agent", async view => {
      loaded(view, "https://docs.example.com/pricing", true);
      await actAsync({ action: "Navigating" });
    }, false],
    ["agent-asking", async view => {
      loaded(view, "https://docs.example.com/pricing", true);
      await actAsync({ action: "Typing", state: "Asking", box: { x: 160, y: 48, width: 240, height: 32 } });
      await vi.waitFor(() => expect(document.querySelector("nol-browser-agent-mark")).not.toBeNull());
    }, false],
    ["agent-clicking", async view => {
      loaded(view, "https://docs.example.com/pricing", true);
      await actAsync({ box: { x: 160, y: 48, width: 136, height: 32 }, point: { x: 228, y: 64 } });
      await vi.waitFor(() => expect(document.querySelector("nol-browser-agent-mark")).not.toBeNull());
    }, false],
    ["agent-refused", async view => {
      loaded(view, "https://docs.example.com/pricing", true);
      await actAsync({ action: "Navigating" });
      await actAsync({ action: "Navigating", state: "Ended", refusal: { url: "https://intranet.example.org/wiki", origin: "https://intranet.example.org" } });
      await vi.waitFor(() => expect(document.querySelectorAll(".nol-browser-page-state-action")).toHaveLength(2));
    }, false]
  ];

  beforeEach(() => {
    fixture = null;
    context = new WindowContext();
    pages = new Pages(context);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
  });

  afterEach(() => {
    fixture?.destroy();
    pages.close();
    AppearanceFixture.reset();
  });

  for (const mode of [ThemeMode.Light, ThemeMode.Dark]) {
    for (const [name, show, isWhole] of STATES) {
      it(`draws the ${name} page in the ${mode} theme`, async () => {
        AppearanceFixture.apply(DefaultTheme.theme, mode);
        const view: FakeWebView = await openAsync();
        await show(view);

        await saveAsync(name, mode, isWhole);
      });
    }

    for (const [width, isEditing, name] of [[18, false, "page-shrinking"], [15, false, "page-narrow"], [15, true, "page-narrow-editing"]] as const) {
      it(`draws the ${width}rem toolbar${isEditing ? " while its address is edited" : ""} in the ${mode} theme`, async () => {
        AppearanceFixture.apply(DefaultTheme.theme, mode);
        const view: FakeWebView = await openAsync();
        frame().style.width = `${width}rem`;
        loaded(view, "https://docs.example.com/pricing", true);
        await vi.waitFor(() => expect(document.querySelector("input.nol-browser-toolbar-field")?.getClientRects().length).toBe(width < 16 ? 0 : 1));
        if (isEditing) {
          await chooseAsync("More", "Edit address");
          await vi.waitFor(() => expect(document.activeElement?.matches("input.nol-browser-toolbar-field")).toBe(true));
        }
        await fixture?.whenStable();

        await page.screenshot({ element: frame(), path: `${screenshots}/${name}-${mode}.png` });
      });
    }
  }
});
