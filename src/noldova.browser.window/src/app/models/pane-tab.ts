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
  public readonly id: string;
  public readonly view: IWebViewHandle | null;
  public readonly controller: PaneController;

  public constructor(id: string, view: IWebViewHandle | null) {
    this.id = id;
    this.view = view;
    this.controller = new PaneController(view);
  }

  // Noldova Desktop starts each new view at about:blank, and the window part may or may not hear that start, so about:blank is no page.
  public get title(): string {
    const status = this.controller.status;
    const url: string = status.url === Resources.blankPage ? "" : status.url;
    return status.title !== "" ? status.title : url !== "" ? url : Resources.newTab;
  }

  public get showsPage(): boolean {
    const state = this.controller.status.state;
    return state === PaneState.Loading || state === PaneState.Loaded;
  }
}
