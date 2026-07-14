import { Readable } from "node:stream";
import { OAuth2Client } from "google-auth-library";
import { google, type drive_v3 } from "googleapis";
import type { DriveShareVisibility, DriveStorageProvider, DriveUploadInput, DriveUploadResult } from "@field-notes/shared";

/**
 * Kết quả upload mở rộng có kèm `folderId` của thư mục cuối cùng trong `folderPath` — cần để
 * `drive-export` biết folder nào set vào `Meeting.driveFolderId` mà không phải gọi thêm 1 lần Drive API.
 * Đây là phần mở rộng của DriveUploadResult (bản chuẩn có {fileId, webViewLink}) — được phép vì
 * GoogleDriveProvider do chính pipeline này sở hữu/triển khai.
 */
export interface DriveUploadResultWithFolder extends DriveUploadResult {
  folderId: string;
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Cài đặt DriveStorageProvider bằng Google Drive API v3, phạm vi `drive.file` (mục 13.1, 14.4).
 * Nhận `accessToken` đã có sẵn (đã refresh nếu cần) từ nơi gọi — provider này không tự refresh token.
 */
export class GoogleDriveProvider implements DriveStorageProvider {
  private readonly drive: drive_v3.Drive;

  constructor(accessToken: string) {
    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: accessToken });
    this.drive = google.drive({ version: "v3", auth });
  }

  private async findOrCreateFolder(name: string, parentId: string | undefined): Promise<string> {
    const parentClause = parentId ? `'${parentId}' in parents` : "'root' in parents";
    const q = `mimeType='application/vnd.google-apps.folder' and name='${escapeDriveQueryValue(name)}' and trashed=false and ${parentClause}`;

    const list = await this.drive.files.list({
      q,
      fields: "files(id, name)",
      spaces: "drive",
      pageSize: 1,
    });
    const existingId = list.data.files?.[0]?.id;
    if (existingId) return existingId;

    const created = await this.drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: parentId ? [parentId] : undefined,
      },
      fields: "id",
    });
    if (!created.data.id) {
      throw new Error("Không thể tạo thư mục trên Google Drive");
    }
    return created.data.id;
  }

  private async resolveFolderPath(folderPath: string[]): Promise<string> {
    let parentId: string | undefined;
    for (const segment of folderPath) {
      parentId = await this.findOrCreateFolder(segment, parentId);
    }
    if (!parentId) {
      throw new Error("folderPath rỗng — không xác định được thư mục đích trên Google Drive");
    }
    return parentId;
  }

  async uploadFile(input: DriveUploadInput): Promise<DriveUploadResultWithFolder> {
    const folderId = await this.resolveFolderPath(input.folderPath);

    const created = await this.drive.files.create({
      requestBody: {
        name: input.fileName,
        parents: [folderId],
      },
      media: {
        mimeType: input.mimeType,
        body: Readable.from(Buffer.from(input.data)),
      },
      fields: "id, webViewLink",
    });

    if (!created.data.id || !created.data.webViewLink) {
      throw new Error("Google Drive không trả về id/webViewLink hợp lệ sau khi upload");
    }

    return { fileId: created.data.id, webViewLink: created.data.webViewLink, folderId };
  }

  async setShareVisibility(fileId: string, visibility: DriveShareVisibility): Promise<string> {
    if (visibility === "private") {
      const perms = await this.drive.permissions.list({
        fileId,
        fields: "permissions(id, type)",
      });
      const anyonePerms = (perms.data.permissions ?? []).filter((p) => p.type === "anyone");
      for (const perm of anyonePerms) {
        if (perm.id) {
          await this.drive.permissions.delete({ fileId, permissionId: perm.id });
        }
      }
    } else {
      await this.drive.permissions.create({
        fileId,
        requestBody: { type: "anyone", role: "reader" },
      });
    }

    const file = await this.drive.files.get({ fileId, fields: "webViewLink" });
    if (!file.data.webViewLink) {
      throw new Error("Không lấy được webViewLink sau khi đổi quyền chia sẻ trên Google Drive");
    }
    return file.data.webViewLink;
  }
}
