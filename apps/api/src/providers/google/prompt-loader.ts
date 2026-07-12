import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Đọc nội dung 1 file prompt có version từ thư mục `prompts/` ở gốc repo (mục 19).
 * File này nằm ở apps/api/src/providers/google/prompt-loader.ts — để tới gốc repo (nơi chứa
 * thư mục `apps/`, `packages/`, `prompts/`) cần đi lên 5 cấp:
 *   google -> providers -> src -> api -> apps -> <repo root>
 */
const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "..", "..", "..", "..", "..");

export async function loadPrompt(name: string): Promise<string> {
  const filePath = resolve(repoRoot, "prompts", name);
  return readFile(filePath, "utf8");
}
