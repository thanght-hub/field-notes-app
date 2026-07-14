import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { PutObjectInput, StorageObjectRef, StorageProvider } from "@field-notes/shared";

/**
 * Triển khai StorageProvider dev/local (kiến trúc 1.3): lưu file trên đĩa cục bộ dưới `rootDir`.
 * `key` có thể chứa dấu "/" (vd "meetings/<id>/chunks/<n>.webm") — thư mục cha được tạo tự động khi ghi.
 * Không có TTL tự động ở đây (khác GCS lifecycle) — dev/local coi là tạm thời, dọn dẹp thủ công nếu cần.
 */
export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly rootDir: string) {}

  private resolvePath(key: string): string {
    // path.join đã chuẩn hoá "/" theo hệ điều hành; không cho phép key thoát ra ngoài rootDir bằng "..".
    if (key.includes("..")) {
      throw new Error(`Khoá lưu trữ không hợp lệ: ${key}`);
    }
    return join(this.rootDir, key);
  }

  async putObject(input: PutObjectInput): Promise<StorageObjectRef> {
    const fullPath = this.resolvePath(input.key);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, input.data);
    return { key: input.key, sizeBytes: input.data.byteLength };
  }

  async getObject(key: string): Promise<Uint8Array> {
    const fullPath = this.resolvePath(key);
    const buffer = await readFile(fullPath);
    return new Uint8Array(buffer);
  }

  async deleteObject(key: string): Promise<void> {
    const fullPath = this.resolvePath(key);
    await rm(fullPath, { force: true });
  }
}
