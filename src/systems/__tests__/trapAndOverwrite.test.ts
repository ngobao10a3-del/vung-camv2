import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ACTION_TAGS } from "../../types/common";
import type { SaveData } from "../../types/save";
import { GameStateStore, createInitialState } from "../../core/GameStateStore";
import { CHAPTER1_DIALOGUES } from "../../data/chapter1Dialogues";
import {
  CHAPTER1_DEATH_REASONS,
  canReachEndingB,
  canReachEndingS,
  canRecoverIdentityAtLanternRoom,
  createChapter1Engine
} from "../../data/chapter1Runtime";
import App from "../../ui/App";
import { DialoguePanel } from "../../ui/DialoguePanel";

describe("Phase A — Trap Mechanics, Neutral UI & Two-Stage Overwrite", () => {
  it("TRAP-01: R-01 mở cửa ngoài gây END-03 ngay lập tức, ghi rõ deathReason và chặn hành động sau ending", () => {
    const engine = createChapter1Engine();

    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.OPEN_EXTERIOR_DOOR,
      targetId: "hs_exterior_door",
      sceneId: "SC-01"
    });

    const state = engine.store.snapshot();
    expect(state.activeEndingId).toBe("END-03");
    expect(state.flags.fog_breached).toBe(true);
    expect(state.deathReason).toBe(CHAPTER1_DEATH_REASONS.R01_EXTERIOR_DOOR);

    // Các hành động tiếp theo sau ending không được làm thay đổi trạng thái
    engine.store.setFlag("locker_knocking", true);
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.SIGN_LOGBOOK,
      targetId: "duty_logbook",
      sceneId: "SC-02"
    });
    expect(engine.store.snapshot().identityOverwriteCount).toBe(0);
    expect(engine.store.snapshot().deathReason).toBe(CHAPTER1_DEATH_REASONS.R01_EXTERIOR_DOOR);
  });

  it("TRAP-02: R-03 bước vào vùng sáng trung tâm khi chưa lắp bộ lọc đỏ kích hoạt END-03 ngay lập tức", () => {
    const engine = createChapter1Engine();
    engine.store.changeScene("SC-06");

    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.ENTER_LANTERN_BEAM,
      targetId: "central_beam",
      sceneId: "SC-06"
    });

    const state = engine.store.snapshot();
    expect(state.activeEndingId).toBe("END-03");
    expect(state.deathReason).toBe(CHAPTER1_DEATH_REASONS.R03_LANTERN_BEAM);
  });

  it("TRAP-03: R-03 an toàn nếu đã lắp bộ lọc đỏ", () => {
    const engine = createChapter1Engine();
    engine.store.changeScene("SC-06");
    engine.store.setFlag("red_filter_installed", true);

    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.ENTER_LANTERN_BEAM,
      targetId: "central_beam",
      sceneId: "SC-06"
    });

    expect(engine.store.snapshot().activeEndingId).toBeNull();
    expect(engine.rules.getViolationCount("R-03")).toBe(0);
  });

  it("TRAP-04: R-06 chỉ gây END-03 ngay lập tức khi locker_knocking === true", () => {
    const engine = createChapter1Engine();
    engine.store.changeScene("SC-03");

    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.OPEN_LOCKER_04,
      targetId: "locker_04",
      sceneId: "SC-03"
    });
    expect(engine.store.snapshot().activeEndingId).toBeNull();

    engine.store.setFlag("locker_knocking", true);
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.OPEN_LOCKER_04,
      targetId: "locker_04",
      sceneId: "SC-03"
    });

    const state = engine.store.snapshot();
    expect(state.activeEndingId).toBe("END-03");
    expect(state.entityStates["EN-02"]).toBe("stalking");
    expect(state.deathReason).toBe(CHAPTER1_DEATH_REASONS.R06_LOCKER_04);
  });

  it("TRAP-05: Bẫy ghi đè giai đoạn 1/2 (R-04 ký sổ) cảnh báo và cho phép tiếp tục chơi", () => {
    const engine = createChapter1Engine();
    engine.store.changeScene("SC-02");

    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.SIGN_LOGBOOK,
      targetId: "duty_logbook",
      sceneId: "SC-02"
    });

    const state = engine.store.snapshot();
    expect(state.identityOverwriteCount).toBe(1);
    expect(state.flags.identity_exposed).toBe(true);
    expect(state.lastOverwriteReason).toBe(CHAPTER1_DEATH_REASONS.R04_SIGN);
    expect(state.activeEndingId).toBeNull();
    expect(state.logs.some(log => log.includes("MỨC GHI ĐÈ: 1/2 — CẢNH BÁO NGUY HIỂM"))).toBe(true);
  });

  it("TRAP-06: Bẫy ghi đè giai đoạn 2/2 (R-04 rồi R-02) kích hoạt END-03 ngay và giữ đúng lý do bẫy thứ 2", () => {
    const engine = createChapter1Engine();
    engine.store.changeScene("SC-02");

    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.SIGN_LOGBOOK,
      targetId: "duty_logbook",
      sceneId: "SC-02"
    });
    expect(engine.store.snapshot().identityOverwriteCount).toBe(1);

    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.ANSWER_RADIO,
      targetId: "radio_microphone",
      sceneId: "SC-02"
    });

    const state = engine.store.snapshot();
    expect(state.identityOverwriteCount).toBe(2);
    expect(state.activeEndingId).toBe("END-03");
    expect(state.deathReason).toBe(CHAPTER1_DEATH_REASONS.R02_RADIO);
    expect(state.logs.some(log => log.includes("MỨC GHI ĐÈ: 2/2 — DANH TÍNH ĐÃ BỊ GHI ĐÈ"))).toBe(true);
  });

  it("TRAP-07: Lặp lại cùng một bẫy không bao giờ cộng dồn identityOverwriteCount lên 2", () => {
    const engine = createChapter1Engine();
    engine.store.changeScene("SC-02");

    for (let i = 0; i < 3; i++) {
      engine.dispatcher.dispatch({
        type: "PLAYER_ACTION_PERFORMED",
        actionTag: ACTION_TAGS.SIGN_LOGBOOK,
        targetId: "duty_logbook",
        sceneId: "SC-02"
      });
    }
    expect(engine.store.snapshot().identityOverwriteCount).toBe(1);
    expect(engine.store.snapshot().activeEndingId).toBeNull();

    // Tương tự: R-05 qua SC-04 switch và qua PZ-01 OVERLOAD chỉ tính một lần
    const overloadEngine = createChapter1Engine();
    overloadEngine.store.changeScene("SC-04");
    overloadEngine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.USE_ITEM,
      targetId: "power_overload_switch",
      sceneId: "SC-04"
    });
    expect(overloadEngine.store.snapshot().identityOverwriteCount).toBe(1);

    overloadEngine.puzzles.submitSolution("PZ-01", "OVERLOAD");
    expect(overloadEngine.store.snapshot().identityOverwriteCount).toBe(1);
    expect(overloadEngine.store.snapshot().activeEndingId).toBeNull();
  });

  it("TRAP-08: R-09 nghe điện thoại nội bộ tính 1 lần ghi đè; kết hợp R-05 OVERLOAD gây END-03", () => {
    const engine = createChapter1Engine();
    engine.store.changeScene("SC-02");
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.ANSWER_PHONE,
      targetId: "internal_phone",
      sceneId: "SC-02"
    });
    expect(engine.store.snapshot().identityOverwriteCount).toBe(1);
    expect(engine.store.snapshot().activeEndingId).toBeNull();

    engine.store.changeScene("SC-04");
    const res = engine.puzzles.submitSolution("PZ-01", "OVERLOAD");
    expect(res.status).toBe("failed");

    const state = engine.store.snapshot();
    expect(state.identityOverwriteCount).toBe(2);
    expect(state.activeEndingId).toBe("END-03");
    expect(state.deathReason).toBe(CHAPTER1_DEATH_REASONS.R05_OVERLOAD);
  });

  it("TRAP-09: Khôi phục danh tính hợp lệ tại SC-06 (INVERT_SIGNAL_FREQUENCY) mở lại Ending B/S nhưng vẫn giữ identityOverwriteCount = 1", () => {
    const engine = createChapter1Engine();
    engine.store.changeScene("SC-02");
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.REPORT_ID,
      targetId: "radio_microphone",
      sceneId: "SC-02"
    });
    expect(engine.store.snapshot().identityOverwriteCount).toBe(1);
    expect(engine.store.snapshot().flags.identity_exposed).toBe(true);

    // Chuẩn bị điều kiện kết thúc S nhưng còn dính identity_exposed
    ["R-03", "R-04", "R-05"].forEach(id => engine.store.discoverRule(id));
    ["C-01", "C-02", "C-04", "C-05", "C-07", "C-08"].forEach(id => engine.store.discoverClue(id));
    expect(engine.investigation.linkClueToRule("R-03", "C-02").ok).toBe(true);
    expect(engine.investigation.linkClueToRule("R-03", "C-07").ok).toBe(true);
    expect(engine.investigation.linkClueToRule("R-04", "C-01").ok).toBe(true);
    expect(engine.investigation.linkClueToRule("R-04", "C-08").ok).toBe(true);
    expect(engine.investigation.linkClueToRule("R-05", "C-04").ok).toBe(true);
    expect(engine.investigation.linkClueToRule("R-05", "C-08").ok).toBe(true);
    engine.store.setFlag("red_filter_installed", true);
    engine.store.changeScene("SC-06");
    engine.dispatcher.dispatch({ type: "SCENE_ENTERED", sceneId: "SC-06" });

    // Không tự khôi phục khi chỉ vào SC-06
    expect(engine.store.snapshot().flags.identity_exposed).toBe(true);
    expect(canReachEndingB(engine.store.snapshot())).toBe(false);
    expect(canReachEndingS(engine.store.snapshot(), engine.investigation)).toBe(false);
    expect(canRecoverIdentityAtLanternRoom(engine.store.snapshot())).toBe(true);

    // Thực hiện thao tác đảo pha tần số tại SC-06
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.INVERT_SIGNAL_FREQUENCY,
      targetId: "frequency_panel",
      sceneId: "SC-06"
    });

    const post = engine.store.snapshot();
    expect(post.flags.identity_exposed).toBe(false);
    expect(post.identityOverwriteCount).toBe(1);
    expect(post.lastOverwriteReason).toBe(CHAPTER1_DEATH_REASONS.R04_REPORT);
    expect(canReachEndingB(post)).toBe(true);
    expect(canReachEndingS(post, engine.investigation)).toBe(true);
  });

  it("TRAP-10: Tương thích ngược SaveData cũ và chuẩn hóa identityOverwriteCount về khoảng 0..2", () => {
    const store = new GameStateStore(createInitialState("CH-01", "SC-02"));
    const save = store.exportSave("slot-legacy");

    const legacyState = { ...save.state } as Record<string, unknown>;
    delete legacyState.identityOverwriteCount;
    delete legacyState.lastOverwriteReason;
    delete legacyState.deathReason;

    const restored = new GameStateStore(createInitialState());
    expect(restored.importSave({ ...save, state: legacyState } as unknown as SaveData)).toBe(true);
    expect(restored.snapshot().identityOverwriteCount).toBe(0);
    expect(restored.snapshot().lastOverwriteReason).toBeUndefined();

    const overflowSave = store.exportSave("slot-overflow");
    (overflowSave.state as unknown as Record<string, unknown>).identityOverwriteCount = 9;
    expect(restored.importSave(overflowSave)).toBe(true);
    expect(restored.snapshot().identityOverwriteCount).toBe(2);
  });

  it("UI-NEUTRAL-01: Nút bẫy, hotspot và DialoguePanel không có lớp cảnh báo đỏ hay dấu '!' hay bước xác nhận thừa", () => {
    for (const sceneId of ["SC-01", "SC-02", "SC-03", "SC-04", "SC-06"]) {
      const engine = createChapter1Engine();
      engine.store.changeScene(sceneId);
      if (sceneId === "SC-03") {
        engine.store.setFlag("locker_knocking", true);
      }
      const html = renderToStaticMarkup(createElement(App, { initialEngine: engine }));
      expect(html).not.toContain("choice-warn-mark");
      expect(html).not.toContain("risky-choice");
      expect(html).not.toContain('class="choice-btn danger');
      expect(html).not.toContain('class="hotspot-node danger');
      expect(html).not.toContain("Xác nhận mở");
      expect(html).not.toContain("Xác nhận ký");
      expect(html).not.toContain("Xác nhận báo");
      expect(html).not.toContain("Xác nhận gạt");
    }

    const dlgEngine = createChapter1Engine();
    dlgEngine.store.changeScene("SC-02");
    dlgEngine.dialogue.startDialogue("DLG-SC02-RADIO");
    const node = dlgEngine.dialogue.getCurrentNode()!;
    const dlgHtml = renderToStaticMarkup(
      createElement(DialoguePanel, {
        dialogueSystem: dlgEngine.dialogue,
        node,
        activeDialogue: CHAPTER1_DIALOGUES[1],
        onStateChange: () => {},
        onCloseDialogue: () => {}
      })
    );
    expect(dlgHtml).not.toContain("risky-choice");
    expect(dlgHtml).not.toContain("choice-warn-mark");
    expect(dlgHtml).toContain("Lắng nghe phần phát thanh đang chạy");
  });

  it("UI-OVERWRITE-01: Panel vô tuyến hiển thị đúng cảnh báo 1/2 và màn hình END-03 hiển thị 2/2 + deathReason", () => {
    const engine = createChapter1Engine();
    engine.store.changeScene("SC-02");
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.SIGN_LOGBOOK,
      targetId: "duty_logbook",
      sceneId: "SC-02"
    });

    const stage1Html = renderToStaticMarkup(createElement(App, { initialEngine: engine }));
    expect(stage1Html).toContain("anomaly-active");
    expect(stage1Html).toContain("MỨC GHI ĐÈ: 1/2 — CẢNH BÁO NGUY HIỂM");

    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.ANSWER_RADIO,
      targetId: "radio_microphone",
      sceneId: "SC-02"
    });

    const stage2Html = renderToStaticMarkup(createElement(App, { initialEngine: engine }));
    expect(stage2Html).toContain("MỨC GHI ĐÈ: 2/2 — DANH TÍNH ĐÃ BỊ GHI ĐÈ");
    expect(stage2Html).toContain(CHAPTER1_DEATH_REASONS.R02_RADIO);
  });
});
