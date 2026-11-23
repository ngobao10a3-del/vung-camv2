import type { ArchiveDocumentCategory, ArchiveDocumentDefinition } from "../types/archive";
import { CHAPTER1_CLUES } from "./chapter1Investigation";

const CLUE_ARCHIVE_METADATA: Record<
  string,
  { sourceLabel: string; category: ArchiveDocumentCategory; relatedSceneId: string }
> = {
  "C-01": {
    sourceLabel: "Máy in nhiệt thời tiết · Phòng trực (SC-02)",
    category: "broadcast",
    relatedSceneId: "SC-02"
  },
  "C-02": {
    sourceLabel: "Sổ trực tiền nhiệm · Phòng trực (SC-02)",
    category: "diary",
    relatedSceneId: "SC-02"
  },
  "C-03": {
    sourceLabel: "Hồ sơ niêm phong Trạm 09 · Phòng trực (SC-02)",
    category: "dossier",
    relatedSceneId: "SC-02"
  },
  "C-04": {
    sourceLabel: "Bảng sơ đồ kỹ thuật · Phòng máy (SC-04)",
    category: "technical",
    relatedSceneId: "SC-04"
  },
  "C-05": {
    sourceLabel: "Cuộn băng hai mặt · Phòng trực (SC-02)",
    category: "tape",
    relatedSceneId: "SC-02"
  },
  "C-06": {
    sourceLabel: "Màn hình trích xuất CCTV · Phòng quan sát (SC-05)",
    category: "cctv",
    relatedSceneId: "SC-05"
  },
  "C-07": {
    sourceLabel: "Tài liệu phòng thí nghiệm quang học · Phòng quan sát (SC-05)",
    category: "technical",
    relatedSceneId: "SC-05"
  },
  "C-08": {
    sourceLabel: "Ngăn bí mật dưới bàn · Phòng quan sát (SC-05)",
    category: "dossier",
    relatedSceneId: "SC-05"
  },
  "C-09": {
    sourceLabel: "Dưới chân giường sắt · Khu nghỉ nhân viên (SC-03)",
    category: "dossier",
    relatedSceneId: "SC-03"
  }
};

/**
 * Kho tư liệu lưu trữ được xây dựng nguyên văn từ các chứng cứ V4 đã hiện diện trong mã nguồn Chương 01.
 * Chỉ mở khóa khi điều kiện thu thập manh mối tương ứng đã được đáp ứng.
 */
export const CHAPTER1_ARCHIVE_DOCUMENTS: ArchiveDocumentDefinition[] = CHAPTER1_CLUES.map(clue => {
  const meta = CLUE_ARCHIVE_METADATA[clue.id] ?? {
    sourceLabel: "Hồ sơ lưu trữ Trạm 09",
    category: "dossier" as const,
    relatedSceneId: "SC-02"
  };

  return {
    id: `ARC-${clue.id}`,
    title: clue.title,
    sourceLabel: meta.sourceLabel,
    category: meta.category,
    relatedSceneId: meta.relatedSceneId,
    relatedClueIds: [clue.id],
    unlockCondition: { hasClue: clue.id },
    content: clue.detailContent
  };
});
