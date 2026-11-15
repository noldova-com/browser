/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export class ProductFile implements Disposable {
  public static readonly NAME: string = "Fixture App";
  private readonly folder: string = mkdtempSync(join(tmpdir(), "browser-product-"));
  public readonly file: string = join(this.folder, "product.json");
  public readonly missing: string = join(this.folder, "missing.json");

  public constructor() {
    const product: Readonly<Record<string, unknown>> = {
      name: ProductFile.NAME,
      slug: "fixture-app",
      applicationId: "org.fixtures.app",
      developmentApplicationId: "org.fixtures.app.development",
      dataFolder: ".fixtures/app",
      deviceFolders: { windows: "Fixtures/App", macos: "Fixtures/App", linux: "fixtures/app" },
      dataDirectoryVariable: "FIXTURE_APP_DATA_DIR",
      icons: "assets/fixture-icons",
      windowsPublisher: "CN=Fixtures, O=Fixtures, C=US",
      updateFeed: null,
      version: "9.8.7",
      build: "fixture-build"
    };
    writeFileSync(this.file, JSON.stringify(product));
  }

  public [Symbol.dispose](): void {
    rmSync(this.folder, { recursive: true, force: true });
  }
}
