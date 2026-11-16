/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export class TestCertificate {
  private static readonly OPENSSL: string = "openssl";
  private static readonly FOLDER_PREFIX: string = "browser-e2e-certificate-";
  private static readonly KEY_FILE: string = "key.pem";
  private static readonly CERTIFICATE_FILE: string = "certificate.pem";

  public readonly key: string;
  public readonly certificate: string;

  private constructor(key: string, certificate: string) {
    this.key = key;
    this.certificate = certificate;
  }

  public static async createAsync(host: string): Promise<TestCertificate> {
    const folder = await mkdtemp(path.join(tmpdir(), TestCertificate.FOLDER_PREFIX));
    try {
      const keyFile = path.join(folder, TestCertificate.KEY_FILE);
      const certificateFile = path.join(folder, TestCertificate.CERTIFICATE_FILE);
      await TestCertificate.runAsync(["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", keyFile, "-out", certificateFile, "-days", "1",
        "-subj", `/CN=${host}`, "-addext", `subjectAltName=DNS:${host}`]);
      return new TestCertificate(await readFile(keyFile, "utf8"), await readFile(certificateFile, "utf8"));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  private static runAsync(args: readonly string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      execFile(TestCertificate.OPENSSL, args, (error, _stdout, stderr) => {
        if (error === null)
          resolve();
        else if ("code" in error && error.code === "ENOENT")
          reject(new Error("The test makes its certificate with the openssl command line, which isn't on this machine's PATH; install OpenSSL to run it."));
        else
          reject(new Error(`openssl didn't make the test's certificate: ${stderr.trim() || error.message}`));
      });
    });
  }
}
