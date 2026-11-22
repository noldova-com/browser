/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWebViewHandle } from "@noldova/desktop.window";

import { Resources } from "../../resources.ts";
import { PaneState } from "../enums/pane-state.ts";
import { PaneController } from "../services/pane-controller.ts";

export class PaneTab {
  private static readonly SCHEME: RegExp = /^https?:\/\//u;
  private static readonly TRAILING_SLASH: RegExp = /\/$/u;

  public readonly id: string;
  public readonly view: IWebViewHandle | null;
  public readonly controller: PaneController;

  public constructor(id: string, view: IWebViewHandle | null) {
    this.id = id;
    this.view = view;
    this.controller = new PaneController(view);
  }

  public get title(): string {
    const status = this.controller.status;
    return !String.isNullOrEmpty(status.title) ? status.title : !String.isNullOrEmpty(status.url) ? status.url : Resources.newTab;
  }

  public get settledTitle(): string | null {
    const status = this.controller.status;
    const isLoading: boolean = status.state === PaneState.Loading;
    const isUntitled: boolean = String.isNullOrEmpty(status.title) || (isLoading && PaneTab.isAddressShown(status.title, status.url));
    return isUntitled && (isLoading || String.isNullOrEmpty(status.url)) ? null : this.title;
  }

  private static isAddressShown(title: string, address: string): boolean {
    const shown: string = address.replace(PaneTab.SCHEME, "");
    return [address, address.replace(PaneTab.TRAILING_SLASH, ""), shown, shown.replace(PaneTab.TRAILING_SLASH, "")].includes(title);
  }

  public get showsPage(): boolean {
    const state = this.controller.status.state;
    return state === PaneState.Loading || state === PaneState.Loaded;
  }
}
