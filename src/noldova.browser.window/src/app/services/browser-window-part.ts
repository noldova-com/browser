/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { CommandContribution, ContentPadding, DocumentContribution, type IWindowPart, type IWindowPartContext } from "@noldova/desktop.window";

import { Resources } from "../../resources.ts";
import { LinkPlaces } from "./link-places.ts";
import { LocalSiteCheck } from "./local-site-check.ts";
import { OpenPageArguments } from "./open-page-arguments.ts";
import { Pages } from "./pages.ts";

export class BrowserWindowPart implements IWindowPart {
  private pages: Pages | null = null;

  public readonly moduleId: string = Resources.moduleId;

  public activateAsync(context: IWindowPartContext): Promise<void> {
    const pages: Pages = new Pages(context);
    context.registerDocument(new DocumentContribution(Resources.pageDocument,
      () => import("../components/page/page.component.ts").then(t => t.PageComponent), ContentPadding.None, { tabRowPlace: Resources.pageTabRowPlace }));
    context.registerCommand(new CommandContribution(Resources.openPageCommand, Resources.openPageTitle, null, null, async (commandArguments: JsonValue) => {
      const { profileKey, url, instance } = OpenPageArguments.read(commandArguments);
      await pages.openAsync(profileKey, url, instance);
      return null;
    }, () => true, null, t => OpenPageArguments.isValid(t)));
    context.registerCommand(new CommandContribution(Resources.newPageCommand, Resources.newPageTitle, Resources.newPageGlyph, Resources.newPageChord, (commandArguments: JsonValue) => {
      pages.openBeside(commandArguments);
      return Promise.resolve(null);
    }, t => pages.canOpenBeside(t)));
    const places: LinkPlaces = new LinkPlaces(context);
    context.registerInAppBrowser({ placeFor: (url, gesture) => places.placeFor(url, gesture), openAsync: url => pages.openLinkAsync(url) });
    context.provideSettingCheck(Resources.systemSitesSetting, t => LinkPlaces.checkSites(t));
    context.provideSettingCheck(Resources.popupSitesSetting, t => LinkPlaces.checkSites(t));
    context.provideSettingCheck(Resources.localSitesSetting, t => LocalSiteCheck.check(t));
    this.pages = pages;
    void pages.reportOpenAsync();
    return Promise.resolve();
  }

  public async reconnectAsync(): Promise<boolean> {
    const pages: Pages | null = this.pages;
    if (Object.isNull(pages))
      return false;
    const isReported: boolean = await pages.reportOpenAsync();
    if (this.pages !== pages)
      return false;
    const isRead: boolean = await pages.readActivitiesAsync();
    return isReported && isRead && this.pages === pages;
  }

  public deactivateAsync(): Promise<void> {
    if (!Object.isNull(this.pages))
      this.pages.close();
    this.pages = null;
    return Promise.resolve();
  }
}
