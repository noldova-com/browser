/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, ElementRef, ErrorHandler, type Signal, type WritableSignal, computed, effect, inject, input, output, signal } from "@angular/core";
import { AnnouncementPoliteness, Announcer, ButtonComponent, ButtonVariant, ClipboardWriter, TooltipDirective } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.ts";
import { PageStateAction } from "../../enums/page-state-action.ts";
import { PaneState } from "../../enums/pane-state.ts";
import type { PageStateText } from "../../models/page-state-text.ts";
import { PaneStatus } from "../../models/pane-status.ts";
import type { RefusedPage } from "../../models/refused-page.ts";
import type { PaneController } from "../../services/pane-controller.ts";

@Component({
  selector: "nol-browser-page-state",
  imports: [ButtonComponent, TooltipDirective],
  templateUrl: "./page-state.component.html",
  styleUrl: "./page-state.component.css",
  host: {
    "class": "nol-browser-page-state"
  }
})
export class PageStateComponent {
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly announcer: Announcer = inject(Announcer);
  private readonly clipboard: ClipboardWriter = inject(ClipboardWriter);
  private readonly current: WritableSignal<PaneStatus> = signal(PaneStatus.unavailable);
  private readonly heading: Signal<string> = computed(() => this.text().heading);

  protected readonly primary: ButtonVariant = ButtonVariant.Primary;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly status: Signal<PaneStatus> = this.current.asReadonly();
  protected readonly text: Signal<PageStateText> = computed(() => {
    const refusal: RefusedPage | null = this.refusal();
    if (this.isElsewhere())
      return Resources.elsewherePage;
    if (this.isForgotten())
      return Resources.forgottenPage;
    return refusal === null ? Resources.formatPageStateText(this.status()) : Resources.formatRefusalText(refusal);
  });
  protected readonly actions: Signal<readonly Exclude<PageStateAction,
    typeof PageStateAction.Close | typeof PageStateAction.AllowSite | typeof PageStateAction.NotNow>[]> = computed(() => {
    const status = this.status();
    switch (status.state) {
      case PaneState.Failed:
        return [PageStateAction.TryAgain, PageStateAction.CopyAddress];
      case PaneState.Refused:
        return status.canGoBack ? [PageStateAction.Back] : [];
      case PaneState.Crashed:
        return [PageStateAction.Reload];
      default:
        return [];
    }
  });
  protected readonly labels: Readonly<Record<PageStateAction, string>> = Resources.pageStateActions;
  protected readonly action: typeof PageStateAction = PageStateAction;

  public readonly controller = input<PaneController | null>(null);
  public readonly isForgotten = input<boolean>(false);
  public readonly isElsewhere = input<boolean>(false);
  public readonly refusal = input<RefusedPage | null>(null);
  public readonly focusLeaving = output<void>();
  public readonly closed = output<void>();
  public readonly refusalAnswered = output<string | null>();

  public constructor() {
    effect(onCleanup => {
      const controller = this.controller();
      this.current.set(controller === null ? PaneStatus.unavailable : controller.status);
      if (controller !== null)
        onCleanup(controller.onChange(t => this.current.set(t)));
    });
    effect(() => {
      this.controller();
      this.announcer.announce(this.heading(), AnnouncementPoliteness.Polite);
    });
    effect(() => {
      if (this.actions().length === 0 && !this.isForgotten() && !this.isElsewhere() && this.refusal() === null && this.host.contains(this.host.ownerDocument.activeElement))
        this.focusLeaving.emit();
    });
  }

  protected act(controller: PaneController, action: Exclude<PageStateAction,
    typeof PageStateAction.Close | typeof PageStateAction.AllowSite | typeof PageStateAction.NotNow>): void {
    if (action === PageStateAction.CopyAddress) {
      this.run(this.clipboard.writeTextAsync(this.status().url)
        .then(isCopied => this.announcer.announce(isCopied ? Resources.addressCopied : Resources.addressNotCopied, AnnouncementPoliteness.Polite)));
      return;
    }
    this.focusLeaving.emit();
    this.run(action === PageStateAction.Back ? controller.goBackAsync() : controller.reloadAsync());
  }

  private run(answer: Promise<unknown>): void {
    answer.catch((error: unknown) => this.errors.handleError(error));
  }
}
