/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DocumentContribution, type IWindowPart, type IWindowPartContext } from "@noldova/desktop.window";

export class RelayDoubleWindowPart implements IWindowPart {
  private static readonly OPENING_EVENT: string = "relay-double.opening";
  private static readonly PAGE_DOCUMENT: string = "relay-double.page";
  private static readonly INSTANCE: string = "1";
  private static readonly TITLE: string = "Relay double";

  public readonly moduleId: string = "relay-double";
  private stopListening: (() => void) | null = null;

  public async activateAsync(context: IWindowPartContext): Promise<void> {
    context.registerDocument(new DocumentContribution(RelayDoubleWindowPart.PAGE_DOCUMENT,
      () => import("./relay-page.component").then(t => t.RelayPageComponent)));
    this.stopListening = context.onEvent(RelayDoubleWindowPart.OPENING_EVENT,
      () => context.openDocument(RelayDoubleWindowPart.PAGE_DOCUMENT, RelayDoubleWindowPart.INSTANCE, RelayDoubleWindowPart.TITLE));
  }

  public async reconnectAsync(): Promise<boolean> {
    return false;
  }

  public async deactivateAsync(): Promise<void> {
    this.stopListening?.();
    this.stopListening = null;
  }
}
