/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Signal, computed, effect, inject, input, output } from "@angular/core";
import { type PageActivity, PageActivityState } from "@noldova/browser.protocol";
import { AnnouncementPoliteness, Announcer, ButtonComponent, ButtonSize, ButtonVariant } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.ts";

@Component({
  selector: "nol-browser-agent-bar",
  imports: [ButtonComponent],
  templateUrl: "./agent-bar.component.html",
  styleUrl: "./agent-bar.component.css",
  host: {
    "class": "nol-browser-agent-bar"
  }
})
export class AgentBarComponent {
  private readonly announcer: Announcer = inject(Announcer);
  private readonly message: Signal<string> = computed(() => Resources.formatAgentMessage(this.name(), this.phrase()));

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly compact: ButtonSize = ButtonSize.Compact;
  protected readonly name: Signal<string> = computed(() => Resources.formatAgentName(this.activity().agentName));
  protected readonly isActing: Signal<boolean> = computed(() => this.activity().state !== PageActivityState.Asking);
  protected readonly phrase: Signal<string> = computed(() => this.isActing() ? Resources.agentActing : Resources.agentAsking);

  public readonly activity = input.required<PageActivity>();
  public readonly tookOver = output<void>();
  public readonly stopped = output<void>();

  public constructor() {
    effect(() => this.announcer.announce(this.message(), AnnouncementPoliteness.Polite));
  }
}
