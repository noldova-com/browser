/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ApplicationRef, type ComponentRef, EnvironmentInjector, type Type, createComponent } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { QualifiedName, WebViewEvent, WebViewEventKind, WebViewNavigation, WebViewNavigationKind, WebViewPane } from "@noldova/desktop.protocol";
import type { IWebViewFound, IWebViewHandle, IWebViewLayer } from "@noldova/desktop.window";
import { FakeWindowWebViews } from "@noldova/desktop.window/testing";

import { ViewEventKind } from "../../src/app/enums/view-event-kind.ts";
import { ViewCloseEvent } from "../../src/app/models/view-close-event.ts";
import { ViewCrashEvent } from "../../src/app/models/view-crash-event.ts";
import type { ViewEvent } from "../../src/app/models/view-event.ts";
import { ViewLoadFailureEvent } from "../../src/app/models/view-load-failure-event.ts";
import { ViewRefusalEvent } from "../../src/app/models/view-refusal-event.ts";
import { ViewRequestRefusalEvent } from "../../src/app/models/view-request-refusal-event.ts";
import { ViewStateEvent } from "../../src/app/models/view-state-event.ts";
import { ViewZoomEvent } from "../../src/app/models/view-zoom-event.ts";
import { Resources } from "../../src/resources.ts";

export type NavigationScript =
  | { readonly kind: "load"; readonly title: string }
  | { readonly kind: "redirect"; readonly to: string; readonly title: string; readonly isRefused?: boolean }
  | { readonly kind: "pending" }
  | { readonly kind: "refuse" }
  | { readonly kind: "fail"; readonly code: number; readonly description: string };

type WebViewDetails = ConstructorParameters<typeof WebViewEvent>[3];

export class WebViewValues {
  public static readonly started: WebViewNavigation = new WebViewNavigation(WebViewNavigationKind.Started);
  public static readonly noHistory: WebViewNavigation = new WebViewNavigation(WebViewNavigationKind.NoHistory);
  public static readonly page: WebViewPane = WebViewValues.pane("browser.page");

  public static refused(origin: string): WebViewNavigation {
    return new WebViewNavigation(WebViewNavigationKind.Refused, origin);
  }

  public static pane(name: string, instance: string | null = null): WebViewPane {
    return new WebViewPane(QualifiedName.parse(name), instance);
  }
}

export class FakeWebView implements IWebViewHandle {
  private static readonly MODULE: string = "browser";
  private static readonly CLOSED: string = "The web view is closed.";
  private static readonly KINDS: Readonly<Record<ViewEvent["kind"], WebViewEventKind>> = {
    [ViewEventKind.Closed]: WebViewEventKind.Closed,
    [ViewEventKind.Crashed]: WebViewEventKind.Crashed,
    [ViewEventKind.State]: WebViewEventKind.State,
    [ViewEventKind.LoadFailed]: WebViewEventKind.LoadFailed,
    [ViewEventKind.NavigationRefused]: WebViewEventKind.NavigationRefused,
    [ViewEventKind.ProfileCleared]: WebViewEventKind.ProfileCleared,
    [ViewEventKind.RequestRefused]: WebViewEventKind.RequestRefused,
    [ViewEventKind.NewWindowRequested]: WebViewEventKind.NewWindowRequested,
    [ViewEventKind.Key]: WebViewEventKind.Key,
    [ViewEventKind.Zoom]: WebViewEventKind.Zoom
  };
  private static readonly LEAST_ZOOM: number = 0.25;
  private static readonly GREATEST_ZOOM: number = 5;
  private static readonly ZOOM_STEPS: readonly number[] = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];

  private readonly scripts: Map<string, NavigationScript>;
  private readonly listeners: Set<(event: WebViewEvent) => void> = new Set<(event: WebViewEvent) => void>();
  private readonly history: string[] = [];
  private index: number = -1;
  private current: ViewStateEvent = new ViewStateEvent("", "", false, false, false);
  private failure: Error | null = null;
  private readonly unmountedNavigations: (() => void)[] = [];
  private factor: number = 1;
  private isCrashed: boolean = false;

  public readonly id: string;
  public readonly pane: WebViewPane;
  public readonly profileKey: string;
  public readonly calls: string[] = [];
  public readonly element: HTMLElement = FakeWebView.createElement();
  public host: HTMLElement | null = null;
  public isShown: boolean = false;
  public isClosed: boolean = false;
  public findAnswer: (call: string) => Promise<IWebViewFound> = () => Promise.resolve(FakeWebView.found(0, 0));
  public layerFailure: Error | null = null;
  public layersOpened: number = 0;
  public layerElement: HTMLElement | null = null;
  public lastLayer: ComponentRef<unknown> | null = null;
  private closeLayer: (() => void) | null = null;

  public constructor(id: string, pane: WebViewPane, profileKey: string, scripts: Map<string, NavigationScript>) {
    this.id = id;
    this.pane = pane;
    this.profileKey = profileKey;
    this.scripts = scripts;
  }

  public async getZoomAsync(): Promise<number> {
    this.record("getZoom");
    return this.factor;
  }

  public async setZoomAsync(factor: number): Promise<number> {
    this.record(`setZoom ${String(factor)}`);
    return this.takeZoom(factor);
  }

  public async zoomInAsync(): Promise<number> {
    this.record("zoomIn");
    return this.takeZoom(FakeWebView.ZOOM_STEPS.find(t => t > this.factor) ?? this.factor);
  }

  public async zoomOutAsync(): Promise<number> {
    this.record("zoomOut");
    return this.takeZoom(FakeWebView.ZOOM_STEPS.findLast(t => t < this.factor) ?? this.factor);
  }

  public static found(active: number, matches: number, isTimedOut: boolean = false, isEnded: boolean = false): IWebViewFound {
    return { matches, active, isTimedOut, isEnded };
  }

  public async findAsync(text: string): Promise<IWebViewFound> {
    const call: string = `find ${text}`;
    this.record(call);
    return this.findAnswer(call);
  }

  public async findNextAsync(): Promise<IWebViewFound> {
    this.record("findNext");
    return this.findAnswer("findNext");
  }

  public async findPreviousAsync(): Promise<IWebViewFound> {
    this.record("findPrevious");
    return this.findAnswer("findPrevious");
  }

  public endFind(): void {
    this.record("endFind");
  }

  public failNextCall(error: Error): void {
    this.failure = error;
  }

  public emit(event: ViewEvent): void {
    const { kind, ...details } = event;
    const written: WebViewDetails = event instanceof ViewRequestRefusalEvent ? { ...details, request: Resources.refusedRequestNames[event.request] } : details;
    this.send(new WebViewEvent(FakeWebView.MODULE, this.id, FakeWebView.KINDS[kind], written));
  }

  public emitOther(kind: WebViewEventKind, details: WebViewDetails): void {
    this.send(new WebViewEvent(FakeWebView.MODULE, this.id, kind, details));
  }

  public send(event: WebViewEvent): void {
    for (const listener of [...this.listeners])
      listener(event);
  }

  // Crashes the page, which, as in Noldova Desktop, answers a reload with no history until a navigation or a move brings it back.
  public crash(): void {
    this.isCrashed = true;
    this.emit(new ViewCrashEvent());
  }

  public mount(host: HTMLElement): void {
    if (this.isClosed)
      return;
    this.record("mount");
    host.append(this.element);
    this.host = host;
    for (const resume of this.unmountedNavigations.splice(0))
      resume();
  }

  public async openLayerAsync<T>(load: () => Promise<Type<T>>): Promise<IWebViewLayer<T>> {
    const type: Type<T> = await load();
    if (this.isClosed)
      throw new Error(FakeWebView.CLOSED);
    if (this.layerFailure !== null)
      throw this.layerFailure;
    this.closeLayer?.();
    const element: HTMLElement = document.createElement("div");
    element.className = "fake-web-view-layer";
    element.style.position = "absolute";
    element.style.inset = "0";
    element.style.pointerEvents = "none";
    this.element.append(element);
    const componentRef: ComponentRef<T> = createComponent(type, { environmentInjector: TestBed.inject(EnvironmentInjector) });
    element.append(componentRef.location.nativeElement);
    const application: ApplicationRef = TestBed.inject(ApplicationRef);
    application.attachView(componentRef.hostView);
    const closed: PromiseWithResolvers<void> = Promise.withResolvers<void>();
    const close = (): void => {
      if (this.closeLayer !== close)
        return;
      this.closeLayer = null;
      this.layerElement = null;
      application.detachView(componentRef.hostView);
      componentRef.destroy();
      element.remove();
      closed.resolve();
    };
    this.closeLayer = close;
    this.layerElement = element;
    this.lastLayer = componentRef;
    this.layersOpened++;
    return { componentRef, closed: closed.promise, close };
  }

  public show(): void {
    this.setShown(true);
  }

  public hide(): void {
    this.setShown(false);
  }

  public async navigateAsync(url: string): Promise<WebViewNavigation> {
    this.record(`navigate ${url}`);
    if (this.host === null)
      await new Promise<void>(resolve => this.unmountedNavigations.push(resolve));
    if (this.isClosed)
      throw new Error(FakeWebView.CLOSED);
    const script: NavigationScript = this.scripts.get(url) ?? { kind: "load", title: "" };
    this.isCrashed &&= script.kind === "refuse";
    switch (script.kind) {
      case "refuse":
        return WebViewValues.refused(new URL(url).origin);
      case "fail":
        this.change({ address: url, isLoading: true });
        this.emit(new ViewLoadFailureEvent(url, script.code, script.description));
        this.change({ isLoading: false });
        return WebViewValues.started;
      case "pending":
        this.push(url);
        this.change({ ...this.place(url), title: "", isLoading: true });
        return WebViewValues.started;
      case "load":
        this.commit(url, script.title);
        return WebViewValues.started;
      case "redirect":
        if (script.isRefused === true || this.scripts.get(script.to)?.kind === "refuse")
          this.refuseRedirect(url, script.to);
        else
          this.commit(script.to, script.title, url);
        return WebViewValues.started;
    }
  }

  public async goBackAsync(): Promise<WebViewNavigation> {
    this.record("back");
    this.refuseUnmounted();
    return this.move(-1);
  }

  public async goForwardAsync(): Promise<WebViewNavigation> {
    this.record("forward");
    this.refuseUnmounted();
    return this.move(1);
  }

  public async reloadAsync(): Promise<WebViewNavigation> {
    this.record("reload");
    this.refuseUnmounted();
    return this.isCrashed ? WebViewValues.noHistory : this.move(0);
  }

  public async stopAsync(): Promise<WebViewNavigation> {
    this.record("stop");
    this.refuseUnmounted();
    if (this.index < 0)
      return WebViewValues.noHistory;
    this.change({ isLoading: false });
    return WebViewValues.started;
  }

  public subscribe(listener: (event: WebViewEvent) => void): () => void {
    const subscription: (event: WebViewEvent) => void = t => listener(t);
    this.listeners.add(subscription);
    return () => this.listeners.delete(subscription);
  }

  public closeFromHost(): void {
    if (this.isClosed)
      return;
    this.closeLayer?.();
    this.emit(new ViewCloseEvent());
    this.end();
  }

  public close(): void {
    if (this.isClosed)
      return;
    this.calls.push("close");
    this.closeLayer?.();
    this.end();
  }

  private static createElement(): HTMLElement {
    const element: HTMLElement = document.createElement("div");
    element.className = "fake-web-view";
    element.style.position = "absolute";
    element.style.inset = "0";
    element.style.visibility = "hidden";
    return element;
  }

  private setShown(isShown: boolean): void {
    if (this.isClosed)
      return;
    this.record(isShown ? "show" : "hide");
    this.isShown = isShown;
    this.element.style.visibility = isShown ? "visible" : "hidden";
  }

  private end(): void {
    this.isClosed = true;
    this.isShown = false;
    this.listeners.clear();
    this.element.remove();
    for (const resume of this.unmountedNavigations.splice(0))
      resume();
  }

  private refuseUnmounted(): void {
    if (this.host === null)
      throw new Error(FakeWebView.CLOSED);
  }

  private takeZoom(factor: number): number {
    const target: number = Math.min(Math.max(factor, FakeWebView.LEAST_ZOOM), FakeWebView.GREATEST_ZOOM);
    if (target !== this.factor) {
      this.factor = target;
      this.emit(new ViewZoomEvent(target));
    }
    return this.factor;
  }

  private record(call: string): void {
    if (this.isClosed)
      throw new Error(`The view is closed, so "${call}" was refused.`);
    if (this.failure !== null) {
      const failure: Error = this.failure;
      this.failure = null;
      throw failure;
    }
    this.calls.push(call);
  }

  private commit(url: string, title: string, start: string = url): void {
    this.change({ address: start, isLoading: true });
    this.push(url);
    this.change({ ...this.place(url), title, isLoading: false });
  }

  private refuseRedirect(url: string, to: string): void {
    this.change({ address: url, isLoading: true });
    this.emit(new ViewRefusalEvent(to, new URL(to).origin, true));
    this.emit(new ViewLoadFailureEvent(to, -20, "ERR_BLOCKED_BY_CLIENT"));
    this.change({ address: this.history[this.index] ?? "", isLoading: false });
  }

  private move(step: number): WebViewNavigation {
    const url: string | undefined = this.history[this.index + step];
    if (url === undefined)
      return WebViewValues.noHistory;
    if (this.scripts.get(url)?.kind === "refuse")
      return WebViewValues.refused(new URL(url).origin);
    this.isCrashed = false;
    this.index += step;
    this.change({ ...this.place(url), isLoading: true });
    this.change({ isLoading: false });
    return WebViewValues.started;
  }

  private push(url: string): void {
    this.history.splice(this.index + 1, this.history.length, url);
    this.index = this.history.length - 1;
  }

  private place(url: string): Pick<ViewStateEvent, "address" | "canGoBack" | "canGoForward"> {
    return { address: url, canGoBack: this.index > 0, canGoForward: this.index < this.history.length - 1 };
  }

  private change(values: Partial<Omit<ViewStateEvent, "kind">>): void {
    const { address, title, isLoading, canGoBack, canGoForward } = this.current;
    const next: ViewStateEvent = new ViewStateEvent(values.address ?? address, values.title ?? title, values.isLoading ?? isLoading, values.canGoBack ?? canGoBack,
      values.canGoForward ?? canGoForward);
    if (next.address === address && next.title === title && next.isLoading === isLoading && next.canGoBack === canGoBack && next.canGoForward === canGoForward)
      return;
    this.current = next;
    this.emit(next);
  }
}

export class FakeWebViews {
  public readonly webViews: FakeWindowWebViews = new FakeWindowWebViews();
  private readonly scripts: Map<string, NavigationScript> = new Map<string, NavigationScript>();
  private refusal: Error | null = null;
  private held: Promise<void> | null = null;

  public readonly views: FakeWebView[] = [];
  public readonly names: (string | null)[] = [];

  public constructor() {
    this.webViews.answer("openAsync", (pane, profileKey, options) => {
      this.names.push(options?.name ?? null);
      return this.openAsync(pane, profileKey);
    });
  }

  public script(url: string, script: NavigationScript): void {
    this.scripts.set(url, script);
  }

  public refuseNextOpen(error: Error): void {
    this.refusal = error;
  }

  public holdNextOpen(): () => void {
    const { promise, resolve } = Promise.withResolvers<void>();
    this.held = promise;
    return resolve;
  }

  public async openAsync(pane: WebViewPane, profileKey: string): Promise<IWebViewHandle> {
    const held: Promise<void> | null = this.held;
    this.held = null;
    if (held !== null)
      await held;
    return this.create(profileKey, pane);
  }

  public open(profileKey: string, pane: WebViewPane = WebViewValues.page): FakeWebView {
    const view: FakeWebView = this.create(profileKey, pane);
    view.mount(document.createElement("div"));
    view.calls.splice(0);
    return view;
  }

  private create(profileKey: string, pane: WebViewPane): FakeWebView {
    if (this.refusal !== null) {
      const refusal: Error = this.refusal;
      this.refusal = null;
      throw refusal;
    }
    const view: FakeWebView = new FakeWebView(`view-${this.views.length + 1}`, pane, profileKey, this.scripts);
    this.views.push(view);
    return view;
  }
}
