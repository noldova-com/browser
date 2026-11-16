/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterNextRender, Component, DestroyRef, type ElementRef, inject, input, type InputSignal, type Signal, viewChild } from "@angular/core";

import { QualifiedName, WebViewPane } from "@noldova/desktop.protocol";
import { type IWebViewHandle, type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";

@Component({
  selector: "nol-relay-double-page",
  template: "<div #content class=\"content\"></div>",
  styles: ":host { display: block; position: relative; height: 100%; } .content { position: absolute; inset: 0; }"
})
export class RelayPageComponent {
  private static readonly PANE: string = "relay-double.page";
  private static readonly PROFILE_KEY: string = "relay-double";

  public readonly instance: InputSignal<string> = input.required<string>();
  public readonly title: InputSignal<string> = input.required<string>();

  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly content: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("content");
  private handle: IWebViewHandle | null = null;
  private isClosed: boolean = false;

  public constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.isClosed = true;
      this.handle?.close();
      this.handle = null;
    });
    afterNextRender(() => {
      this.openAsync().catch((error: unknown) => console.error(`The relay double's web view didn't open: ${String(error)}`));
    });
  }

  private async openAsync(): Promise<void> {
    const handle = await this.context.webViews.openAsync(new WebViewPane(QualifiedName.parse(RelayPageComponent.PANE), this.instance()), RelayPageComponent.PROFILE_KEY);
    if (this.isClosed) {
      handle.close();
      return;
    }
    this.handle = handle;
    handle.mount(this.content().nativeElement);
    handle.show();
  }
}
