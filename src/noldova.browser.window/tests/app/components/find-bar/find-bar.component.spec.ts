/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, ErrorHandler, type Signal, type WritableSignal, signal, viewChild } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import type { IWebViewFound } from "@noldova/desktop.window";
import { AnnouncementPoliteness, Announcer, DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { FindBarComponent } from "../../../../src/app/components/find-bar/find-bar.component.ts";
import { ViewCrashEvent } from "../../../../src/app/models/view-crash-event.ts";
import { ViewStateEvent } from "../../../../src/app/models/view-state-event.ts";
import { PaneController } from "../../../../src/app/services/pane-controller.ts";
import { FakeWebView, FakeWebViews } from "../../../fixtures/fake-web-views.fixture.ts";
import { ForcedColorsFixture } from "../../../fixtures/forced-colors.fixture.ts";

@Component({
  imports: [FindBarComponent],
  template: `@if (isShown()) {
      <nol-browser-find-bar [controller]="controller()" (closed)="closed = closed + 1" />
    }
    <div class="probe" style="width: var(--nol-field-padding); height: var(--nol-field-height); margin-left: var(--nol-space-1);
      color: var(--nol-text-muted); border: 1px solid var(--nol-accent)"></div>`
})
class HostComponent {
  public readonly isShown: WritableSignal<boolean> = signal(true);
  public readonly controller: WritableSignal<PaneController> = signal(new PaneController(null));
  public closed: number = 0;
  public readonly bar: Signal<FindBarComponent | undefined> = viewChild(FindBarComponent);
}

describe("FindBarComponent", () => {
  let fixture: ComponentFixture<HostComponent>;
  let view: FakeWebView;
  let errors: unknown[];
  let said: [string, AnnouncementPoliteness, string | undefined][];

  function rem(pixels: number): number {
    return Math.round(pixels / AppearanceFixture.toPixels(1) * 1000) / 1000;
  }

  function find<T extends Element = HTMLElement>(selector: string): T {
    const found: T | null = document.querySelector<T>(selector);
    if (found === null)
      throw new Error(`The page has no ${selector}.`);
    return found;
  }

  function field(): HTMLInputElement {
    return find<HTMLInputElement>("nol-browser-find-bar input");
  }

  function button(name: string): HTMLButtonElement {
    return find<HTMLButtonElement>(`nol-browser-find-bar button[aria-label="${name}"]`);
  }

  function count(): string | null {
    return document.querySelector(".nol-browser-find-count")?.textContent?.trim() ?? null;
  }

  function availability(): (string | null)[] {
    return ["Previous match", "Next match", "Close find"].map(t => button(t).getAttribute("aria-disabled"));
  }

  function answer(found: (call: string) => IWebViewFound): void {
    view.findAnswer = call => Promise.resolve(found(call));
  }

  async function typeAsync(text: string): Promise<void> {
    await userEvent.type(field(), text);
    await fixture.whenStable();
  }

  async function pressAsync(keys: string): Promise<void> {
    await userEvent.keyboard(keys);
    await fixture.whenStable();
  }

  async function showAsync(address: string, isLoading: boolean = false, title: string = "Page"): Promise<void> {
    view.emit(new ViewStateEvent(address, title, isLoading, false, false));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    errors = [];
    said = [];
    AppearanceFixture.apply();
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }] });
    const announcer: Announcer = TestBed.inject(Announcer);
    const announce = announcer.announce.bind(announcer);
    vi.spyOn(announcer, "announce").mockImplementation((message, politeness, options) => {
      said.push([message, politeness, options?.group]);
      announce(message, politeness, options);
    });
    view = new FakeWebViews().open("workspace-1");
    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.controller.set(new PaneController(view));
    fixture.autoDetectChanges();
    await fixture.whenStable();
    await showAsync("https://one.example/");
  });

  afterEach(async () => {
    try {
      vi.restoreAllMocks();
      fixture.destroy();
    }
    finally {
      AppearanceFixture.reset();
      await ForcedColorsFixture.resetAsync();
    }
  });

  it("is a search region named Find on page, its field named Find and focused as it opens, its match buttons unavailable before a match and no count shown", () => {
    const bar = find("nol-browser-find-bar");

    expect([bar.getAttribute("role"), bar.getAttribute("aria-label"), field().getAttribute("aria-label"), document.activeElement, field().getAttribute("aria-describedby")])
      .toEqual(["search", "Find on page", "Find", field(), null]);
    expect([availability(), count(), view.calls]).toEqual([["true", "true", null], null, []]);
  });

  it("searches the page as the person types, shows the active match and the number of matches in the field, which it describes, and says each count politely in one group", async () => {
    answer(call => call === "find p" ? FakeWebView.found(1, 9) : FakeWebView.found(2, 5));

    await typeAsync("pl");

    const described: string | null = field().getAttribute("aria-describedby");
    expect([view.calls, count(), described !== null && document.getElementById(described)?.textContent?.trim(), availability()])
      .toEqual([["find p", "find pl"], "2 of 5", "2 of 5", [null, null, null]]);
    expect(said.map(t => [t[0], t[1]])).toEqual([["1 of 9", AnnouncementPoliteness.Polite], ["2 of 5", AnnouncementPoliteness.Polite]]);
    expect(new Set(said.map(t => t[2])).size).toBe(1);
    expect(said[0]?.[2]).toMatch(/^nol-browser-find-\d+-find$/u);
  });

  it("ends the search and hides the count when the person empties the field", async () => {
    answer(() => FakeWebView.found(1, 2));
    await typeAsync("a");

    await pressAsync("{Backspace}");

    expect([view.calls, count(), field().getAttribute("aria-describedby"), availability()]).toEqual([["find a", "endFind"], null, null, ["true", "true", null]]);
  });

  it("moves to the next match on Enter and Next match, and to the previous one on Shift+Enter and Previous match", async () => {
    let active: number = 1;
    answer(call => {
      active = call === "findNext" ? active + 1 : call === "findPrevious" ? active - 1 : 1;
      return FakeWebView.found(active, 5);
    });
    await typeAsync("a");

    await pressAsync("{Enter}");
    await pressAsync("{Enter}");
    const forward: string | null = count();
    await pressAsync("{Shift>}{Enter}{/Shift}");
    button("Next match").click();
    await fixture.whenStable();
    button("Previous match").click();
    await fixture.whenStable();
    button("Previous match").click();
    await fixture.whenStable();

    expect([forward, count(), view.calls]).toEqual(["3 of 5", "1 of 5", ["find a", "findNext", "findNext", "findPrevious", "findNext", "findPrevious", "findPrevious"]]);
  });

  it("says No matches when nothing matches, and leaves Previous match and Next match unavailable and doing nothing", async () => {
    await typeAsync("zz");

    button("Next match").click();
    button("Previous match").click();
    await fixture.whenStable();

    expect([count(), availability(), view.calls, said.at(-1)?.[0]]).toEqual(["No matches", ["true", "true", null], ["find z", "find zz"], "No matches"]);
  });

  it("says a search that took too long or stopped early, rather than no matches, and searches again on Enter", async () => {
    answer(() => FakeWebView.found(0, 0, true));
    await typeAsync("a");
    const timedOut: [string | null, (string | null)[]] = [count(), availability()];
    answer(() => FakeWebView.found(0, 0, false, true));

    await pressAsync("{Enter}");
    const ended: string | null = count();
    answer(() => FakeWebView.found(1, 1));
    await pressAsync("{Enter}");

    expect([timedOut, ended, count(), view.calls, said.map(t => t[0])]).toEqual([["The search took too long", ["true", "true", null]], "The search stopped", "1 of 1",
      ["find a", "find a", "find a"], ["The search took too long", "The search stopped", "1 of 1"]]);
  });

  it("does nothing on Enter in an empty field", async () => {
    await pressAsync("{Enter}{Shift>}{Enter}{/Shift}");

    expect([view.calls, count()]).toEqual([[], null]);
  });

  it("shows only the latest search's answer when an earlier one answers after it", async () => {
    const answers: Map<string, (found: IWebViewFound) => void> = new Map<string, (found: IWebViewFound) => void>();
    view.findAnswer = call => new Promise<IWebViewFound>(resolve => answers.set(call, resolve));
    await typeAsync("ab");

    answers.get("find ab")?.(FakeWebView.found(1, 2));
    await fixture.whenStable();
    answers.get("find a")?.(FakeWebView.found(1, 7));
    await fixture.whenStable();

    expect([count(), said.map(t => t[0])]).toEqual(["1 of 2", ["1 of 2"]]);
  });

  it("clears the count when the page navigates or crashes, keeps the text, and starts a new search on Enter; a new title alone keeps the count", async () => {
    answer(() => FakeWebView.found(1, 3));
    await typeAsync("a");
    await showAsync("https://one.example/", false, "Renamed");
    const kept: string | null = count();

    await showAsync("https://one.example/next", true);
    const navigated: [string | null, string] = [count(), field().value];
    await pressAsync("{Enter}");
    const searched: string | null = count();
    await showAsync("https://one.example/next");
    await showAsync("https://one.example/#part");
    const moved: string | null = count();
    await pressAsync("{Enter}");
    view.emit(new ViewCrashEvent());
    await fixture.whenStable();

    expect([kept, navigated, searched, moved, count(), view.calls]).toEqual(["1 of 3", [null, "a"], "1 of 3", null, null, ["find a", "find a", "find a"]]);
  });

  it("closes on Escape and on Close find, ending a running search once", async () => {
    answer(() => FakeWebView.found(1, 3));
    await typeAsync("a");

    await pressAsync("{Escape}");
    button("Close find").click();
    await fixture.whenStable();

    expect([fixture.componentInstance.closed, view.calls, count()]).toEqual([2, ["find a", "endFind"], null]);
  });

  it("closes on Escape from its buttons too, and leaves Enter on a button to the button", async () => {
    answer(() => FakeWebView.found(1, 3));
    await typeAsync("a");
    button("Next match").focus();

    await pressAsync("{Enter}");
    await pressAsync("{Escape}");

    expect([fixture.componentInstance.closed, view.calls]).toEqual([1, ["find a", "findNext", "endFind"]]);
  });

  it("leaves Enter and Escape with Ctrl, Alt or Cmd, or while composing, to others", async () => {
    answer(() => FakeWebView.found(1, 3));
    await typeAsync("a");
    const presses: KeyboardEvent[] = [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { isComposing: true }]
      .flatMap(t => ["Enter", "Escape"].map(key => new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...t })));

    for (const press of presses)
      field().dispatchEvent(press);
    await fixture.whenStable();

    expect([presses.map(t => t.defaultPrevented), fixture.componentInstance.closed, view.calls]).toEqual([presses.map(() => false), 0, ["find a"]]);
  });

  it("selects its text and searches it again when it is focused once more after its search ended", async () => {
    answer(() => FakeWebView.found(2, 4));
    await typeAsync("plan");
    button("Close find").focus();
    fixture.componentInstance.bar()?.focus();
    await fixture.whenStable();
    const searching: number = view.calls.length;
    await showAsync("https://one.example/next", true);

    fixture.componentInstance.bar()?.focus();
    await fixture.whenStable();

    expect([searching, view.calls.at(-1), view.calls.length, count(), document.activeElement, field().selectionStart, field().selectionEnd])
      .toEqual([4, "find plan", 5, "2 of 4", field(), 0, 4]);
  });

  it("ends the search when it goes away", async () => {
    answer(() => FakeWebView.found(1, 3));
    await typeAsync("a");

    fixture.componentInstance.isShown.set(false);
    await fixture.whenStable();

    expect(view.calls).toEqual(["find a", "endFind"]);
  });

  it("hands a failed search to the error handler", async () => {
    const failure = new Error("No page.");
    view.findAnswer = () => Promise.reject(failure);

    await typeAsync("a");

    await vi.waitFor(() => expect(errors).toEqual([failure]));
    expect(count()).toBeNull();
  });

  for (const [mode, isForced] of [[ThemeMode.Light, false], [ThemeMode.Dark, false], [ThemeMode.Dark, true]] as const) {
    it(`sets the field a field's height from the row's inset, 20rem wide, then the count in the muted text and the buttons, each 0.25rem after the last, in the ${isForced ? "forced colours" : mode} look`, async () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      if (isForced)
        await ForcedColorsFixture.activateAsync();
      answer(() => FakeWebView.found(12, 345));
      await typeAsync("a");
      const probe = find(".probe");
      const [bar, box, input, end] = [find("nol-browser-find-bar"), find("nol-text-field-box"), field(), find(".nol-browser-find-count")].map(t => t.getBoundingClientRect());
      const [previous, next, close] = ["Previous match", "Next match", "Close find"].map(t => button(t).getBoundingClientRect());
      if (bar === undefined || box === undefined || input === undefined || end === undefined || previous === undefined || next === undefined || close === undefined)
        throw new Error("The find bar lacks a part.");
      const inset: number = probe.getBoundingClientRect().width;
      const gap: number = Number.parseFloat(getComputedStyle(probe).marginLeft);

      expect([rem(bar.height), rem(input.left - bar.left), rem(input.width), rem(input.height), rem(input.top + input.height / 2 - (bar.top + bar.height / 2))])
        .toEqual([2.5, rem(inset), 20, rem(probe.getBoundingClientRect().height), 0]);
      expect([rem(end.left - box.right), rem(end.top + end.height / 2 - (input.top + input.height / 2)), rem(previous.left - end.right)]).toEqual([rem(gap), 0, rem(gap)]);
      expect([rem(next.left - previous.right), rem(close.left - next.right), rem(close.top + close.height / 2 - (bar.top + bar.height / 2))]).toEqual([0.125, 0.125, 0]);
      expect(getComputedStyle(find(".nol-browser-find-count")).color).toBe(isForced ? ForcedColorsFixture.resolve("CanvasText") : getComputedStyle(probe).color);
      const focused = getComputedStyle(field());
      expect([document.activeElement === field(), isForced ? [focused.outlineStyle, focused.outlineColor] : [focused.borderTopColor]])
        .toEqual([true, isForced ? ["solid", ForcedColorsFixture.resolve("Highlight")] : [getComputedStyle(probe).borderTopColor]]);
    });
  }
});
