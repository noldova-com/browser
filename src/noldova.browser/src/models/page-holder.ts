/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ClientClosure, RequestContext } from "@noldova/desktop.runtime";

export class PageHolder {
  public readonly connection: number;
  public readonly window: number | null;

  public constructor(request: RequestContext) {
    this.connection = request.connection;
    this.window = request.window;
  }

  public isOf(request: RequestContext): boolean {
    return this.connection === request.connection && this.window === request.window;
  }

  public isClosedBy(closure: ClientClosure): boolean {
    return this.connection === closure.connection && (closure.window === null || this.window === closure.window);
  }
}
