import { beforeEach, describe, expect, it } from "vitest";
import type { SaveData } from "../../types/save";
import { ConditionEvaluator } from "../../core/ConditionEvaluator";
import { EffectExecutor } from "../../core/EffectExecutor";
import { EventDispatcher } from "../../core/EventDispatcher";
import { createInitialState, GameStateStore } from "../../core/GameStateStore";
import { CHAPTER1_CHARACTERS } from "../../data/characters";
import { CHAPTER1_DIALOGUES } from "../../data/chapter1Dialogues";
import { DialogueSystem } from "../DialogueSystem";

describe("DialogueSystem Suite (FIX18)", () => {
  let store: GameStateStore;
  let evaluator: ConditionEvaluator;
  let executor: EffectExecutor;
  let dispatcher: EventDispatcher;
  let dialogueSystem: DialogueSystem;

  beforeEach(() => {
    store = new GameStateStore(createInitialState("CH-01", "SC-01"));
    evaluator = new ConditionEvaluator();
    executor = new EffectExecutor(store);
    dispatcher = new EventDispatcher(store, evaluator, executor);
    dialogueSystem = new DialogueSystem(
      store,
      evaluator,
      executor,
      CHAPTER1_DIALOGUES,
      dispatcher,
      CHAPTER1_CHARACTERS
    );
  });

  it("DLG-01: Khởi chạy hội thoại hợp lệ, đọc node hiện tại và ghi nhận trạng thái nhân vật", () => {
    const started = dialogueSystem.startDialogue("DLG-SC01-ARRIVAL");
    expect(started).toBe(true);
    expect(dialogueSystem.getActiveDialogueId()).toBe("DLG-SC01-ARRIVAL");

    const currentNode = dialogueSystem.getCurrentNode();
    expect(currentNode?.id).toBe("sc01-entry");
    expect(currentNode?.speakerId).toBe("CHAR-SYS");

    const state = store.snapshot();
    expect(state.characterStates["CHAR-SYS"]).toEqual({
      met: true,
      expression: "neutral"
    });
    expect(state.completedDialogueIds).toEqual([]);
  });

  it("DLG-02: Từ chối an toàn dialogueId hoặc choiceId không hợp lệ mà không làm hỏng state", () => {
    expect(dialogueSystem.startDialogue("DLG-INVALID-999")).toBe(false);
    expect(dialogueSystem.getCurrentNode()).toBeNull();
    expect(dialogueSystem.getAvailableChoices()).toEqual([]);
    expect(dialogueSystem.advance()).toBe(false);

    expect(dialogueSystem.startDialogue("DLG-SC01-ARRIVAL")).toBe(true);
    expect(dialogueSystem.selectChoice("choice-does-not-exist")).toBe(false);
    expect(dialogueSystem.getCurrentNode()?.id).toBe("sc01-entry");
    expect(store.snapshot().completedDialogueIds).toEqual([]);
  });

  it("DLG-03: Lọc lựa chọn theo điều kiện hiện có (hasItem, flagEquals, hasClue) và onceId", () => {
    dialogueSystem.startDialogue("DLG-SC01-ARRIVAL");
    let choiceIds = dialogueSystem.getAvailableChoices().map(c => c.id);
    expect(choiceIds).toContain("sc01-inspect-gate");
    expect(choiceIds).toContain("sc01-proceed");
    expect(choiceIds).not.toContain("sc01-check-flashlight");
    expect(choiceIds).not.toContain("sc01-check-fog-breach");

    store.addItem("I-01");
    store.setFlag("fog_breached", true);
    choiceIds = dialogueSystem.getAvailableChoices().map(c => c.id);
    expect(choiceIds).toContain("sc01-check-flashlight");
    expect(choiceIds).toContain("sc01-check-fog-breach");

    // Kiểm tra nhánh phụ thuộc vào flag & clue tại SC-02 và SC-03
    dialogueSystem.startDialogue("DLG-SC02-PHONE");
    let phoneChoiceIds = dialogueSystem.getAvailableChoices().map(c => c.id);
    expect(phoneChoiceIds).toContain("sc02-phone-before-dossier");
    expect(phoneChoiceIds).not.toContain("sc02-phone-after-dossier");

    store.setFlag("captain_missing_confirmed", true);
    phoneChoiceIds = dialogueSystem.getAvailableChoices().map(c => c.id);
    expect(phoneChoiceIds).not.toContain("sc02-phone-before-dossier");
    expect(phoneChoiceIds).toContain("sc02-phone-after-dossier");

    dialogueSystem.startDialogue("DLG-SC03-TRACE");
    expect(dialogueSystem.getAvailableChoices().map(c => c.id)).not.toContain("sc03-review-dat-card");
    store.discoverClue("C-09");
    expect(dialogueSystem.getAvailableChoices().map(c => c.id)).toContain("sc03-review-dat-card");
  });

  it("DLG-04: Thực thi GameEffect (SHOW_LOG) thông qua EffectExecutor và tôn trọng onceId", () => {
    const initialLogsCount = store.snapshot().logs.length;

    dialogueSystem.startDialogue("DLG-SC02-RADIO");
    expect(dialogueSystem.selectChoice("sc02-radio-listen-live")).toBe(true);
    expect(dialogueSystem.getCurrentNode()?.id).toBe("sc02-radio-live");

    expect(dialogueSystem.selectChoice("sc02-radio-keep-silent")).toBe(true);
    expect(dialogueSystem.getCurrentNode()?.id).toBe("sc02-radio-silent-note");

    const afterChoiceState = store.snapshot();
    expect(afterChoiceState.logs.length).toBe(initialLogsCount + 1);
    expect(afterChoiceState.logs[afterChoiceState.logs.length - 1]).toContain("[HỘI THOẠI SC-02]");
    expect(afterChoiceState.triggeredOnceIds).toContain("dlg_sc02_radio_silent_once");
    expect(afterChoiceState.triggeredOnceIds).toContain("dlg_sc02_radio_silent_fx");
    // Không tự động kích hoạt logic vi phạm R-02 hay lộ danh tính
    expect(afterChoiceState.flags.identity_exposed).toBe(false);
    // Chọn xong lựa chọn trung gian chưa đánh dấu hoàn thành cả hội thoại
    expect(afterChoiceState.completedDialogueIds).not.toContain("DLG-SC02-RADIO");

    // Nếu khởi chạy lại node sc02-radio-live, lựa chọn onceId không còn xuất hiện
    dialogueSystem.startDialogue("DLG-SC02-RADIO");
    dialogueSystem.selectChoice("sc02-radio-listen-live");
    expect(dialogueSystem.getAvailableChoices().map(c => c.id)).not.toContain("sc02-radio-keep-silent");
  });

  it("DLG-05: Không đánh dấu hoàn thành khi bị ngắt quãng, không vượt quá node cuối và không trùng lặp", () => {
    // Bắt đầu hội thoại rồi ngắt quãng bằng hội thoại khác ở giữa chừng
    dialogueSystem.startDialogue("DLG-SC01-ARRIVAL");
    expect(dialogueSystem.selectChoice("sc01-inspect-gate")).toBe(true);
    expect(dialogueSystem.getCurrentNode()?.id).toBe("sc01-gate-note");
    expect(store.snapshot().completedDialogueIds).toEqual([]);

    dialogueSystem.startDialogue("DLG-SC02-RADIO");
    expect(store.snapshot().completedDialogueIds).not.toContain("DLG-SC01-ARRIVAL");

    // Chơi lại DLG-SC01-ARRIVAL tới node kết thúc
    dialogueSystem.startDialogue("DLG-SC01-ARRIVAL");
    expect(dialogueSystem.selectChoice("sc01-proceed")).toBe(true);
    expect(dialogueSystem.getCurrentNode()?.id).toBe("sc01-end");
    expect(dialogueSystem.getCurrentNode()?.isEnd).toBe(true);
    expect(store.snapshot().completedDialogueIds).toEqual(["DLG-SC01-ARRIVAL"]);

    // Chặn tiến tiếp vượt quá node cuối
    expect(dialogueSystem.advance()).toBe(false);
    expect(dialogueSystem.getCurrentNode()?.id).toBe("sc01-end");

    // Chơi lại một lần nữa không tạo bản ghi trùng lặp
    dialogueSystem.startDialogue("DLG-SC01-ARRIVAL");
    dialogueSystem.selectChoice("sc01-proceed");
    expect(store.snapshot().completedDialogueIds).toEqual(["DLG-SC01-ARRIVAL"]);
  });

  it("DLG-06: Lưu/khôi phục trạng thái hội thoại và tương thích ngược với SaveData cũ thiếu field mới", () => {
    dialogueSystem.startDialogue("DLG-SC01-ARRIVAL");
    dialogueSystem.selectChoice("sc01-inspect-gate");
    dialogueSystem.advance();
    expect(dialogueSystem.getCurrentNode()?.id).toBe("sc01-end");

    const saved = store.exportSave("slot-dlg-test");
    const restoredStore = new GameStateStore(createInitialState());
    expect(restoredStore.importSave(saved)).toBe(true);

    const restoredState = restoredStore.snapshot();
    expect(restoredState.completedDialogueIds).toEqual(["DLG-SC01-ARRIVAL"]);
    expect(restoredState.characterStates["CHAR-SYS"]?.met).toBe(true);
    expect(restoredState.characterStates["CHAR-PLAYER"]?.met).toBe(true);
    expect(restoredState.triggeredOnceIds).toContain("dlg_sc01_inspect_gate_once");

    // Giả lập SaveData cũ cùng engineSchemaVersion nhưng chưa có completedDialogueIds và characterStates
    const legacyStateWithoutDialogueFields = { ...saved.state } as Record<string, unknown>;
    delete legacyStateWithoutDialogueFields.completedDialogueIds;
    delete legacyStateWithoutDialogueFields.characterStates;

    const legacySave = {
      ...saved,
      state: legacyStateWithoutDialogueFields
    } as unknown as SaveData;

    const legacyTargetStore = new GameStateStore(createInitialState());
    expect(legacyTargetStore.importSave(legacySave)).toBe(true);
    expect(legacyTargetStore.snapshot().completedDialogueIds).toEqual([]);
    expect(legacyTargetStore.snapshot().characterStates).toEqual({});
    expect(legacyTargetStore.snapshot().currentSceneId).toBe("SC-01");
  });
});
