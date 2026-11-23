import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ACTION_TAGS } from "../../types/common";
import { GameStateStore, createInitialState } from "../../core/GameStateStore";
import { CHAPTER1_CLUES } from "../../data/chapter1Investigation";
import {
  CHAPTER1_DEATH_REASONS,
  CHAPTER1_ITEMS,
  canReachEndingB,
  canReachEndingS,
  createChapter1Engine
} from "../../data/chapter1Runtime";
import App from "../../ui/App";
import { PuzzleModalContent } from "../../ui/PuzzleModalContent";

const CLUES_BY_ID = new Map(CHAPTER1_CLUES.map(clue => [clue.id, clue]));

describe("Phase C — PZ-01/02/03 Engine, UI & Regression Suite", () => {
  it("PZ01-ENG-01: Chặn LOW khi thiếu I-04/cầu chì/AUX OFF; NORMAL giữ tiêu chuẩn; OVERLOAD kích hoạt R-05 1 lần; đủ điều kiện thì LOW giải PZ-01", () => {
    const engine = createChapter1Engine();
    engine.store.changeScene("SC-04");

    // Chưa có I-04, chưa lắp cầu chì, chưa ngắt AUX -> LOW bị từ chối ở cấp engine
    expect(engine.puzzles.submitSolution("PZ-01", "LOW").status).toBe("missing_items");
    expect(engine.store.snapshot().flags.power_mode).toBe("normal");
    expect(engine.puzzles.isSolved("PZ-01")).toBe(false);

    const normalRes = engine.puzzles.submitSolution("PZ-01", "NORMAL");
    expect(normalRes.status).toBe("failed");
    expect(engine.store.snapshot().flags.power_mode).toBe("normal");
    expect(engine.store.snapshot().identityOverwriteCount).toBe(0);
    expect(engine.puzzles.isSolved("PZ-01")).toBe(false);

    const overloadRes = engine.puzzles.submitSolution("PZ-01", "OVERLOAD");
    expect(overloadRes.status).toBe("failed");
    expect(engine.store.snapshot().flags.power_mode).toBe("overload");
    expect(engine.store.snapshot().flags.fog_breached).toBe(true);
    expect(engine.store.snapshot().identityOverwriteCount).toBe(1);
    expect(engine.store.snapshot().lastOverwriteReason).toBe(CHAPTER1_DEATH_REASONS.R05_OVERLOAD);
    expect(engine.puzzles.isSolved("PZ-01")).toBe(false);

    // Gửi OVERLOAD lần nữa không cộng dồn ghi đè lần 2
    engine.puzzles.submitSolution("PZ-01", "OVERLOAD");
    expect(engine.store.snapshot().identityOverwriteCount).toBe(1);
    expect(engine.store.snapshot().activeEndingId).toBeNull();

    // Chuẩn bị đủ I-04 + lắp cầu chì + ngắt nhánh phụ -> giải được PZ-01 bằng LOW
    engine.store.addItem("I-04");
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.USE_ITEM,
      targetId: "power_fuse_slot",
      sceneId: "SC-04"
    });
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.USE_ITEM,
      targetId: "aux_branch_off",
      sceneId: "SC-04"
    });

    const lowRes = engine.puzzles.submitSolution("PZ-01", "LOW");
    expect(lowRes.status).toBe("solved");
    expect(engine.store.snapshot().flags.power_mode).toBe("low");
    expect(engine.store.snapshot().discoveredRuleIds).toContain("R-07");
  });

  it("PZ01-ENG-02: Nếu đã có 1 bẫy ghi đè trước đó, PZ-01 OVERLOAD kích hoạt END-03 ngay với lý do R-05", () => {
    const engine = createChapter1Engine();
    engine.store.changeScene("SC-02");
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.SIGN_LOGBOOK,
      targetId: "duty_logbook",
      sceneId: "SC-02"
    });
    expect(engine.store.snapshot().identityOverwriteCount).toBe(1);

    engine.store.changeScene("SC-04");
    engine.puzzles.submitSolution("PZ-01", "OVERLOAD");
    const state = engine.store.snapshot();
    expect(state.identityOverwriteCount).toBe(2);
    expect(state.activeEndingId).toBe("END-03");
    expect(state.deathReason).toBe(CHAPTER1_DEATH_REASONS.R05_OVERLOAD);
  });

  it("PZ02-ENG-01: Chặn PZ-02 khi thiếu LOW, thiếu radar_low_scanned hoặc thiếu C-02; quét radar sai nguồn kích hoạt R-07", () => {
    const engine = createChapter1Engine();
    engine.store.changeScene("SC-05");
    engine.dispatcher.dispatch({ type: "SCENE_ENTERED", sceneId: "SC-05" });

    // Chưa LOW -> quét radar kích hoạt R-07 và không mở radar_low_scanned
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.USE_OBSERVATION_GEAR,
      targetId: "observation_gear",
      sceneId: "SC-05"
    });
    expect(engine.rules.getViolationCount("R-07")).toBe(1);
    expect(engine.store.snapshot().triggeredOnceIds).not.toContain("radar_low_scanned");
    expect(engine.puzzles.submitSolution("PZ-02", "2714").status).toBe("missing_items");

    // Chuyển LOW nhưng chưa quét radar & chưa có C-02 -> vẫn bị chặn
    engine.store.addItem("I-04");
    engine.store.changeScene("SC-04");
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.USE_ITEM,
      targetId: "power_fuse_slot",
      sceneId: "SC-04"
    });
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.USE_ITEM,
      targetId: "aux_branch_off",
      sceneId: "SC-04"
    });
    expect(engine.puzzles.submitSolution("PZ-01", "LOW").status).toBe("solved");
    engine.store.changeScene("SC-05");
    expect(engine.puzzles.submitSolution("PZ-02", "2714").status).toBe("missing_items");

    // Quét radar ở LOW -> mở radar_low_scanned, nhưng thiếu C-02 -> vẫn bị chặn
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.USE_OBSERVATION_GEAR,
      targetId: "observation_gear",
      sceneId: "SC-05"
    });
    expect(engine.store.snapshot().triggeredOnceIds).toContain("radar_low_scanned");
    expect(engine.rules.getViolationCount("R-07")).toBe(1);
    expect(engine.puzzles.submitSolution("PZ-02", "2714").status).toBe("missing_items");

    // Có đủ C-02 -> thử mã sai tăng attemptsUsed và chưa cấp I-05/C-08
    engine.store.discoverClue("C-02");
    const badRes = engine.puzzles.submitSolution("PZ-02", "0000");
    expect(badRes.status).toBe("failed");
    expect(engine.puzzles.getAttemptCount("PZ-02")).toBe(1);
    expect(engine.store.snapshot().inventoryItemIds).not.toContain("I-05");
    expect(engine.store.snapshot().discoveredClueIds).not.toContain("C-08");

    // Đủ điều kiện + đúng mã 2714 -> giải thành công, cấp I-05 và C-08
    const okRes = engine.puzzles.submitSolution("PZ-02", "2714");
    expect(okRes.status).toBe("solved");
    expect(engine.store.snapshot().inventoryItemIds).toContain("I-05");
    expect(engine.store.snapshot().discoveredClueIds).toContain("C-08");
  });

  it("PZ03-ENG-01: Yêu cầu đủ I-06 + C-05; giải PZ-03 chỉ nhả chốt cơ khí và vẫn chịu khóa liên động R-08", () => {
    const engine = createChapter1Engine();
    engine.store.changeScene("SC-05");

    expect(engine.puzzles.submitSolution("PZ-03", "6208").status).toBe("missing_items");

    engine.store.addItem("I-06");
    expect(engine.puzzles.submitSolution("PZ-03", "6208").status).toBe("missing_items");

    engine.store.discoverClue("C-05");
    expect(engine.puzzles.submitSolution("PZ-03", "6208").status).toBe("solved");
    expect(engine.puzzles.isSolved("PZ-03")).toBe(true);

    // Khi radio vẫn broadcasting: lần 1 vi phạm R-08, lần 2 vẫn bị điều kiện radio_state !== paused chặn tại UI
    expect(engine.store.snapshot().flags.radio_state).toBe("broadcasting");
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.OPEN_LANTERN_DOOR,
      targetId: "lantern_door",
      sceneId: "SC-05"
    });
    expect(engine.rules.getViolationCount("R-08")).toBe(1);
    expect(engine.store.snapshot().flags.radio_state).toBe("broadcasting");
  });

  it("PZ01-UI-01: PZ-01 hiển thị 3 công tắc công nghiệp không có input văn bản hay nhãn bẫy; C-04 giải thích đủ 3 chế độ", () => {
    const engine = createChapter1Engine();
    engine.store.changeScene("SC-04");

    const html = renderToStaticMarkup(
      createElement(App, { initialEngine: engine, initialActiveModal: "puzzles" })
    );
    expect(html).toContain('data-testid="puzzle-card-PZ-01"');
    expect(html).toContain("LOW");
    expect(html).toContain("NORMAL");
    expect(html).toContain("OVERLOAD");
    expect(html).toContain("mode-overload");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("TRAP");
    expect(html).not.toContain("DEATH");
    expect(html).not.toContain("WRONG");

    const c04 = CLUES_BY_ID.get("C-04")!;
    expect(c04.detailContent).toContain("LOW");
    expect(c04.detailContent).toContain("NORMAL");
    expect(c04.detailContent).toContain("OVERLOAD");
  });

  it("PZ02-UI-01: Chỉ hiển thị manh mối đã thu thập, khóa bánh răng 4 số khi thiếu điều kiện và không rò rỉ đáp án 2714", () => {
    const engine = createChapter1Engine();
    engine.store.changeScene("SC-05");

    const lockedHtml = renderToStaticMarkup(
      createElement(PuzzleModalContent, {
        scenePuzzles: engine.puzzles.getPuzzlesForScene("SC-05"),
        state: engine.store.snapshot(),
        cluesById: CLUES_BY_ID,
        itemsMeta: CHAPTER1_ITEMS,
        onSubmitPuzzle: () => {},
        onScanRadar: () => {}
      })
    );

    expect(lockedHtml).toContain("Vai trò chế độ LOW");
    expect(lockedHtml).toContain("Radar độc lập với Camera");
    expect(lockedHtml).toContain("C-02 · CHƯA THU THẬP");
    expect(lockedHtml).toContain("C-04 · CHƯA THU THẬP");
    expect(lockedHtml).toContain("C-06 · CHƯA THU THẬP");
    expect(lockedHtml).not.toContain(CLUES_BY_ID.get("C-02")!.summary);
    expect(lockedHtml).toContain('wheel-lock-shell locked" data-testid="PZ-02-wheel-lock"');
    expect(lockedHtml).not.toContain("2714");

    // Sau khi đạt LOW + quét radar + có C-02/C-04 -> hiện tóm tắt đã tìm thấy, mở khóa bánh răng, vẫn không lộ 2714
    engine.store.addItem("I-04");
    engine.store.changeScene("SC-04");
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.USE_ITEM,
      targetId: "power_fuse_slot",
      sceneId: "SC-04"
    });
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.USE_ITEM,
      targetId: "aux_branch_off",
      sceneId: "SC-04"
    });
    expect(engine.puzzles.submitSolution("PZ-01", "LOW").status).toBe("solved");
    engine.store.changeScene("SC-05");
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.USE_OBSERVATION_GEAR,
      targetId: "observation_gear",
      sceneId: "SC-05"
    });
    engine.store.discoverClue("C-02");
    engine.store.discoverClue("C-04");

    const unlockedHtml = renderToStaticMarkup(
      createElement(PuzzleModalContent, {
        scenePuzzles: engine.puzzles.getPuzzlesForScene("SC-05"),
        state: engine.store.snapshot(),
        cluesById: CLUES_BY_ID,
        itemsMeta: CHAPTER1_ITEMS,
        onSubmitPuzzle: () => {},
        onScanRadar: () => {}
      })
    );

    expect(unlockedHtml).toContain(CLUES_BY_ID.get("C-02")!.summary);
    expect(unlockedHtml).toContain(CLUES_BY_ID.get("C-04")!.summary);
    expect(unlockedHtml).toContain("C-06 · CHƯA THU THẬP");
    expect(unlockedHtml).toContain("27° Bắc");
    expect(unlockedHtml).toContain("14′");
    expect(unlockedHtml).toContain('class="wheel-lock-shell " data-testid="PZ-02-wheel-lock"');
    expect(unlockedHtml).not.toContain("2714");
  });

  it("PZ03-UI-01: Hiển thị đúng mục tiêu, tách biệt chốt PZ-03 với R-08 và khóa đến khi đủ I-06 + C-05", () => {
    const engine = createChapter1Engine();
    engine.store.changeScene("SC-05");

    const lockedHtml = renderToStaticMarkup(
      createElement(PuzzleModalContent, {
        scenePuzzles: engine.puzzles.getPuzzlesForScene("SC-05"),
        state: engine.store.snapshot(),
        cluesById: CLUES_BY_ID,
        itemsMeta: CHAPTER1_ITEMS,
        onSubmitPuzzle: () => {},
        onScanRadar: () => {}
      })
    );

    expect(lockedHtml).toContain("Giải mã và nhả chốt khóa cơ học.");
    expect(lockedHtml).toContain("I-06 · CHƯA THU THẬP");
    expect(lockedHtml).toContain("C-05 · CHƯA THU THẬP");
    expect(lockedHtml).toContain('wheel-lock-shell locked" data-testid="PZ-03-wheel-lock"');
    expect(lockedHtml).toContain("CẦN TẠM DỪNG BỘ ĐÀM ĐỂ MỞ CỬA");
    expect(lockedHtml).not.toContain("6208");

    engine.store.addItem("I-06");
    engine.store.discoverClue("C-05");
    engine.store.setFlag("radio_state", "paused");

    const unlockedHtml = renderToStaticMarkup(
      createElement(PuzzleModalContent, {
        scenePuzzles: engine.puzzles.getPuzzlesForScene("SC-05"),
        state: engine.store.snapshot(),
        cluesById: CLUES_BY_ID,
        itemsMeta: CHAPTER1_ITEMS,
        onSubmitPuzzle: () => {},
        onScanRadar: () => {}
      })
    );

    expect(unlockedHtml).toContain("Công thức thực hành");
    expect(unlockedHtml).toContain("Cảnh báo liên động R-08");
    expect(unlockedHtml).toContain("BỘ ĐÀM PAUSED — LIÊN ĐỘNG CHO PHÉP MỞ CỬA");
    expect(unlockedHtml).toContain('class="wheel-lock-shell " data-testid="PZ-03-wheel-lock"');
    expect(unlockedHtml).not.toContain("6208");
  });

  it("SAVE-REG-01: Bảo toàn tiến trình giải đố, quét radar, ghi đè 1/2 qua save/load và giữ nguyên END-01 / END-02", () => {
    const engine = createChapter1Engine();
    engine.store.changeScene("SC-02");
    engine.store.discoverClue("C-01");
    engine.store.discoverClue("C-02");
    engine.store.discoverClue("C-04");
    engine.store.discoverClue("C-05");
    engine.store.discoverClue("C-07");
    engine.store.addItem("I-03");
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.USE_ITEM,
      targetId: "cassette_side_b",
      sceneId: "SC-02"
    });
    engine.store.addItem("I-04");
    engine.store.addItem("I-06");
    engine.store.setFlag("radio_state", "paused");

    engine.store.changeScene("SC-04");
    engine.puzzles.submitSolution("PZ-01", "OVERLOAD");
    expect(engine.store.snapshot().identityOverwriteCount).toBe(1);
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.USE_ITEM,
      targetId: "power_fuse_slot",
      sceneId: "SC-04"
    });
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.USE_ITEM,
      targetId: "aux_branch_off",
      sceneId: "SC-04"
    });
    expect(engine.puzzles.submitSolution("PZ-01", "LOW").status).toBe("solved");

    engine.store.changeScene("SC-05");
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.USE_OBSERVATION_GEAR,
      targetId: "observation_gear",
      sceneId: "SC-05"
    });
    expect(engine.puzzles.submitSolution("PZ-02", "2714").status).toBe("solved");
    expect(engine.puzzles.submitSolution("PZ-03", "6208").status).toBe("solved");

    // Xuất và nhập bản lưu vào engine mới
    const save = engine.store.exportSave("slot-mid-ch01");
    const restored = createChapter1Engine();
    const importOk = new GameStateStore(createInitialState());
    expect(importOk.importSave(save)).toBe(true);
    expect(restored.store.importSave(save)).toBe(true);
    restored.rules.syncLifecycles();

    const restoredSnap = restored.store.snapshot();
    expect(restoredSnap.identityOverwriteCount).toBe(1);
    expect(restoredSnap.triggeredOnceIds).toContain("radar_low_scanned");
    expect(restoredSnap.triggeredOnceIds).toContain("cassette_side_b_heard");
    expect(restoredSnap.powerPanelState).toEqual({ fuseInstalled: true, auxBranchOff: true });
    expect(restoredSnap.solvedPuzzleIds).toEqual(["PZ-01", "PZ-02", "PZ-03"]);

    // Sang SC-06, lắp bộ lọc đỏ và đảo pha xóa dữ liệu tồn dư -> mở khóa lại END-02 và END-01
    restored.store.changeScene("SC-06");
    restored.store.setFlag("red_filter_installed", true);
    expect(canReachEndingB(restored.store.snapshot())).toBe(false);

    restored.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.INVERT_SIGNAL_FREQUENCY,
      targetId: "frequency_panel",
      sceneId: "SC-06"
    });
    expect(canReachEndingB(restored.store.snapshot())).toBe(true);

    ["R-03", "R-04", "R-05"].forEach(id => restored.store.discoverRule(id));
    expect(restored.investigation.linkClueToRule("R-03", "C-02").ok).toBe(true);
    expect(restored.investigation.linkClueToRule("R-03", "C-07").ok).toBe(true);
    expect(restored.investigation.linkClueToRule("R-04", "C-01").ok).toBe(true);
    expect(restored.investigation.linkClueToRule("R-04", "C-08").ok).toBe(true);
    expect(restored.investigation.linkClueToRule("R-05", "C-04").ok).toBe(true);
    expect(restored.investigation.linkClueToRule("R-05", "C-08").ok).toBe(true);
    expect(canReachEndingS(restored.store.snapshot(), restored.investigation)).toBe(true);
  });
});
