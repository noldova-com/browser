/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  Component, DestroyRef, ElementRef, ErrorHandler, Injector, type Signal, type WritableSignal, afterNextRender, afterRenderEffect, computed, effect, inject, input, output, signal, untracked, viewChild
} from "@angular/core";
import {
  AnnouncementPoliteness, Announcer, ClipboardWriter, MenuComponent, MenuItemComponent, MenuTriggerDirective, OverlayAlignment, OverlaySide, ProgressComponent,
  ToolbarButtonComponent, ToolbarDirective, ToolbarItemDirective, TooltipDirective
} from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.ts";
import { PaneState } from "../../enums/pane-state.ts";
import { ZoomStep } from "../../enums/zoom-step.ts";
import { PaneStatus } from "../../models/pane-status.ts";
import { PageKeys } from "../../services/page-keys.ts";
import type { PaneController } from "../../services/pane-controller.ts";

@Component({
  selector: "nol-browser-toolbar",
  imports: [MenuComponent, MenuItemComponent, MenuTriggerDirective, ProgressComponent, ToolbarButtonComponent, ToolbarDirective, ToolbarItemDirective, TooltipDirective],
  templateUrl: "./pane-toolbar.component.html",
  styleUrl: "./pane-toolbar.component.css",
  host: {
    "class": "nol-browser-toolbar"
  }
})
export class PaneToolbarComponent {
  private static count: number = 0;
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly injector: Injector = inject(Injector);
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly announcer: Announcer = inject(Announcer);
  private readonly clipboard: ClipboardWriter = inject(ClipboardWriter);
  private readonly current: WritableSignal<PaneStatus> = signal(PaneStatus.unavailable);
  private readonly reload: Signal<ElementRef<HTMLElement>> = viewChild.required("reload", { read: ElementRef<HTMLElement> });
  private readonly field: Signal<ElementRef<HTMLInputElement>> = viewChild.required("addressField", { read: ElementRef<HTMLInputElement> });
  private readonly moreButton: Signal<ElementRef<HTMLElement>> = viewChild.required("more", { read: ElementRef<HTMLElement> });
  private readonly unit: Signal<ElementRef<HTMLElement>> = viewChild.required("unit", { read: ElementRef<HTMLElement> });
  private readonly place: Signal<ElementRef<HTMLElement>> = viewChild.required("place", { read: ElementRef<HTMLElement> });
  private readonly words: Signal<ElementRef<HTMLElement> | undefined> = viewChild("words", { read: ElementRef<HTMLElement> });
  private readonly draft: WritableSignal<string | null> = signal(null);
  private readonly number: number = PaneToolbarComponent.count++;
  private readonly loadGroup: string = `${Resources.securityId}${this.number}${Resources.loadGroup}`;
  private readonly zoomGroup: string = `${Resources.securityId}${this.number}${Resources.zoomGroup}`;
  private isEntered: boolean = false;
  private isSelecting: boolean = false;
  private stopPresses: number = 0;
  private standingStop: number | null = null;

  protected readonly isNarrow: WritableSignal<boolean> = signal(false);
  protected readonly isRevealed: WritableSignal<boolean> = signal(false);
  protected readonly isCompact: WritableSignal<boolean> = signal(false);
  protected readonly isEditing: WritableSignal<boolean> = signal(false);
  protected readonly resources: typeof Resources = Resources;
  protected readonly zoomSteps: typeof ZoomStep = ZoomStep;
  protected readonly below: OverlaySide = OverlaySide.below;
  protected readonly end: OverlayAlignment = OverlayAlignment.End;
  protected readonly securityId: string = `${Resources.securityId}${this.number}`;
  protected readonly zoom: WritableSignal<number> = signal(1);
  protected readonly zoomPercent: Signal<string> = computed(() => Resources.formatZoom(this.zoom()));
  protected readonly zoomKeys: Readonly<Record<ZoomStep, string>> = PageKeys.zoomKeysOf(PageKeys.platformOf(navigator.platform));
  protected readonly findKey: string = PageKeys.findKeyOf(PageKeys.platformOf(navigator.platform));
  protected readonly status: Signal<PaneStatus> = this.current.asReadonly();
  protected readonly isLoading: Signal<boolean> = computed(() => this.status().state === PaneState.Loading);
  protected readonly hasPage: Signal<boolean> = computed(() => this.status().state !== PaneState.Empty && this.status().state !== PaneState.Unavailable);
  protected readonly isAvailable: Signal<boolean> = computed(() => this.status().state !== PaneState.Unavailable);
  protected readonly shown: Signal<string> = computed(() => this.shownAddress() ?? this.status().url);
  protected readonly shownHost: Signal<string | null> = computed(() => {
    const url: string = this.shown();
    if (this.draft() !== null || !URL.canParse(url))
      return null;
    const host: string = new URL(url).host;
    return host === "" ? null : host;
  });
  protected readonly address: Signal<string> = computed(() => this.draft() ?? this.shown());
  private readonly shownPage: Signal<string> = computed(() => this.address() === this.status().url ? this.address() : "");
  protected readonly isInsecure: Signal<boolean> = computed(() => this.shownPage().startsWith(Resources.insecureScheme));
  protected readonly isSecure: Signal<boolean> = computed(() => this.shownPage().startsWith(Resources.secureScheme));
  // An entered address that Noldova Desktop refused shows as the refused page, whose heading says why, so the field names that heading
  // while the pane shows that refusal.
  private readonly isAnswerRefused: WritableSignal<boolean> = signal(false);
  private readonly isEnteredRefused: Signal<boolean> = computed(() => this.draft() !== null && this.isAnswerRefused() && this.status().refusedAddress === null
    && this.status().state === PaneState.Refused);
  protected readonly isRefused: Signal<boolean> = computed(() => this.draft() !== null && this.status().refusedAddress !== null || this.isEnteredRefused());
  protected readonly describedBy: Signal<string | null> = computed(() => {
    const ids: string[] = [];
    const notice: string | null = this.noticeId();
    if (this.isInsecure())
      ids.push(this.securityId);
    const refusal: string | null = this.refusalId();
    if (this.isEnteredRefused() && refusal !== null)
      ids.push(refusal);
    else if (this.isRefused() && notice !== null)
      ids.push(notice);
    return ids.length === 0 ? null : ids.join(Resources.idListSeparator);
  });
  protected readonly addressLabel: Signal<string> = computed(() => this.shown() === "" ? Resources.address : this.shown());
  protected readonly canOpenExternal: Signal<boolean> = computed(() => {
    const url = this.status().url;
    return this.openLink() !== null && this.hasPage() && (url.startsWith(Resources.insecureScheme) || url.startsWith(Resources.secureScheme));
  });

  public readonly controller = input.required<PaneController>();
  public readonly openLink = input<((url: string) => Promise<void>) | null>(null);
  public readonly noticeId = input<string | null>(null);
  public readonly refusalId = input<string | null>(null);
  public readonly shownAddress = input<string | null>(null);
  public readonly addressEntered = output<string>();
  public readonly entryLeft = output<void>();
  public readonly clearBrowsingData = output<void>();
  public readonly findRequested = output<void>();

  public constructor() {
    const resizes: ResizeObserver = new ResizeObserver(() => this.measure());
    afterNextRender(() => {
      for (const target of [this.host, this.unit().nativeElement, this.place().nativeElement])
        resizes.observe(target);
    });
    afterRenderEffect(() => {
      this.isInsecure();
      this.isRevealed();
      this.words();
      untracked(() => this.measure());
    });
    inject(DestroyRef).onDestroy(() => resizes.disconnect());
    effect(onCleanup => {
      const controller = this.controller();
      this.current.set(controller.status);
      this.standingStop = null;
      this.restore();
      onCleanup(controller.onChange(t => {
        this.announceLoad(this.current(), t);
        if (t.state !== PaneState.Refused)
          this.isAnswerRefused.set(false);
        this.current.set(t);
      }));
    });
    effect(onCleanup => {
      const controller = this.controller();
      this.zoom.set(controller.zoom);
      onCleanup(controller.onZoom(t => this.zoom.set(t)));
    });
  }

  public focusReload(): void {
    this.reload().nativeElement.focus();
  }

  public focusAddress(): void {
    this.measure();
    if (this.isNarrow() && !this.isRevealed()) {
      this.isRevealed.set(true);
      afterNextRender(() => this.selectAddress(), { injector: this.injector });
    }
    else
      this.selectAddress();
  }

  // Marks the address entered last, which Noldova Desktop refused, while the person hasn't changed it since.
  public markRefused(controller: PaneController): void {
    if (controller === this.controller() && this.isEntered)
      this.isAnswerRefused.set(true);
  }

  public followPage(controller: PaneController): void {
    if (controller === this.controller() && this.isEntered)
      this.restore();
  }

  public reloadPage(): void {
    if (this.hasPage())
      this.run(this.controller().reloadAsync());
  }

  public stopPage(): boolean {
    if (!this.isLoading())
      return false;
    this.entryLeft.emit();
    const press: number = ++this.stopPresses;
    this.standingStop = press;
    this.run(this.controller().stopAsync().catch((error: unknown) => {
      if (this.standingStop === press)
        this.standingStop = null;
      throw error;
    }));
    return true;
  }

  protected pathAfter(host: string): string {
    const url: string = this.shown();
    return url.slice(url.indexOf(host) + host.length);
  }

  protected startEditing(): void {
    this.isEditing.set(true);
    this.field().nativeElement.select();
  }

  protected pressField(): void {
    this.isSelecting = !this.isEditing();
  }

  protected releaseField(event: MouseEvent): void {
    if (this.isSelecting)
      event.preventDefault();
    this.isSelecting = false;
  }

  protected stopEditing(): void {
    this.isEditing.set(false);
    this.isRevealed.set(false);
  }

  protected edit(): void {
    this.isEntered = false;
    this.isAnswerRefused.set(false);
    this.draft.set(this.field().nativeElement.value);
  }

  protected pressFieldKey(event: KeyboardEvent): void {
    if (event.isComposing || event.repeat || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey)
      return;
    if (event.key === Resources.enterKey)
      this.enter();
    else if (event.key === Resources.escapeKey)
      this.cancel();
  }

  protected goBack(): void {
    this.run(this.controller().goBackAsync());
  }

  protected goForward(): void {
    this.run(this.controller().goForwardAsync());
  }

  protected reloadOrStop(): void {
    if (!this.stopPage())
      this.reloadPage();
  }

  protected requestFind(): void {
    afterNextRender(() => this.findRequested.emit(), { injector: this.injector });
  }

  protected copyAddress(): void {
    this.run(this.clipboard.writeTextAsync(this.status().url)
      .then(isCopied => this.announcer.announce(isCopied ? Resources.addressCopied : Resources.addressNotCopied, AnnouncementPoliteness.Polite)));
  }

  protected openExternal(): void {
    this.run(Promise.resolve(this.openLink()?.(this.status().url)));
  }

  protected zoomIn(): void {
    this.run(this.controller().zoomInAsync().then(t => this.announceZoom(t)));
  }

  protected zoomOut(): void {
    this.run(this.controller().zoomOutAsync().then(t => this.announceZoom(t)));
  }

  protected resetZoom(): void {
    this.run(this.controller().resetZoomAsync().then(t => this.announceZoom(t)));
  }

  private enter(): void {
    const text: string = this.field().nativeElement.value;
    if (text.trim() === "")
      return;
    this.isEntered = true;
    this.isAnswerRefused.set(false);
    this.draft.set(text);
    this.addressEntered.emit(text);
    this.conceal();
  }

  private cancel(): void {
    this.restore();
    this.entryLeft.emit();
    this.controller().dismissAddress();
    this.conceal();
  }

  private announceZoom(factor: number): void {
    this.announcer.announce(Resources.formatZoomed(factor), AnnouncementPoliteness.Polite, { group: this.zoomGroup });
  }

  private announceLoad(was: PaneStatus, status: PaneStatus): void {
    if (status.state === PaneState.Loading && was.state !== PaneState.Loading) {
      this.standingStop = null;
      this.announcer.announce(Resources.loadStarted, AnnouncementPoliteness.Polite, { group: this.loadGroup });
    } else if (status.state === PaneState.Loaded && was.state === PaneState.Loading) {
      const message: string = this.standingStop !== null ? Resources.loadStopped : Resources.formatLoaded(status.title === "" ? status.url : status.title);
      this.standingStop = null;
      this.announcer.announce(message, AnnouncementPoliteness.Polite, { group: this.loadGroup });
    }
  }

  private measure(): void {
    const rem: number = this.unit().nativeElement.getBoundingClientRect().width;
    const words: HTMLElement | undefined = this.words()?.nativeElement;
    const place: number = this.place().nativeElement.getBoundingClientRect().width;
    this.isNarrow.set(this.host.getBoundingClientRect().width < Resources.narrowToolbarWidth * rem);
    this.isCompact.set(words !== undefined && (this.isCompact() ? place - words.scrollWidth - Resources.securityGap * rem : place) < Resources.minimumFieldWidth * rem);
  }

  private selectAddress(): void {
    const field: HTMLInputElement = this.field().nativeElement;
    field.focus();
    field.setSelectionRange(0, field.value.length, Resources.backwardSelection);
    field.scrollLeft = 0;
  }

  private conceal(): void {
    if (!this.isRevealed())
      return;
    this.isEditing.set(false);
    this.isRevealed.set(false);
    afterNextRender(() => this.moreButton().nativeElement.focus(), { injector: this.injector });
  }

  private restore(): void {
    this.isEntered = false;
    this.isAnswerRefused.set(false);
    this.draft.set(null);
  }

  private run(answer: Promise<unknown>): void {
    answer.catch((error: unknown) => this.errors.handleError(error));
  }
}
