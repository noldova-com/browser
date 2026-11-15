/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { KeyChord, WebViewKey } from "@noldova/desktop.protocol";

import { Resources } from "../../resources.ts";
import { ZoomStep } from "../enums/zoom-step.ts";

export class PageKeys {
  public static readonly reload: WebViewKey = new WebViewKey(Resources.reloadKey, [KeyChord.parse(Resources.reloadChord), KeyChord.parse(Resources.reloadFunctionKey)],
    [KeyChord.parse(Resources.reloadChord)]);
  public static readonly newPage: WebViewKey = new WebViewKey(Resources.newPageKey, [KeyChord.parse(Resources.newPageChord)]);
  public static readonly focusAddress: WebViewKey = new WebViewKey(Resources.focusAddressKey, [KeyChord.parse(Resources.focusAddressChord)]);
  public static readonly all: readonly WebViewKey[] = [PageKeys.reload, PageKeys.newPage, PageKeys.focusAddress];

  public static platformOf(platform: string): string {
    if (platform.startsWith(Resources.macPlatformPrefix))
      return Resources.macPlatform;
    return platform.startsWith(Resources.windowsPlatformPrefix) ? Resources.windowsPlatform : Resources.linuxPlatform;
  }

  public static zoomKeysOf(platform: string): Readonly<Record<ZoomStep, string>> {
    const keys = Resources.zoomKeys;
    return platform === Resources.macPlatform
      ? { [ZoomStep.In]: keys[ZoomStep.In].mac, [ZoomStep.Out]: keys[ZoomStep.Out].mac, [ZoomStep.Reset]: keys[ZoomStep.Reset].mac }
      : { [ZoomStep.In]: keys[ZoomStep.In].other, [ZoomStep.Out]: keys[ZoomStep.Out].other, [ZoomStep.Reset]: keys[ZoomStep.Reset].other };
  }

  public static find(event: KeyboardEvent, platform: string): string | null {
    return PageKeys.all.find(t => t.matches(event, platform))?.name ?? null;
  }
}
