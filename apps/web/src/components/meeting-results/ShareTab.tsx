"use client";

import { useEffect, useState } from "react";
import type { ShareLink, ShareLinkVisibility } from "@field-notes/shared";
import { createShareLink, getShareLink } from "@/lib/api";
import { toDisplayError, type DisplayError } from "@/lib/error-messages";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { Spinner } from "@/components/common/Spinner";

/** Mặc định luôn là "Chỉ mình tôi" cho tới khi người dùng chủ động lưu lựa chọn khác (mục 13.4). */
const DEFAULT_VISIBILITY: ShareLinkVisibility = "private";

export function ShareTab({ meetingId }: { meetingId: string }) {
  const [link, setLink] = useState<ShareLink | null>(null);
  const [visibility, setVisibility] = useState<ShareLinkVisibility>(DEFAULT_VISIBILITY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<DisplayError | null>(null);

  useEffect(() => {
    setLoading(true);
    getShareLink(meetingId)
      .then((existing) => {
        setLink(existing);
        setVisibility(existing?.visibility ?? DEFAULT_VISIBILITY);
      })
      .catch((err) => setError(toDisplayError(err, "Không thể tải trạng thái chia sẻ.")))
      .finally(() => setLoading(false));
  }, [meetingId]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await createShareLink(meetingId, visibility);
      setLink(updated);
    } catch (err) {
      setError(toDisplayError(err, "Không thể lưu chế độ chia sẻ."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner label="Đang tải trạng thái chia sẻ..." />;

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner code={error.code} messageVi={error.messageVi} onDismiss={() => setError(null)} />}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Ai có thể xem kết quả cuộc họp này?</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="visibility"
            checked={visibility === "private"}
            onChange={() => setVisibility("private")}
          />
          Chỉ mình tôi
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="visibility"
            checked={visibility === "anyone_with_link"}
            onChange={() => setVisibility("anyone_with_link")}
          />
          Bất kỳ ai có liên kết
        </label>
      </fieldset>

      <button
        type="button"
        disabled={saving}
        onClick={() => void handleSave()}
        className="w-fit rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {saving ? "Đang lưu..." : "Lưu"}
      </button>

      {link && (
        <div className="rounded-lg border bg-slate-50 p-3 text-sm dark:bg-slate-800">
          <p className="mb-1 font-medium">Liên kết chia sẻ:</p>
          <a href={link.url} target="_blank" rel="noreferrer" className="break-all text-brand-600 hover:underline">
            {link.url}
          </a>
        </div>
      )}
    </div>
  );
}
