/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { type IWindowPartContext, LinkPlace } from "@noldova/desktop.window";
import { LinkGesture } from "@noldova/ui.components.angular";

import { Resources } from "../../resources.ts";
import { SiteList } from "../models/site-list.ts";

export class LinkPlaces {
  private readonly context: IWindowPartContext;
  private sitesText: string = "";
  private sites: SiteList = SiteList.read("");

  public constructor(context: IWindowPartContext) {
    this.context = context;
  }

  public static checkSites(text: string): string | null {
    const entries: readonly string[] = SiteList.read(text).ignoredEntries;
    return entries.length === 0 ? null : Resources.formatRefusedSites(entries);
  }

  public placeFor(url: string, gesture: LinkGesture): LinkPlace {
    if (this.readSites().matches(url))
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

  private readSites(): SiteList {
    const stored: JsonValue | undefined = this.context.readSetting(Resources.systemSitesSetting);
    const text: string = typeof stored === "string" ? stored : "";
    if (text !== this.sitesText) {
      this.sitesText = text;
      this.sites = SiteList.read(text);
      if (this.sites.ignored.length > 0)
        this.context.log(Resources.formatIgnoredSites(this.sites.ignored));
    }
    return this.sites;
  }
}
