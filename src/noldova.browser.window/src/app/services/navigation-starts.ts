/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PaneController } from "./pane-controller.ts";

export class NavigationStarts {
  private static readonly listeners: WeakMap<PaneController, Set<() => void>> = new WeakMap<PaneController, Set<() => void>>();

  public static listen(controller: PaneController, listener: () => void): () => void {
    const listeners: Set<() => void> = NavigationStarts.listeners.get(controller) ?? new Set<() => void>();
    listeners.add(listener);
    NavigationStarts.listeners.set(controller, listeners);
    return () => listeners.delete(listener);
  }

  public static tell(controller: PaneController): void {
    for (const listener of [...NavigationStarts.listeners.get(controller) ?? []])
      listener();
  }

  public static forget(controller: PaneController): void {
    NavigationStarts.listeners.delete(controller);
  }
}
