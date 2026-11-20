/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Signal, computed, input } from "@angular/core";
import { type PageActivity, PageBox, PagePoint } from "@noldova/browser.protocol";

import { Resources } from "../../../resources.ts";

@Component({
  selector: "nol-browser-agent-mark",
  templateUrl: "./agent-mark.component.html",
  styleUrl: "./agent-mark.component.css",
  host: {
    "class": "nol-browser-agent-mark",
    "aria-hidden": "true"
  }
})
export class AgentMarkComponent {
  protected readonly box: Signal<PageBox | null> = computed(() => {
    const box: PageBox | null = this.activity().box;
    const zoom: number = this.zoom();
    return box === null ? null : new PageBox(box.x * zoom, box.y * zoom, box.width * zoom, box.height * zoom);
  });
  protected readonly point: Signal<PagePoint | null> = computed(() => {
    const point: PagePoint | null = this.activity().point;
    const zoom: number = this.zoom();
    return point === null ? null : new PagePoint(point.x * zoom, point.y * zoom);
  });
  protected readonly tag: Signal<string> = computed(() => Resources.formatMarkTag(this.activity()));
  protected readonly glyph: Signal<string> = computed(() => Resources.formatMarkGlyph(this.activity().action));

  public readonly activity = input.required<PageActivity>();
  public readonly zoom = input<number>(1);

  protected ringStart(pixels: number): string {
    return Resources.formatRingStart(pixels);
  }

  protected ringLength(start: number, length: number): string {
    return Resources.formatRingLength(start, length);
  }

  protected tagStart(pixels: number): string {
    return Resources.formatTagStart(pixels);
  }

  protected tagSpace(pixels: number): string {
    return Resources.formatTagSpace(pixels);
  }

  protected tagTop(pixels: number): string {
    return Resources.formatTagTop(pixels);
  }

  protected pointerStart(pixels: number): string {
    return Resources.formatPointerStart(pixels);
  }
}
