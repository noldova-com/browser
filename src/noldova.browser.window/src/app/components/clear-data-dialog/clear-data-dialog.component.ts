/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, output } from "@angular/core";
import { ButtonComponent, ButtonVariant, DialogComponent, DialogDescriptionDirective } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.ts";

@Component({
  selector: "nol-browser-clear-data-dialog",
  imports: [ButtonComponent, DialogComponent, DialogDescriptionDirective],
  templateUrl: "./clear-data-dialog.component.html"
})
export class ClearDataDialogComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;

  public readonly answered = output<boolean>();
}
