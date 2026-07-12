export interface PutObjectInput {
  key: string;
  data: Uint8Array;
  contentType: string;
}

export interface StorageObjectRef {
  key: string;
  sizeBytes: number;
}

/**
 * Lưu trữ tạm thời phía backend trước khi đẩy kết quả cuối lên Google Drive (mục 14.3, 20).
 * Cài đặt dev dùng đĩa cục bộ; cài đặt production dùng Google Cloud Storage với lifecycle rule tự xoá.
 */
export interface StorageProvider {
  putObject(input: PutObjectInput): Promise<StorageObjectRef>;
  getObject(key: string): Promise<Uint8Array>;
  deleteObject(key: string): Promise<void>;
}

export interface DriveUploadInput {
  /** Đường dẫn thư mục logic, vd ["Meeting Assistant", "Acme Corp", "Du an X", "2026-07-12 - Hop tuan"]. */
  folderPath: string[];
  fileName: string;
  mimeType: string;
  data: Uint8Array;
}

export interface DriveUploadResult {
  fileId: string;
  webViewLink: string;
}

export type DriveShareVisibility = "private" | "anyone_with_link";

/** Cô lập Google Drive API — chỉ dùng phạm vi drive.file (mục 13). */
export interface DriveStorageProvider {
  uploadFile(input: DriveUploadInput): Promise<DriveUploadResult>;
  setShareVisibility(fileId: string, visibility: DriveShareVisibility): Promise<string>;
}
