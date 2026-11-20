/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, ElementRef, type Signal, type WritableSignal, computed, effect, inject, input, output, signal } from "@angular/core";
import { AnnouncementPoliteness, Announcer, ButtonComponent, ButtonVariant } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.ts";
import { PaneStatus } from "../../models/pane-status.ts";
import { RequestNotice } from "../../models/request-notice.ts";
import type { PaneController } from "../../services/pane-controller.ts";

@Component({
  selector: "nol-browser-request-notice",
  imports: [ButtonComponent],
  templateUrl: "./request-notice.component.html",
  styleUrl: "./request-notice.component.css",
  host: {
    "class": "nol-browser-request-notice"
  }
})
export class RequestNoticeComponent {
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly announcer: Announcer = inject(Announcer);
  private readonly current: WritableSignal<PaneStatus> = signal(PaneStatus.unavailable);
  // Each status change makes a new notice, so its text alone decides whether it is announced again.
  private readonly message: Signal<string | null> = computed(() => this.notice()?.message ?? null);

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly notice: Signal<RequestNotice | null> = computed(() => {
    const status = this.current();
    if (status.popup !== null) {
      const host: string = Resources.hostOf(status.url);
      return new RequestNotice(Resources.popupGlyph, status.popup.hadRecentInput ? Resources.formatHeldWindow(host) : Resources.formatPopup(host), Resources.openAsTab);
    }
    if (status.refusedAddress !== null)
      return new RequestNotice(Resources.refusedAddressGlyph, Resources.refusedAddresses[status.refusedAddress], null);
    return status.refusedRequest === null
      ? null
      : new RequestNotice(Resources.refusedRequestGlyphs[status.refusedRequest], Resources.formatRefusedRequest(status.refusedRequest, this.appName()), Resources.openExternal);
  });

  public readonly controller = input.required<PaneController>();
  public readonly appName = input<string | null>(null);
  public readonly messageId = input<string | null>(null);
  public readonly focusLeaving = output<void>();
  public readonly popupOpened = output<string>();
  public readonly externalOpened = output<string>();

  public constructor() {
    effect(onCleanup => {
      const controller = this.controller();
      this.current.set(controller.status);
      onCleanup(controller.onChange(t => this.current.set(t)));
    });
    effect(() => {
      const message = this.message();
      if (message !== null)
        this.announcer.announce(message, AnnouncementPoliteness.Polite);
      else if (this.host.contains(document.activeElement))
        this.focusLeaving.emit();
    });
  }

  protected act(): void {
    const status = this.current();
    if (status.popup !== null)
      this.popupOpened.emit(status.popup.address);
    else
      this.externalOpened.emit(status.refusedTarget ?? status.url);
  }
}
