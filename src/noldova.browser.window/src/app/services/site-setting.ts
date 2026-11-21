/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import type { IWindowPartContext } from "@noldova/desktop.window";

import { SiteList } from "../models/site-list.ts";

export class SiteSetting {
  private readonly context: IWindowPartContext;
  private readonly name: string;
  private readonly formatIgnored: (places: readonly number[]) => string;
  private sitesText: string = "";
  private sites: SiteList = SiteList.read("");

  public constructor(context: IWindowPartContext, name: string, formatIgnored: (places: readonly number[]) => string) {
    this.context = context;
    this.name = name;
    this.formatIgnored = formatIgnored;
  }

  public readText(): string {
    const stored: JsonValue | undefined = this.context.readSetting(this.name);
    return typeof stored === "string" ? stored : "";
  }

  public read(): SiteList {
    const text: string = this.readText();
    if (text !== this.sitesText) {
      this.sitesText = text;
      this.sites = SiteList.read(text);
      if (this.sites.ignored.length > 0)
        this.context.log(this.formatIgnored(this.sites.ignored));
    }
    return this.sites;
  }
}
