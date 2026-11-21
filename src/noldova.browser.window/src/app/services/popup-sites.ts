/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowPartContext } from "@noldova/desktop.window";

import { Resources } from "../../resources.ts";
import { SiteList } from "../models/site-list.ts";
import { SiteSetting } from "./site-setting.ts";

export class PopupSites {
  private readonly context: IWindowPartContext;
  private readonly setting: SiteSetting;

  public constructor(context: IWindowPartContext) {
    this.context = context;
    this.setting = new SiteSetting(context, Resources.popupSitesSetting, t => Resources.formatIgnoredPopupSites(t));
  }

  public allows(url: string): boolean {
    return this.setting.read().matches(url);
  }

  public allowAsync(url: string): Promise<void> {
    const site: string | null = SiteList.siteOf(url);
    return site === null ? Promise.resolve() : this.context.writeSettingAsync(Resources.popupSitesSetting, SiteList.append(this.setting.readText(), site));
  }
}
