import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ACTION_TAGS } from "../../types/common";
import type { SaveData } from "../../types/save";
import { GameStateStore, createInitialState } from "../../core/GameStateStore";
import { CHAPTER1_ARCHIVE_DOCUMENTS } from "../../data/chapter1Archive";
import { CHAPTER1_CLUES } from "../../data/chapter1Investigation";
import {
  CHAPTER1_DEATH_REASONS,
  attemptSceneTransition,
  canReachEndingB,
  canReachEndingS,
  createChapter1Engine
} from "../../data/chapter1Runtime";
import { ArchiveSystem } from "../ArchiveSystem";
import App from "../../ui/App";

function setupFullEndingSReadyEngine() {
  const engine = createChapter1Engine();
  ["R-02", "R-03", "R-04", "R-05", "R-06", "R-07", "R-08", "R-09"].forEach(id =>
    engine.store.discoverRule(id)
  );
  ["C-01", "C-02", "C-03", "C-04", "C-05", "C-06", "C-07", "C-08"].forEach(id =>
    engine.store.discoverClue(id)
  );
  engine.store.addItem("I-03");
  engine.store.addItem("I-04");
  engine.store.addItem("I-05");
  engine.store.addItem("I-06");

  engine.store.changeScene("SC-02");
  engine.store.setFlag("radio_state", "paused");
  engine.dispatcher.dispatch({
    type: "PLAYER_ACTION_PERFORMED",
    actionTag: ACTION_TAGS.USE_ITEM,
    targetId: "cassette_side_b",
    sceneId: "SC-02"
  });

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
  engine.puzzles.submitSolution("PZ-01", "LOW");

  engine.store.changeScene("SC-05");
  engine.dispatcher.dispatch({
    type: "PLAYER_ACTION_PERFORMED",
    actionTag: ACTION_TAGS.USE_OBSERVATION_GEAR,
    targetId: "observation_gear",
    sceneId: "SC-05"
  });
  engine.puzzles.submitSolution("PZ-02", "2714");
  engine.puzzles.submitSolution("PZ-03", "6208");

  engine.investigation.linkClueToRule("R-03", "C-02");
  engine.investigation.linkClueToRule("R-03", "C-07");
  engine.investigation.linkClueToRule("R-04", "C-01");
  engine.investigation.linkClueToRule("R-04", "C-08");
  engine.investigation.linkClueToRule("R-05", "C-04");
  engine.investigation.linkClueToRule("R-05", "C-08");

  engine.store.changeScene("SC-06");
  engine.store.setFlag("red_filter_installed", true);
  return engine;
}

describe("FIX08 — Canonical Gameplay Event & Validation Suite (T01..T14)", () => {
  it("T01: R-01 không kích hoạt END-03 trước khi sương áp sát; sau khi sương áp sát mới vi phạm R-01", () => {
    const engine = createChapter1Engine();

    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.OPEN_EXTERIOR_DOOR,
      targetId: "hs_exterior_door",
      sceneId: "SC-01"
    });
    expect(engine.rules.getViolationCount("R-01")).toBe(0);
    expect(engine.store.snapshot().activeEndingId).toBeNull();
    expect(engine.store.snapshot().flags.fog_breached).toBe(false);
    expect(engine.store.snapshot().logs.some(l => l.includes("Chốt cổng sắt vẫn khóa"))).toBe(true);

    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.INSPECT_OBJECT,
      targetId: "exterior_gate",
      sceneId: "SC-01"
    });
    expect(engine.store.snapshot().triggeredOnceIds).toContain("fog_approaching_door");

    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.OPEN_EXTERIOR_DOOR,
      targetId: "hs_exterior_door",
      sceneId: "SC-01"
    });
    expect(engine.rules.getViolationCount("R-01")).toBe(1);
    expect(engine.store.snapshot().flags.fog_breached).toBe(true);
    expect(engine.store.snapshot().entityStates["EN-01"]).toBe("stalking");
    expect(engine.store.snapshot().activeEndingId).toBe("END-03");
  });

  it("T02 & T03: R-02 chỉ phạt khi broadcasting; R-04 không tăng ruleViolationCounts nhưng ghi đè danh tính", () => {
    const engine = createChapter1Engine();
    engine.store.changeScene("SC-02");

    engine.store.setFlag("radio_state", "paused");
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.ANSWER_RADIO,
      targetId: "radio_microphone",
      sceneId: "SC-02"
    });
    expect(engine.rules.getViolationCount("R-02")).toBe(0);
    expect(engine.store.snapshot().identityOverwriteCount).toBe(0);

    engine.store.setFlag("radio_state", "broadcasting");
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.ANSWER_RADIO,
      targetId: "radio_microphone",
      sceneId: "SC-02"
    });
    expect(engine.rules.getViolationCount("R-02")).toBe(1);
    expect(engine.store.snapshot().identityOverwriteCount).toBe(1);

    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.SIGN_LOGBOOK,
      targetId: "duty_logbook",
      sceneId: "SC-02"
    });
    expect(engine.rules.getViolationCount("R-04")).toBe(0);
    expect(engine.store.snapshot().identityOverwriteCount).toBe(2);
    expect(engine.store.snapshot().activeEndingId).toBe("END-03");
  });

  it("T04: R-09 không vi phạm trước captain_missing_confirmed; biến đổi sau khi xác nhận và DISCONNECT_PHONE ngăn bẫy", () => {
    const engine = createChapter1Engine();
    engine.store.changeScene("SC-02");

    // Trước khi xác nhận trạm trưởng mất tích -> nghe điện thoại không vi phạm R-09
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.ANSWER_PHONE,
      targetId: "internal_phone",
      sceneId: "SC-02"
    });
    expect(engine.rules.getViolationCount("R-09")).toBe(0);
    expect(engine.store.snapshot().identityOverwriteCount).toBe(0);
    expect(engine.store.snapshot().activeEndingId).toBeNull();

    // Xác nhận mất tích -> R-09 biến đổi
    engine.store.setFlag("captain_missing_confirmed", true);
    engine.dispatcher.dispatch({
      type: "STATE_CHANGED",
      domain: "flags",
      targetId: "captain_missing_confirmed",
      sceneId: "SC-02"
    });
    expect(engine.rules.getRuleLifecycle("R-09")).toBe("transformed");

    // Ngắt kết nối điện thoại bằng DISCONNECT_PHONE -> an toàn, ngăn bẫy
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.DISCONNECT_PHONE,
      targetId: "internal_phone",
      sceneId: "SC-02"
    });
    expect(engine.store.snapshot().triggeredOnceIds).toContain("phone_disconnected");

    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.ANSWER_PHONE,
      targetId: "internal_phone",
      sceneId: "SC-02"
    });
    expect(engine.rules.getViolationCount("R-09")).toBe(0);
    expect(engine.store.snapshot().identityOverwriteCount).toBe(0);
  });

  it("T05: Băng cassette I-03 tách biệt Mặt A (C-05) và Mặt B; Mặt A không làm lộ nội dung Mặt B", () => {
    const engine = createChapter1Engine();
    const archive = new ArchiveSystem(engine.store, engine.evaluator, CHAPTER1_ARCHIVE_DOCUMENTS);
    engine.store.changeScene("SC-02");

    // Không có I-03 -> không thể phát Mặt B
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.USE_ITEM,
      targetId: "cassette_side_b",
      sceneId: "SC-02"
    });
    expect(engine.store.snapshot().triggeredOnceIds).not.toContain("cassette_side_b_heard");

    // Có I-03 và phát Mặt A -> mở C-05 (R-06 & R-08), không lộ nội dung Mặt B và chưa mở DOC-ORIGINAL-CASSETTE
    engine.store.addItem("I-03");
    engine.store.discoverClue("C-05");
    const c05 = CHAPTER1_CLUES.find(c => c.id === "C-05")!;
    expect(c05.relatedRuleIds).toEqual(["R-06", "R-08"]);
    expect(c05.detailContent).not.toContain("Bố Hùng ơi");
    expect(c05.detailContent).not.toContain("Bố nhớ ăn tối");
    expect(archive.isUnlocked("DOC-ORIGINAL-CASSETTE")).toBe(false);
    expect(engine.store.snapshot().triggeredOnceIds).not.toContain("cassette_side_b_heard");

    // Chọn phát Mặt B -> ghi nhận cassette_side_b_heard và mở tài liệu Mặt B
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.USE_ITEM,
      targetId: "cassette_side_b",
      sceneId: "SC-02"
    });
    expect(engine.store.snapshot().triggeredOnceIds).toContain("cassette_side_b_heard");
    expect(archive.isUnlocked("DOC-ORIGINAL-CASSETTE")).toBe(true);
  });

  it("T06: Vào SC-03 (SCENE_ENTERED) đặt locker_knocking = true; kiểm tra tủ không chết, mở tủ khi có tiếng gõ gây END-03", () => {
    const engine = createChapter1Engine();
    engine.store.discoverClue("C-01");

    const res = attemptSceneTransition(engine, "SC-02");
    expect(res.ok).toBe(true);
    const enterSc03 = attemptSceneTransition(engine, "SC-03");
    expect(enterSc03.ok).toBe(true);

    expect(engine.store.snapshot().flags.locker_knocking).toBe(true);
    expect(engine.store.snapshot().logs.some(l => l.includes("ba tiếng gõ"))).toBe(true);

    // Áp tai kiểm tra tủ 04 không gây tử vong
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.INSPECT_OBJECT,
      targetId: "locker_04",
      sceneId: "SC-03"
    });
    expect(engine.store.snapshot().activeEndingId).toBeNull();

    // Mở tủ 04 khi locker_knocking === true -> END-03
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.OPEN_LOCKER_04,
      targetId: "locker_04",
      sceneId: "SC-03"
    });
    expect(engine.store.snapshot().activeEndingId).toBe("END-03");
    expect(engine.store.snapshot().deathReason).toBe(CHAPTER1_DEATH_REASONS.R06_LOCKER_04);
  });

  it("T07 & T08 & T09: PZ-01 đòi hỏi I-04 + cầu chì + AUX OFF; R-08 từ chối cả radio broadcasting và off khi mở cửa SC-06", () => {
    const engine = createChapter1Engine();
    engine.store.changeScene("SC-04");
    engine.store.addItem("I-04");

    // Thiếu lắp cầu chì & ngắt AUX -> LOW bị từ chối
    expect(engine.puzzles.submitSolution("PZ-01", "LOW").status).toBe("missing_items");

    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.USE_ITEM,
      targetId: "power_fuse_slot",
      sceneId: "SC-04"
    });
    // Vẫn thiếu AUX OFF -> LOW bị từ chối
    expect(engine.puzzles.submitSolution("PZ-01", "LOW").status).toBe("missing_items");

    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.USE_ITEM,
      targetId: "aux_branch_off",
      sceneId: "SC-04"
    });
    expect(engine.puzzles.submitSolution("PZ-01", "LOW").status).toBe("solved");
    expect(engine.store.snapshot().flags.power_mode).toBe("low");

    // Sang SC-05, giải PZ-02 & PZ-03
    expect(attemptSceneTransition(engine, "SC-05").ok).toBe(true);
    engine.store.discoverClue("C-02");
    engine.store.discoverClue("C-05");
    engine.store.addItem("I-06");
    engine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.USE_OBSERVATION_GEAR,
      targetId: "observation_gear",
      sceneId: "SC-05"
    });
    expect(engine.puzzles.submitSolution("PZ-02", "2714").status).toBe("solved");

    // Chưa giải PZ-03 -> không thể vào SC-06 ngay cả khi radio_state === paused
    engine.store.setFlag("radio_state", "paused");
    const lockedRes = attemptSceneTransition(engine, "SC-06");
    expect(lockedRes.ok).toBe(false);
    expect(engine.store.snapshot().currentSceneId).toBe("SC-05");
    expect(engine.store.snapshot().activeEndingId).toBeNull();

    // Giải PZ-03 xong, kiểm tra radio broadcasting và radio off đều bị R-08 từ chối (không END-03)
    expect(engine.puzzles.submitSolution("PZ-03", "6208").status).toBe("solved");
    engine.store.setFlag("radio_state", "broadcasting");
    const resBroadcasting = attemptSceneTransition(engine, "SC-06");
    expect(resBroadcasting.ok).toBe(false);
    expect(engine.store.snapshot().currentSceneId).toBe("SC-05");
    expect(engine.store.snapshot().activeEndingId).toBeNull();

    engine.store.setFlag("radio_state", "off");
    const resOff = attemptSceneTransition(engine, "SC-06");
    expect(resOff.ok).toBe(false);
    expect(engine.store.snapshot().currentSceneId).toBe("SC-05");
    expect(engine.store.snapshot().activeEndingId).toBeNull();

    // Chỉ khi radio_state === paused và PZ-03 đã giải mới vào được SC-06
    engine.store.setFlag("radio_state", "paused");
    const okRes = attemptSceneTransition(engine, "SC-06");
    expect(okRes.ok).toBe(true);
    expect(engine.store.snapshot().currentSceneId).toBe("SC-06");
  });

  it("T10: R-10 không phạt trước khi biến đổi; sau khi biến đổi (LOW/fog_breached) chặn di chuyển khi đèn pin bật", () => {
    const engine = createChapter1Engine();
    engine.store.setFlag("flashlight_on", true);

    // power_mode = normal, fog_breached = false -> R-10 chưa biến đổi -> rời SC-01 an toàn
    const safeMove = attemptSceneTransition(engine, "SC-02");
    expect(safeMove.ok).toBe(true);
    expect(engine.rules.getViolationCount("R-10")).toBe(0);

    // Sau khi fog_breached = true -> R-10 biến đổi -> rời cảnh khi đèn pin bật bị chặn cả ở lần 1 và lần 2
    engine.store.setFlag("fog_breached", true);
    engine.dispatcher.dispatch({
      type: "STATE_CHANGED",
      domain: "flags",
      targetId: "fog_breached",
      sceneId: "SC-02"
    });
    engine.store.discoverClue("C-01");

    const blocked1 = attemptSceneTransition(engine, "SC-03");
    const blocked2 = attemptSceneTransition(engine, "SC-03");
    expect(blocked1.ok).toBe(false);
    expect(blocked2.ok).toBe(false);
    expect(engine.rules.getViolationCount("R-10")).toBe(1);
    expect(engine.store.snapshot().currentSceneId).toBe("SC-02");

    // Tắt đèn pin -> di chuyển được
    engine.store.setFlag("flashlight_on", false);
    const unblocked = attemptSceneTransition(engine, "SC-03");
    expect(unblocked.ok).toBe(true);
    expect(engine.store.snapshot().currentSceneId).toBe("SC-03");
  });

  it("T11 & T12: Kiểm chứng điều kiện END-02 (CUT_MAIN_RELAY) và END-01 (INVERT_SIGNAL_FREQUENCY) tại biên thực thi", () => {
    // Thiếu Mặt B băng cassette -> không thể kích hoạt END-01 cả qua action lẫn executor trực tiếp
    const missingSideB = setupFullEndingSReadyEngine();
    const stateMut = missingSideB.store.exportSave("tmp");
    stateMut.state.triggeredOnceIds = stateMut.state.triggeredOnceIds.filter(
      id => id !== "cassette_side_b_heard"
    );
    missingSideB.store.importSave(stateMut);

    expect(canReachEndingS(missingSideB.store.snapshot(), missingSideB.investigation)).toBe(false);
    missingSideB.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.INVERT_SIGNAL_FREQUENCY,
      targetId: "frequency_ending_s",
      sceneId: "SC-06"
    });
    expect(missingSideB.store.snapshot().activeEndingId).toBeNull();
    missingSideB.executor.execute({ effects: [{ type: "TRIGGER_ENDING", endingId: "END-01" }] });
    expect(missingSideB.store.snapshot().activeEndingId).toBeNull();

    // Thiếu red_filter_installed -> không thể kích hoạt END-02 cả qua CUT_MAIN_RELAY lẫn executor
    const missingFilter = setupFullEndingSReadyEngine();
    missingFilter.store.setFlag("red_filter_installed", false);
    expect(canReachEndingB(missingFilter.store.snapshot())).toBe(false);
    missingFilter.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.CUT_MAIN_RELAY,
      targetId: "main_relay",
      sceneId: "SC-06"
    });
    expect(missingFilter.store.snapshot().activeEndingId).toBeNull();
    missingFilter.executor.execute({ effects: [{ type: "TRIGGER_ENDING", endingId: "END-02" }] });
    expect(missingFilter.store.snapshot().activeEndingId).toBeNull();

    // Đủ điều kiện END-02 -> CUT_MAIN_RELAY kích hoạt END-02
    const endingBEngine = setupFullEndingSReadyEngine();
    endingBEngine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.CUT_MAIN_RELAY,
      targetId: "main_relay",
      sceneId: "SC-06"
    });
    expect(endingBEngine.store.snapshot().activeEndingId).toBe("END-02");

    // Có identity_exposed = true -> khôi phục trước rồi mới đạt END-01, không nhảy thẳng từ recovery sang END-01
    const endingSEngine = setupFullEndingSReadyEngine();
    endingSEngine.store.setFlag("identity_exposed", true);
    endingSEngine.store.recordIdentityOverwrite(CHAPTER1_DEATH_REASONS.R04_SIGN);
    endingSEngine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.INVERT_SIGNAL_FREQUENCY,
      targetId: "frequency_recovery_panel",
      sceneId: "SC-06"
    });
    expect(endingSEngine.store.snapshot().flags.identity_exposed).toBe(false);
    expect(endingSEngine.store.snapshot().activeEndingId).toBeNull();

    endingSEngine.dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.INVERT_SIGNAL_FREQUENCY,
      targetId: "frequency_ending_s",
      sceneId: "SC-06"
    });
    expect(endingSEngine.store.snapshot().activeEndingId).toBe("END-01");
  });

  it("T13: Giữ đúng 8 flags cốt lõi và tương thích save/load (cũ & mới)", () => {
    const engine = createChapter1Engine();
    expect(Object.keys(engine.store.snapshot().flags)).toHaveLength(8);

    const save = engine.store.exportSave("slot-legacy-check");
    const legacyState = { ...save.state } as Record<string, unknown>;
    delete legacyState.powerPanelState;

    const restored = new GameStateStore(createInitialState());
    expect(restored.importSave({ ...save, state: legacyState } as unknown as SaveData)).toBe(true);
    expect(restored.snapshot().powerPanelState).toEqual({ fuseInstalled: false, auxBranchOff: false });
    expect(Object.keys(restored.snapshot().flags)).toHaveLength(8);
  });

  it("T14: UI render đúng các thao tác SC-02 (Mặt A/B, radio pause/off, ngắt điện thoại), SC-04 (cầu chì & AUX), SC-06 (END-01/02)", () => {
    const engine = createChapter1Engine();
    engine.store.changeScene("SC-02");
    const sc02Html = renderToStaticMarkup(createElement(App, { initialEngine: engine }));
    expect(sc02Html).toContain("Phát băng cassette (Mặt A)");
    expect(sc02Html).toContain("Phát băng cassette (Mặt B)");
    expect(sc02Html).toContain("Tạm dừng bộ đàm (PAUSED)");
    expect(sc02Html).toContain("Tắt nguồn bộ đàm (OFF)");
    expect(sc02Html).toContain("Ngắt kết nối điện thoại nội bộ");

    engine.store.changeScene("SC-04");
    const sc04Html = renderToStaticMarkup(
      createElement(App, { initialEngine: engine, initialActiveModal: "puzzles" })
    );
    expect(sc04Html).toContain('data-testid="PZ-01-panel-prep"');
    expect(sc04Html).toContain("Lắp Cầu chì 30A (I-04)");
    expect(sc04Html).toContain("Ngắt nhánh phụ (AUX OFF)");
  });
});
