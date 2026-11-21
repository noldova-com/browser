/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  Component, DestroyRef, ElementRef, ErrorHandler, Injector, type Signal, type WritableSignal, afterNextRender, afterRenderEffect, computed, effect, inject, input,
  signal, untracked, viewChild
} from "@angular/core";
import { PageAction, type PageActivity, PageActivityState } from "@noldova/browser.protocol";
import { type IWebViewHandle, type IWindowPartContext, LinkPlace, WindowPartTokens } from "@noldova/desktop.window";
import { Announcer, DialogService } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.ts";
import { EntryAnswer } from "../../enums/entry-answer.ts";
import { PaneState } from "../../enums/pane-state.ts";
import type { PaneTab } from "../../models/pane-tab.ts";
import type { RefusedPage } from "../../models/refused-page.ts";
import { MarkLayer } from "../../services/mark-layer.ts";
import { PageKeys } from "../../services/page-keys.ts";
import { Pages } from "../../services/pages.ts";
import { PlaceholderTracker } from "../../services/placeholder-tracker.ts";
import { AgentBarComponent } from "../agent-bar/agent-bar.component.ts";
import { ClearDataDialogComponent } from "../clear-data-dialog/clear-data-dialog.component.ts";
import { FindBarComponent } from "../find-bar/find-bar.component.ts";
import { PageStateComponent } from "../page-state/page-state.component.ts";
import { PaneToolbarComponent } from "../pane-toolbar/pane-toolbar.component.ts";
import { RequestNoticeComponent } from "../request-notice/request-notice.component.ts";

@Component({
  selector: "nol-browser-page",
  imports: [AgentBarComponent, FindBarComponent, PageStateComponent, PaneToolbarComponent, RequestNoticeComponent],
  templateUrl: "./page.component.html",
  styleUrl: "./page.component.css",
  host: {
    "class": "nol-browser-page",
    "[attr.data-instance]": "instance()",
    "(keydown)": "pressKey($event)"
  }
})
export class PageComponent {
  private static count: number = 0;
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly injector: Injector = inject(Injector);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly pages: Pages = Pages.of(this.context);
  private readonly version: WritableSignal<number> = signal(0);
  private readonly view: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("view");
  private readonly toolbar: Signal<PaneToolbarComponent | undefined> = viewChild(PaneToolbarComponent);
  private readonly findBar: Signal<FindBarComponent | undefined> = viewChild(FindBarComponent);
  private readonly platform: string = PageKeys.platformOf(navigator.platform);
  private tracker: PlaceholderTracker | null = null;
  private trackedView: IWebViewHandle | null = null;
  private markLayer: MarkLayer | null = null;
  private isDestroyed: boolean = false;
  private readonly isMarked: Signal<boolean> = computed(() => this.mark() !== null);
  private readonly zoom: WritableSignal<number> = signal(1);

  protected readonly pageId: string = `${Resources.pageId}${PageComponent.count++}`;
  protected readonly appName: Signal<string | null> = this.pages.appName;
  protected readonly noticeId: string = `${this.pageId}${Resources.noticeId}`;
  protected readonly stateHeadingId: string = `${this.pageId}${Resources.stateHeadingId}`;
  protected readonly tab: WritableSignal<PaneTab | null> = signal(null);
  protected readonly isForgotten: WritableSignal<boolean> = signal(false);
  protected readonly isFinding: WritableSignal<boolean> = signal(false);
  protected readonly isElsewhere: Signal<boolean> = computed(() => this.pages.elsewhere().has(this.instance()));
  protected readonly placedTab: Signal<PaneTab | null> = computed(() => {
    const tab = this.tab();
    this.version();
    return tab !== null && tab.view !== null && tab.showsPage && this.refusal() === null ? tab : null;
  });
  protected readonly refusal: Signal<RefusedPage | null> = computed(() => this.pages.refusals().get(this.instance()) ?? null);
  protected readonly refusedAddress: Signal<string | null> = computed(() => this.refusal()?.url ?? null);
  protected readonly isLoading: Signal<boolean> = computed(() => {
    const tab = this.tab();
    this.version();
    return tab?.controller.status.state === PaneState.Loading;
  });
  protected readonly openLink: (url: string) => Promise<void> = url => this.context.openLinkAsync(url, { place: LinkPlace.System });
  protected readonly activity: Signal<PageActivity | null> = computed(() => {
    const tab = this.tab();
    this.version();
    const activity: PageActivity | undefined = this.pages.activities().get(this.instance());
    return tab === null || activity === undefined ? null : activity;
  });
  protected readonly mark: Signal<PageActivity | null> = computed(() => {
    const tab = this.placedTab();
    this.version();
    if (tab === null)
      return null;
    const activity: PageActivity | undefined = this.pages.activities().get(this.instance());
    return activity !== undefined && (activity.action === PageAction.Clicking || activity.action === PageAction.Typing) && activity.box !== null ? activity : null;
  });

  public readonly instance = input.required<string>();
  public readonly title = input<string>("");

  public constructor() {
    inject(Announcer);
    this.destroyRef.onDestroy(() => {
      this.isDestroyed = true;
      this.release();
      const tab = this.tab();
      if (tab !== null)
        this.pages.release(tab);
    });
    effect(() => {
      const instance = this.instance();
      untracked(() => this.show(instance));
    });
    let wasElsewhere: boolean = false;
    effect(() => {
      const isElsewhere: boolean = this.isElsewhere();
      untracked(() => {
        if (isElsewhere)
          this.tab.set(null);
        else if (wasElsewhere) {
          this.isForgotten.set(false);
          this.show(this.instance());
        }
        wasElsewhere = isElsewhere;
      });
    });
    effect(onCleanup => {
      const tab = this.tab();
      if (tab !== null)
        onCleanup(tab.controller.onChange(() => this.version.update(t => t + 1)));
    });
    effect(onCleanup => {
      const tab = this.tab();
      if (tab === null)
        return;
      this.zoom.set(tab.controller.zoom);
      onCleanup(tab.controller.onZoom(t => this.zoom.set(t)));
    });
    effect(onCleanup => {
      const tab = this.tab();
      if (tab !== null)
        onCleanup(tab.controller.onKey(t => untracked(() => this.runKey(tab, t.name))));
    });
    effect(() => {
      if (this.placedTab() !== null && this.host.querySelector(Resources.pageStateSelector)?.contains(this.host.ownerDocument.activeElement) === true)
        untracked(() => this.focusToolbar());
    });
    effect(() => {
      const activity: PageActivity | null = this.activity();
      if ((activity === null || activity.state === PageActivityState.Asking)
        && this.host.querySelector(Resources.agentBarSelector)?.contains(this.host.ownerDocument.activeElement) === true)
        untracked(() => this.focusToolbar());
    });
    effect(onCleanup => {
      const isMarked: boolean = this.isMarked();
      const view: IWebViewHandle | null = this.placedTab()?.view ?? null;
      const mark: PageActivity | null = untracked(() => this.mark());
      if (!isMarked || view === null || mark === null)
        return;
      const layer: MarkLayer = MarkLayer.open(view, mark, untracked(() => this.zoom()), error => this.errors.handleError(error));
      this.markLayer = layer;
      onCleanup(() => {
        layer.close();
        this.markLayer = null;
      });
    });
    effect(() => {
      const mark: PageActivity | null = this.mark();
      const zoom: number = this.zoom();
      if (mark !== null)
        untracked(() => this.markLayer?.update(mark, zoom));
    });
    afterRenderEffect(() => {
      this.version();
      const view: IWebViewHandle | null = this.tab()?.view ?? null;
      const isPlaced: boolean = this.placedTab() !== null;
      if (view !== this.trackedView) {
        this.release();
        this.trackedView = view;
        if (view !== null)
          this.tracker = new PlaceholderTracker(this.view().nativeElement, view);
      }
      this.tracker?.place(isPlaced);
    });
  }

  protected pressKey(event: KeyboardEvent): void {
    const tab = this.tab();
    if (tab === null || event.defaultPrevented || event.isComposing || event.repeat)
      return;
    const name: string | null = PageKeys.nameOf(event, this.platform);
    if (name !== null) {
      event.preventDefault();
      this.runKey(tab, name);
    }
    else if (event.key === Resources.escapeKey && !(event.target instanceof HTMLInputElement) && this.toolbar()?.stopPage() === true)
      event.preventDefault();
  }

  protected focusToolbar(): void {
    this.toolbar()?.focusReload();
  }

  protected openFind(tab: PaneTab): void {
    const state: PaneState = tab.controller.status.state;
    if (state === PaneState.Empty || state === PaneState.Unavailable)
      return;
    const bar: FindBarComponent | undefined = this.findBar();
    if (bar === undefined)
      this.isFinding.set(true);
    else
      bar.focus();
  }

  protected closeFind(): void {
    this.isFinding.set(false);
    this.focusToolbar();
  }

  protected goTo(tab: PaneTab, text: string): void {
    this.pages.goToAsync(tab, text).then(answer => {
      if (answer === EntryAnswer.Gone)
        this.toolbar()?.followPage(tab.controller);
      else if (answer === EntryAnswer.Refused)
        this.toolbar()?.markRefused(tab.controller);
    }).catch((error: unknown) => this.errors.handleError(error));
  }

  protected leaveEntry(tab: PaneTab): void {
    this.pages.leaveEntry(tab);
  }

  protected openPopup(tab: PaneTab, url: string): void {
    this.pages.openPopup(tab, url);
  }

  protected openExternal(url: string): void {
    this.context.openLinkAsync(url, { place: LinkPlace.System }).catch((error: unknown) => this.errors.handleError(error));
  }

  protected answerRefusal(tab: PaneTab, url: string | null): void {
    this.pages.dismissRefusal(this.instance());
    this.focusToolbar();
    if (url !== null)
      this.goTo(tab, url);
  }

  protected stopAgent(isTakingOver: boolean): void {
    this.pages.stop(this.instance(), isTakingOver);
  }

  protected clearBrowsingData(tab: PaneTab): void {
    const dialog = this.dialogs.open(ClearDataDialogComponent, Resources.clearDataInitialFocus);
    const stop: () => void = this.destroyRef.onDestroy(() => dialog.close());
    dialog.closed.subscribe(() => stop());
    dialog.componentInstance?.answered.subscribe(isCleared => {
      dialog.close();
      if (isCleared)
        this.pages.clearBrowsingDataAsync(tab).catch((error: unknown) => this.errors.handleError(error));
    });
  }

  protected close(): void {
    this.context.closeDocument(Resources.pageDocument, this.instance());
  }

  private show(instance: string): void {
    this.pages.showAsync(instance).then(tab => {
      if (tab === null)
        this.isForgotten.set(!this.isDestroyed);
      else if (this.isDestroyed)
        this.pages.release(tab);
      else {
        this.tab.set(tab);
        if (tab.controller.status.state === PaneState.Empty)
          afterNextRender(() => this.toolbar()?.focusAddress(), { injector: this.injector });
      }
    }).catch((error: unknown) => {
      // A page whose record can't be read can't open again, as one with no record can't.
      this.isForgotten.set(!this.isDestroyed);
      this.errors.handleError(error);
    });
  }

  private runKey(tab: PaneTab, name: string): void {
    if (name === Resources.reloadKey)
      this.toolbar()?.reloadPage();
    else if (name === Resources.newPageKey)
      this.pages.openNew(tab);
    else if (name === Resources.focusAddressKey)
      this.toolbar()?.focusAddress();
    else if (name === Resources.findKey)
      this.openFind(tab);
  }

  private release(): void {
    this.tracker?.dispose();
    this.tracker = null;
    this.trackedView = null;
  }
}
