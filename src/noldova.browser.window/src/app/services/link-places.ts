/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IWindowPartContext, LinkPlace } from "@noldova/desktop.window";
import { LinkGesture } from "@noldova/ui.components.angular";

import { Resources } from "../../resources.ts";
import { SiteList } from "../models/site-list.ts";
import { SiteSetting } from "./site-setting.ts";

export class LinkPlaces {
  private readonly context: IWindowPartContext;
  private readonly sites: SiteSetting;

  public constructor(context: IWindowPartContext) {
    this.context = context;
    this.sites = new SiteSetting(context, Resources.systemSitesSetting, t => Resources.formatIgnoredSites(t));
  }

  public static checkSites(text: string): string | null {
    const entries: readonly string[] = SiteList.read(text).ignoredEntries;
    return entries.length === 0 ? null : Resources.formatRefusedSites(entries);
  }

  public placeFor(url: string, gesture: LinkGesture): LinkPlace {
    if (this.sites.read().matches(url))
      return LinkPlace.System;
    const click: LinkPlace = this.context.readSetting(Resources.linkClickSetting) === LinkPlace.System ? LinkPlace.System : LinkPlace.InApp;
    const other: LinkPlace = click === LinkPlace.InApp ? LinkPlace.System : LinkPlace.InApp;
    switch (gesture) {
      case LinkGesture.Plain:
        return click;
      case LinkGesture.Modified:
        return other;
      case LinkGesture.Middle:
        return this.context.readSetting(Resources.linkMiddleClickSetting) === LinkGesture.Plain ? click : other;
    }
  }
}
