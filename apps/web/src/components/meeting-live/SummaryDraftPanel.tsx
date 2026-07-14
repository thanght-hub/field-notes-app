import type { RealtimeSummaryPointKind, RealtimeSummarySnapshot } from "@field-notes/shared";
import { SUMMARY_POINT_KIND_LABEL_VI } from "@/lib/format";

const KIND_ORDER: RealtimeSummaryPointKind[] = [
  "y_chinh",
  "dang_thao_luan",
  "quyet_dinh_tam_thoi",
  "chua_thong_nhat",
];

const KIND_BADGE_CLASS: Record<RealtimeSummaryPointKind, string> = {
  y_chinh: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  dang_thao_luan: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  quyet_dinh_tam_thoi: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  chua_thong_nhat: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
};

/** Tóm tắt ý chính "nháp" thời gian thực (mục 9) — KHÔNG phải kết quả cuối cùng. */
export function SummaryDraftPanel({ summary }: { summary: RealtimeSummarySnapshot | null }) {
  if (!summary || summary.points.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Chưa có tóm tắt — sẽ xuất hiện sau ít phút khi có đủ nội dung mới.
      </p>
    );
  }

  const grouped = KIND_ORDER.map((kind) => ({
    kind,
    points: summary.points.filter((p) => p.kind === kind),
  })).filter((group) => group.points.length > 0);

  return (
    <div className="flex flex-col gap-3">
      {grouped.map((group) => (
        <div key={group.kind}>
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${KIND_BADGE_CLASS[group.kind]}`}
          >
            {SUMMARY_POINT_KIND_LABEL_VI[group.kind]}
          </span>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {group.points.map((point) => (
              <li key={point.id}>{point.text}</li>
            ))}
          </ul>
        </div>
      ))}
      <p className="text-xs italic text-slate-500 dark:text-slate-400">
        Đây là bản nháp, sẽ được hoàn thiện sau khi kết thúc cuộc họp.
      </p>
    </div>
  );
}
