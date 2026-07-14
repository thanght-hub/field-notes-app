import type { StorageProvider } from "@field-notes/shared";
import type { AppEnv } from "../config/env.js";
import { GcsStorageProvider } from "./gcs-storage.js";
import { LocalStorageProvider } from "./local-storage.js";

/** Cache singleton theo loại provider (mục 14.3 — không tạo lại client mỗi lần gọi). */
let cached: { kind: AppEnv["STORAGE_PROVIDER"]; instance: StorageProvider } | undefined;

export function getStorageProvider(env: AppEnv): StorageProvider {
  if (cached && cached.kind === env.STORAGE_PROVIDER) {
    return cached.instance;
  }

  let instance: StorageProvider;
  if (env.STORAGE_PROVIDER === "gcs") {
    if (!env.GCS_TEMP_BUCKET) {
      throw new Error("Thiếu GCS_TEMP_BUCKET khi STORAGE_PROVIDER=gcs");
    }
    instance = new GcsStorageProvider(env.GCS_TEMP_BUCKET);
  } else {
    instance = new LocalStorageProvider(env.LOCAL_STORAGE_DIR);
  }

  cached = { kind: env.STORAGE_PROVIDER, instance };
  return instance;
}

export { LocalStorageProvider } from "./local-storage.js";
export { GcsStorageProvider } from "./gcs-storage.js";
