/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  Component, ElementRef, ErrorHandler, type Signal, type WritableSignal, afterNextRender, computed, effect, inject, input, output, signal, viewChild
} from "@angular/core";
import type { IWebViewFound } from "@noldova/desktop.window";
import {
  AnnouncementPoliteness, Announcer, OverlaySide, TextFieldBoxComponent, TextFieldComponent, TextFieldEndDirective, ToolbarButtonComponent, TooltipDirective
} from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.ts";
import { PaneState } from "../../enums/pane-state.ts";
import type { PaneStatus } from "../../models/pane-status.ts";
import type { PaneController } from "../../services/pane-controller.ts";

@Component({
  selector: "nol-browser-find-bar",
  imports: [TextFieldBoxComponent, TextFieldComponent, TextFieldEndDirective, ToolbarButtonComponent, TooltipDirective],
  templateUrl: "./find-bar.component.html",
  styleUrl: "./find-bar.component.css",
  host: {
    "class": "nol-browser-find-bar",
    "role": "search",
    "[attr.aria-label]": "resources.findBarLabel",
    "(keydown)": "pressKey($event)"
  }
})
export class FindBarComponent {
  private static count: number = 0;
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly announcer: Announcer = inject(Announcer);
  private readonly field: Signal<ElementRef<HTMLInputElement>> = viewChild.required("field", { read: ElementRef<HTMLInputElement> });
  private readonly number: number = FindBarComponent.count++;
  private readonly group: string = `${Resources.findBarId}${String(this.number)}${Resources.findGroup}`;
  private readonly found: WritableSignal<IWebViewFound | null> = signal(null);
  private search: number = 0;
  private isSearching: boolean = false;

  protected readonly resources: typeof Resources = Resources;
  protected readonly below: OverlaySide = OverlaySide.below;
  protected readonly countId: string = `${Resources.findBarId}${String(this.number)}${Resources.findCountId}`;
  protected readonly countText: Signal<string | null> = computed(() => {
    const found: IWebViewFound | null = this.found();
    return found === null ? null : FindBarComponent.describe(found);
  });
  protected readonly hasMatches: Signal<boolean> = computed(() => (this.found()?.matches ?? 0) > 0);

  public readonly controller = input.required<PaneController>();
  public readonly closed = output<void>();

  public constructor() {
    effect(onCleanup => {
      const controller: PaneController = this.controller();
      let was: PaneStatus = controller.status;
      onCleanup(controller.onChange(t => {
        if (t.state !== PaneState.Loaded || t.url !== was.url)
          this.reset();
        was = t;
      }));
      onCleanup(() => this.end(controller));
    });
    afterNextRender(() => this.focus());
  }

  public focus(): void {
    const field: HTMLInputElement = this.field().nativeElement;
    field.focus();
    field.select();
    if (!this.isSearching && field.value !== "")
      this.find(field.value);
  }

  protected edit(): void {
    const text: string = this.field().nativeElement.value;
    if (text === "")
      this.end(this.controller());
    else
      this.find(text);
  }

  protected pressKey(event: KeyboardEvent): void {
    if (event.isComposing || event.ctrlKey || event.altKey || event.metaKey)
      return;
    if (event.key === Resources.enterKey && event.target === this.field().nativeElement) {
      event.preventDefault();
      this.step(!event.shiftKey);
    }
    else if (event.key === Resources.escapeKey) {
      event.preventDefault();
      this.close();
    }
  }

  protected goNext(): void {
    if (this.hasMatches())
      this.step(true);
  }

  protected goPrevious(): void {
    if (this.hasMatches())
      this.step(false);
  }

  protected close(): void {
    this.end(this.controller());
    this.closed.emit();
  }

  private static describe(found: IWebViewFound): string {
    if (found.isTimedOut)
      return Resources.findTimedOut;
    return found.isEnded ? Resources.findEnded : Resources.formatMatches(found.active, found.matches);
  }

  private step(isForward: boolean): void {
    const text: string = this.field().nativeElement.value;
    if (text === "")
      return;
    if (!this.isSearching)
      this.find(text);
    else
      this.take(isForward ? this.controller().findNextAsync() : this.controller().findPreviousAsync());
  }

  private find(text: string): void {
    this.isSearching = true;
    this.take(this.controller().findAsync(text));
  }

  private take(answer: Promise<IWebViewFound>): void {
    const search: number = ++this.search;
    answer.then(found => {
      if (search !== this.search)
        return;
      this.isSearching = !found.isTimedOut && !found.isEnded;
      this.found.set(found);
      this.announcer.announce(FindBarComponent.describe(found), AnnouncementPoliteness.Polite, { group: this.group });
    }).catch((error: unknown) => this.errors.handleError(error));
  }

  private end(controller: PaneController): void {
    if (this.isSearching)
      controller.endFind();
    this.reset();
  }

  private reset(): void {
    this.search++;
    this.isSearching = false;
    this.found.set(null);
  }
}
