import { Storage } from "@google-cloud/storage";
import type { PutObjectInput, StorageObjectRef, StorageProvider } from "@field-notes/shared";

/**
 * Triển khai StorageProvider production dùng Google Cloud Storage (kiến trúc 1.3, 1.5).
 *
 * LƯU Ý: quy tắc tự xoá object sau `TEMP_STORAGE_TTL_DAYS` ngày (mục 14.3, 20) PHẢI được cấu hình bằng
 * lifecycle rule ở cấp bucket (vd `gsutil lifecycle set` hoặc Terraform `google_storage_bucket.lifecycle_rule`),
 * KHÔNG THỂ và KHÔNG NÊN cố set qua code runtime ở đây — code chỉ đọc/ghi/xoá object theo yêu cầu tường minh.
 */
export class GcsStorageProvider implements StorageProvider {
  private readonly storage: Storage;
  private readonly bucketName: string;

  constructor(bucketName: string) {
    this.storage = new Storage();
    this.bucketName = bucketName;
  }

  async putObject(input: PutObjectInput): Promise<StorageObjectRef> {
    const file = this.storage.bucket(this.bucketName).file(input.key);
    await file.save(Buffer.from(input.data), {
      contentType: input.contentType,
      resumable: false,
    });
    return { key: input.key, sizeBytes: input.data.byteLength };
  }

  async getObject(key: string): Promise<Uint8Array> {
    const file = this.storage.bucket(this.bucketName).file(key);
    const [buffer] = await file.download();
    return new Uint8Array(buffer);
  }

  async deleteObject(key: string): Promise<void> {
    const file = this.storage.bucket(this.bucketName).file(key);
    await file.delete({ ignoreNotFound: true });
  }
}
