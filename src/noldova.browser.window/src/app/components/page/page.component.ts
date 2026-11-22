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
import type { OpenedPage } from "../../models/opened-page.ts";
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
  private readonly pageState: Signal<PageStateComponent | undefined> = viewChild(PageStateComponent);
  private readonly platform: string = PageKeys.platformOf(navigator.platform);
  private tracker: PlaceholderTracker | null = null;
  private trackedView: IWebViewHandle | null = null;
  private markLayer: MarkLayer | null = null;
  private isDestroyed: boolean = false;
  private readonly isMarked: Signal<boolean> = computed(() => !Object.isNull(this.mark()));
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
    return !Object.isNull(tab) && !Object.isNull(tab.view) && tab.showsPage && Object.isNull(this.refusal()) ? tab : null;
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
    return Object.isNull(tab) || Object.isUndefined(activity) ? null : activity;
  });
  protected readonly mark: Signal<PageActivity | null> = computed(() => {
    const tab = this.placedTab();
    this.version();
    if (Object.isNull(tab))
      return null;
    const activity: PageActivity | undefined = this.pages.activities().get(this.instance());
    return !Object.isUndefined(activity) && (activity.action === PageAction.Clicking || activity.action === PageAction.Typing) && !Object.isNull(activity.box) ? activity : null;
  });

  public readonly instance = input.required<string>();
  public readonly title = input<string>("");

  public constructor() {
    inject(Announcer);
    this.destroyRef.onDestroy(() => {
      this.isDestroyed = true;
      this.release();
      const tab = this.tab();
      if (!Object.isNull(tab))
        this.pages.release(tab);
    });
    effect(() => {
      const instance = this.instance();
      untracked(() => this.show(instance));
    });
    // Noldova Desktop brings an open document forward rather than creating it again, so a page opened again under the instance of a tab that
    // couldn't open shows here.
    effect(() => {
      const opened: OpenedPage | null = this.pages.opened();
      untracked(() => {
        if (opened?.instance === this.instance() && this.isForgotten()) {
          this.isForgotten.set(false);
          this.show(opened.instance);
        }
      });
    });
    let wasElsewhere: boolean = false;
    effect(() => {
      const isElsewhere: boolean = this.isElsewhere();
      untracked(() => {
        if (isElsewhere) {
          const hadFocus: boolean = this.host.contains(this.host.ownerDocument.activeElement);
          this.isFinding.set(false);
          this.tab.set(null);
          if (hadFocus)
            afterNextRender(() => this.pageState()?.focusClose(), { injector: this.injector });
        } else if (wasElsewhere) {
          this.isForgotten.set(false);
          this.show(this.instance());
        }
        wasElsewhere = isElsewhere;
      });
    });
    effect(onCleanup => {
      const tab = this.tab();
      if (!Object.isNull(tab))
        onCleanup(tab.controller.onChange(() => this.version.update(t => t + 1)));
    });
    effect(() => {
      const tab = this.tab();
      this.version();
      if (!Object.isNull(tab) && !Resources.findableStates.includes(tab.controller.status.state) && this.isFinding())
        untracked(() => this.dropFind());
    });
    effect(onCleanup => {
      const tab = this.tab();
      if (Object.isNull(tab))
        return;
      this.zoom.set(tab.controller.zoom);
      onCleanup(tab.controller.onZoom(t => this.zoom.set(t)));
    });
    effect(onCleanup => {
      const tab = this.tab();
      if (!Object.isNull(tab))
        onCleanup(tab.controller.onKey(t => untracked(() => this.runKey(tab, t.name))));
    });
    effect(() => {
      if (!Object.isNull(this.placedTab()) && this.host.querySelector(Resources.pageStateSelector)?.contains(this.host.ownerDocument.activeElement) === true)
        untracked(() => this.focusToolbar());
    });
    effect(() => {
      const activity: PageActivity | null = this.activity();
      if ((Object.isNull(activity) || activity.state === PageActivityState.Asking)
        && this.host.querySelector(Resources.agentBarSelector)?.contains(this.host.ownerDocument.activeElement) === true)
        untracked(() => this.focusToolbar());
    });
    effect(onCleanup => {
      const isMarked: boolean = this.isMarked();
      const view: IWebViewHandle | null = this.placedTab()?.view ?? null;
      const mark: PageActivity | null = untracked(() => this.mark());
      if (!isMarked || Object.isNull(view) || Object.isNull(mark))
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
      if (!Object.isNull(mark))
        untracked(() => this.markLayer?.update(mark, zoom));
    });
    afterRenderEffect(() => {
      this.version();
      const view: IWebViewHandle | null = this.tab()?.view ?? null;
      const isPlaced: boolean = !Object.isNull(this.placedTab());
      if (view !== this.trackedView) {
        this.release();
        this.trackedView = view;
        if (!Object.isNull(view))
          this.tracker = new PlaceholderTracker(this.view().nativeElement, view);
      }
      this.tracker?.place(isPlaced);
    });
  }

  protected pressKey(event: KeyboardEvent): void {
    const tab = this.tab();
    if (Object.isNull(tab) || event.defaultPrevented || event.isComposing || event.repeat)
      return;
    const name: string | null = PageKeys.nameOf(event, this.platform);
    if (!Object.isNull(name)) {
      event.preventDefault();
      this.runKey(tab, name);
    }
    else if (event.key === Resources.escapeKey && ![...this.host.querySelectorAll(Resources.inputSelector)].some(t => t === event.target) && this.toolbar()?.stopPage() === true)
      event.preventDefault();
  }

  protected focusToolbar(): void {
    this.toolbar()?.focusReload();
  }

  protected openFind(tab: PaneTab): void {
    if (!Resources.findableStates.includes(tab.controller.status.state))
      return;
    const bar: FindBarComponent | undefined = this.findBar();
    if (Object.isUndefined(bar))
      this.isFinding.set(true);
    else
      bar.focus();
  }

  protected closeFind(): void {
    this.isFinding.set(false);
    this.focusToolbar();
  }

  // The bar goes once its page no longer has a document to find on, and gives Reload the focus it held.
  private dropFind(): void {
    const hadFocus: boolean = this.host.querySelector(Resources.findBarSelector)?.contains(this.host.ownerDocument.activeElement) === true;
    this.isFinding.set(false);
    if (hadFocus)
      this.focusToolbar();
  }

  protected goTo(tab: PaneTab, text: string): void {
    this.pages.goToAsync(tab, text).then(answer => {
      if (answer === EntryAnswer.Gone || answer === EntryAnswer.Left)
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
    this.focusToolbarAfterSign();
  }

  protected allowPopups(tab: PaneTab, url: string): void {
    this.pages.allowPopups(tab, url);
    this.focusToolbarAfterSign();
  }

  // The sign's menu gives the focus back to the sign as it closes, and the sign goes with its pop-up once the toolbar renders.
  private focusToolbarAfterSign(): void {
    afterNextRender(() => this.focusToolbar(), { injector: this.injector });
  }

  protected openExternal(url: string): void {
    this.context.openLinkAsync(url, { place: LinkPlace.System }).catch((error: unknown) => this.errors.handleError(error));
  }

  protected answerRefusal(tab: PaneTab, url: string | null): void {
    this.pages.dismissRefusal(this.instance());
    this.focusToolbar();
    if (!Object.isNull(url))
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
      if (Object.isNull(tab))
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
    else if (name === Resources.stopKey)
      this.toolbar()?.stopPage();
  }

  private release(): void {
    this.tracker?.dispose();
    this.tracker = null;
    this.trackedView = null;
  }
}
