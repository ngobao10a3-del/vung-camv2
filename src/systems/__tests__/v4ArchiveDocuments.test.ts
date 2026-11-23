import { beforeEach, describe, expect, it } from "vitest";
import { ConditionEvaluator } from "../../core/ConditionEvaluator";
import { EffectExecutor } from "../../core/EffectExecutor";
import { EventDispatcher } from "../../core/EventDispatcher";
import { createInitialState, GameStateStore } from "../../core/GameStateStore";
import {
  CHAPTER1_ARCHIVE_DOCUMENTS,
  V4_ORIGINAL_ARCHIVE_DOCUMENTS
} from "../../data/chapter1Archive";
import { CHAPTER1_CHARACTERS } from "../../data/characters";
import { CHAPTER1_DIALOGUES } from "../../data/chapter1Dialogues";
import { ArchiveSystem } from "../ArchiveSystem";
import { DialogueSystem } from "../DialogueSystem";

describe("V4 Batch 1 — 8 Original Source Documents Integration Suite", () => {
  let store: GameStateStore;
  let evaluator: ConditionEvaluator;
  let executor: EffectExecutor;
  let dispatcher: EventDispatcher;
  let archive: ArchiveSystem;
  let dialogue: DialogueSystem;

  beforeEach(() => {
    store = new GameStateStore(createInitialState("CH-01", "SC-01"));
    evaluator = new ConditionEvaluator();
    executor = new EffectExecutor(store);
    dispatcher = new EventDispatcher(store, evaluator, executor);
    archive = new ArchiveSystem(store, evaluator, CHAPTER1_ARCHIVE_DOCUMENTS);
    dialogue = new DialogueSystem(
      store,
      evaluator,
      executor,
      CHAPTER1_DIALOGUES,
      dispatcher,
      CHAPTER1_CHARACTERS
    );
  });

  it("V4-ARC-01: Chứa đầy đủ 8 tài liệu V4 gốc với ID duy nhất và nội dung nguyên văn UTF-8", () => {
    expect(V4_ORIGINAL_ARCHIVE_DOCUMENTS).toHaveLength(8);
    const allIds = CHAPTER1_ARCHIVE_DOCUMENTS.map(d => d.id);
    expect(new Set(allIds).size).toBe(allIds.length);

    const expectedIds = [
      "DOC-DAT-DIARY",
      "DOC-MINH-NOTES",
      "DOC-DAT-HR",
      "DOC-HUNG-HR",
      "DOC-RADIO-0015",
      "DOC-ORIGINAL-CASSETTE",
      "DOC-LENS-ARRAY",
      "DOC-CAMERA-R04"
    ];
    for (const id of expectedIds) {
      expect(V4_ORIGINAL_ARCHIVE_DOCUMENTS.some(d => d.id === id)).toBe(true);
    }

    const byId = Object.fromEntries(V4_ORIGINAL_ARCHIVE_DOCUMENTS.map(d => [d.id, d]));
    expect(byId["DOC-DAT-DIARY"].content).toContain("Trang 1 – 12/11/1998");
    expect(byId["DOC-DAT-DIARY"].content).toContain("Và nếu nghe thấy giọng của chính mình...\nĐừng trả lời.");
    expect(byId["DOC-MINH-NOTES"].content).toContain("Ghi chép 04");
    expect(byId["DOC-DAT-HR"].content).toContain("Mã hồ sơ: HR-09-014");
    expect(byId["DOC-HUNG-HR"].content).toContain("Nhưng không có lệnh nào trong số đó được gửi từ trung tâm.");
    expect(byId["DOC-RADIO-0015"].content).toContain('"Chúng tôi đang chờ."');
    expect(byId["DOC-ORIGINAL-CASSETTE"].content).toContain("Bản gốc. Không sao chép vào hệ thống.");
    expect(byId["DOC-LENS-ARRAY"].content).toContain("Mã tài liệu: LA-09-02");
    expect(byId["DOC-CAMERA-R04"].content).toContain("23:58 | Phạm Quốc Đạt rời khỏi khu nghỉ");
  });

  it("V4-ARC-02: Không mở khóa sớm các tài liệu V4 khi chưa đủ điều kiện điều tra tương ứng", () => {
    expect(archive.getUnlockedDocuments()).toEqual([]);

    // Phát hiện C-04 (chưa giải PZ-01 và chưa có C-07) không mở khóa LA-09-02
    store.discoverClue("C-04");
    expect(archive.isUnlocked("DOC-LENS-ARRAY")).toBe(false);

    // Phát hiện C-09 (chưa kiểm tra tủ 04) không mở khóa Nhật ký Phạm Quốc Đạt
    store.discoverClue("C-09");
    expect(archive.isUnlocked("DOC-DAT-DIARY")).toBe(false);

    // Phát hiện C-03 (chưa xác nhận captain_missing_confirmed / C-08) không mở khóa Hồ sơ Đạt hoặc Hùng
    store.discoverClue("C-03");
    expect(archive.isUnlocked("DOC-DAT-HR")).toBe(false);
    expect(archive.isUnlocked("DOC-HUNG-HR")).toBe(false);

    // Thu thập I-03 và phát Mặt A (C-05) chưa mở khóa Băng Cassette gốc (Mặt B)
    store.addItem("I-03");
    store.discoverClue("C-05");
    expect(archive.isUnlocked("DOC-ORIGINAL-CASSETTE")).toBe(false);
  });

  it("V4-ARC-03: Mở khóa chính xác từng tài liệu trong 8 tài liệu V4 khi đạt đúng tiến trình điều tra", () => {
    // SC-02: Bản tin Radio 00:15 (C-01 + hoàn thành DLG-SC02-RADIO hoặc tạm dừng radio)
    store.discoverClue("C-01");
    expect(archive.isUnlocked("DOC-RADIO-0015")).toBe(false);
    dialogue.startDialogue("DLG-SC02-RADIO");
    dialogue.selectChoice("sc02-radio-leave");
    expect(dialogue.isDialogueCompleted("DLG-SC02-RADIO")).toBe(true);
    expect(archive.isUnlocked("DOC-RADIO-0015")).toBe(true);

    // SC-02: Nhật ký Trần Minh (C-02 + đã kiểm tra bàn trực C-01 / I-02)
    store.discoverClue("C-02");
    expect(archive.isUnlocked("DOC-MINH-NOTES")).toBe(true);

    // SC-02 / SC-03: Hồ sơ nhân sự Phạm Quốc Đạt (C-03 + captain_missing_confirmed + I-02/C-09)
    store.discoverClue("C-03");
    store.setFlag("captain_missing_confirmed", true);
    store.addItem("I-02");
    expect(archive.isUnlocked("DOC-DAT-HR")).toBe(true);

    // SC-03: Nhật ký Phạm Quốc Đạt (C-09 + locker_knocking)
    store.discoverClue("C-09");
    store.setFlag("locker_knocking", true);
    expect(archive.isUnlocked("DOC-DAT-DIARY")).toBe(true);

    // SC-03 / SC-02: Băng Cassette gốc (I-03 + phát Mặt B)
    store.addItem("I-03");
    store.discoverClue("C-05");
    store.markOnce("cassette_side_b_heard");
    expect(archive.isUnlocked("DOC-ORIGINAL-CASSETTE")).toBe(true);

    // SC-04: Tài liệu Lens Array LA-09-02 (C-04 + PZ-01 đã giải)
    store.discoverClue("C-04");
    store.solvePuzzle("PZ-01");
    expect(archive.isUnlocked("DOC-LENS-ARRAY")).toBe(true);

    // SC-05: Bản ghi Camera CAM-R04 (C-06 + PZ-01 / low)
    store.discoverClue("C-06");
    expect(archive.isUnlocked("DOC-CAMERA-R04")).toBe(true);

    // SC-05: Hồ sơ Lê Văn Hùng (C-03 + C-08)
    store.discoverClue("C-08");
    expect(archive.isUnlocked("DOC-HUNG-HR")).toBe(true);
  });

  it("V4-ARC-04: Đọc tài liệu V4 lưu trạng thái đã đọc và không tự động thay đổi quy tắc hay kết thúc", () => {
    store.discoverClue("C-03");
    store.discoverClue("C-08");
    expect(archive.isUnlocked("DOC-HUNG-HR")).toBe(true);

    const beforeStatuses = { ...store.snapshot().investigationStatuses };
    const beforeEnding = store.snapshot().activeEndingId;

    expect(archive.isRead("DOC-HUNG-HR")).toBe(false);
    expect(archive.markAsRead("DOC-HUNG-HR")).toBe(true);
    expect(archive.isRead("DOC-HUNG-HR")).toBe(true);

    expect(store.snapshot().investigationStatuses).toEqual(beforeStatuses);
    expect(store.snapshot().activeEndingId).toBe(beforeEnding);
  });
});
