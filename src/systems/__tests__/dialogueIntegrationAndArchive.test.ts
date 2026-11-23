import { beforeEach, describe, expect, it } from "vitest";
import type { SaveData } from "../../types/save";
import { ConditionEvaluator } from "../../core/ConditionEvaluator";
import { EffectExecutor } from "../../core/EffectExecutor";
import { EventDispatcher } from "../../core/EventDispatcher";
import { createInitialState, GameStateStore } from "../../core/GameStateStore";
import { CHAPTER1_ARCHIVE_DOCUMENTS } from "../../data/chapter1Archive";
import { CHAPTER1_CHARACTERS } from "../../data/characters";
import { CHAPTER1_DIALOGUES } from "../../data/chapter1Dialogues";
import { ArchiveSystem } from "../ArchiveSystem";
import { DialogueSystem } from "../DialogueSystem";
import {
  createTypewriterState,
  getVisibleTypewriterText,
  resolveDialogueBoxClick,
  stepTypewriter
} from "../DialogueTypewriter";

describe("FIX19 + FIX20 + V4 Archive Integration Suite", () => {
  let store: GameStateStore;
  let evaluator: ConditionEvaluator;
  let executor: EffectExecutor;
  let dispatcher: EventDispatcher;
  let dialogueSystem: DialogueSystem;
  let archiveSystem: ArchiveSystem;

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
    archiveSystem = new ArchiveSystem(store, evaluator, CHAPTER1_ARCHIVE_DOCUMENTS);
  });

  it("INT-01: Kích hoạt đúng các hội thoại theo ngữ cảnh cảnh chơi (SC-01, SC-02, SC-03) và thông tin kênh/biểu cảm", () => {
    expect(dialogueSystem.startDialogue("DLG-SC01-ARRIVAL")).toBe(true);
    expect(dialogueSystem.getActiveDialogue()?.sceneId).toBe("SC-01");
    expect(dialogueSystem.getCurrentNode()?.channel).toBe("SYSTEM");
    expect(dialogueSystem.getCharacter("CHAR-SYS")?.recordedStatus).toBe("automated_system");

    store.changeScene("SC-02");
    expect(dialogueSystem.startDialogue("DLG-SC02-RADIO")).toBe(true);
    expect(dialogueSystem.getActiveDialogue()?.channel).toBe("RADIO · 00:15");

    expect(dialogueSystem.startDialogue("DLG-SC02-PHONE")).toBe(true);
    expect(dialogueSystem.getActiveDialogue()?.channel).toBe("INTERCOM");

    store.changeScene("SC-03");
    expect(dialogueSystem.startDialogue("DLG-SC03-TRACE")).toBe(true);
    expect(dialogueSystem.getActiveDialogue()?.channel).toBe("MONO");
  });

  it("INT-02: Lọc nhánh hội thoại theo điều kiện thực tế (captain_missing_confirmed, radio_state, C-05, C-08, C-09)", () => {
    // SC-02 RADIO: radio_state = broadcasting -> có lựa chọn nghe phát thanh (risky)
    dialogueSystem.startDialogue("DLG-SC02-RADIO");
    let radioChoices = dialogueSystem.getAvailableChoices();
    expect(radioChoices.find(c => c.id === "sc02-radio-listen-live")?.isRisky).toBe(true);
    expect(radioChoices.some(c => c.id === "sc02-radio-observe-paused")).toBe(false);
    expect(radioChoices.some(c => c.id === "sc02-radio-compare-tape")).toBe(false);

    store.setFlag("radio_state", "paused");
    store.discoverClue("C-05");
    radioChoices = dialogueSystem.getAvailableChoices();
    expect(radioChoices.some(c => c.id === "sc02-radio-listen-live")).toBe(false);
    expect(radioChoices.some(c => c.id === "sc02-radio-observe-paused")).toBe(true);
    expect(radioChoices.some(c => c.id === "sc02-radio-compare-tape")).toBe(true);

    // SC-02 PHONE: phụ thuộc captain_missing_confirmed & C-08
    dialogueSystem.startDialogue("DLG-SC02-PHONE");
    expect(dialogueSystem.getAvailableChoices().some(c => c.id === "sc02-phone-before-dossier")).toBe(true);
    expect(dialogueSystem.getAvailableChoices().some(c => c.id === "sc02-phone-after-dossier")).toBe(false);

    store.setFlag("captain_missing_confirmed", true);
    store.discoverClue("C-08");
    const phoneChoices = dialogueSystem.getAvailableChoices();
    expect(phoneChoices.some(c => c.id === "sc02-phone-before-dossier")).toBe(false);
    expect(phoneChoices.some(c => c.id === "sc02-phone-after-dossier")).toBe(true);
    expect(phoneChoices.some(c => c.id === "sc02-phone-confession")).toBe(true);
  });

  it("INT-03: Cơ chế Typewriter hiện chữ dần, nhấp lần 1 hiện trọn câu, nhấp lần 2 mới chuyển tiếp hoặc đóng", () => {
    const sample = "Ánh đèn hải đăng quay đều phía trên mái trạm.";
    let tw = createTypewriterState(sample);
    expect(tw.isComplete).toBe(false);
    expect(getVisibleTypewriterText(tw)).toBe("Á");

    tw = stepTypewriter(tw, 5);
    expect(tw.revealedLength).toBe(6);
    expect(tw.isComplete).toBe(false);

    // Nhấp lần 1 khi chữ đang chạy -> hiện toàn bộ câu, chưa advance
    const firstClick = resolveDialogueBoxClick(tw, {
      hasChoices: false,
      isEndNode: false,
      hasNextNode: true
    });
    expect(firstClick.action).toBe("reveal_all");
    if (firstClick.action === "reveal_all") {
      tw = firstClick.state;
    }
    expect(tw.isComplete).toBe(true);
    expect(getVisibleTypewriterText(tw)).toBe(sample);

    // Nhấp lần 2 khi câu đã đầy đủ (node có lựa chọn) -> chờ người chơi chọn nhánh
    const clickWithChoices = resolveDialogueBoxClick(tw, {
      hasChoices: true,
      isEndNode: false,
      hasNextNode: false
    });
    expect(clickWithChoices.action).toBe("await_choice");

    // Nhấp lần 2 trên node tuyến tính -> chuyển tiếp node
    const secondClick = resolveDialogueBoxClick(tw, {
      hasChoices: false,
      isEndNode: false,
      hasNextNode: true
    });
    expect(secondClick.action).toBe("advance_dialogue");

    // Nhấp trên node kết thúc -> đóng hội thoại để quay lại cảnh
    const endClick = resolveDialogueBoxClick(tw, {
      hasChoices: false,
      isEndNode: true,
      hasNextNode: false
    });
    expect(endClick.action).toBe("close_dialogue");
  });

  it("INT-04: Kho tư liệu ẩn tài liệu chưa thu thập, không tự cấp manh mối và chỉ mở khóa khi phát hiện chứng cứ", () => {
    expect(archiveSystem.getTotalCount()).toBe(CHAPTER1_ARCHIVE_DOCUMENTS.length);
    expect(archiveSystem.getUnlockedDocuments()).toEqual([]);
    expect(archiveSystem.getUnlockedDocument("ARC-C-03")).toBeUndefined();
    // Không tự động cấp manh mối chỉ vì kho tư liệu tồn tại
    expect(store.snapshot().discoveredClueIds).toEqual([]);

    store.discoverClue("C-03");
    const unlocked = archiveSystem.getUnlockedDocuments();
    expect(unlocked).toHaveLength(1);
    expect(unlocked[0].id).toBe("ARC-C-03");
    expect(unlocked[0].relatedClueIds).toEqual(["C-03"]);
    expect(unlocked[0].relatedSceneId).toBe("SC-02");
    expect(unlocked[0].content).toContain("Lê Văn Hùng");
  });

  it("INT-05: Theo dõi trạng thái đã đọc / chưa đọc trong kho tư liệu và lưu vào GameState", () => {
    expect(archiveSystem.markAsRead("ARC-C-01")).toBe(false);
    expect(archiveSystem.getUnreadCount()).toBe(0);

    store.discoverClue("C-01");
    store.discoverClue("C-05");
    expect(archiveSystem.getUnreadCount()).toBe(2);
    expect(archiveSystem.isRead("ARC-C-01")).toBe(false);

    expect(archiveSystem.markAsRead("ARC-C-01")).toBe(true);
    expect(archiveSystem.markAsRead("ARC-C-01")).toBe(false);
    expect(archiveSystem.isRead("ARC-C-01")).toBe(true);
    expect(archiveSystem.isRead("ARC-C-05")).toBe(false);
    expect(archiveSystem.getUnreadCount()).toBe(1);
    expect(store.snapshot().readArchiveIds).toEqual(["ARC-C-01"]);
  });

  it("INT-06: Quick Save / Load khôi phục trạng thái hội thoại & tư liệu và tương thích ngược bản lưu cũ", () => {
    dialogueSystem.startDialogue("DLG-SC01-ARRIVAL");
    dialogueSystem.selectChoice("sc01-proceed");
    expect(dialogueSystem.isDialogueCompleted("DLG-SC01-ARRIVAL")).toBe(true);

    // Bắt đầu hội thoại thứ hai rồi ngắt giữa chừng -> không được đánh dấu hoàn thành
    dialogueSystem.startDialogue("DLG-SC02-RADIO");
    expect(dialogueSystem.isDialogueCompleted("DLG-SC02-RADIO")).toBe(false);

    store.discoverClue("C-01");
    archiveSystem.markAsRead("ARC-C-01");

    const saved = store.exportSave("quick-slot");
    const restoredStore = new GameStateStore(createInitialState());
    expect(restoredStore.importSave(saved)).toBe(true);

    const restoredArchive = new ArchiveSystem(restoredStore, evaluator, CHAPTER1_ARCHIVE_DOCUMENTS);
    expect(restoredStore.snapshot().completedDialogueIds).toEqual(["DLG-SC01-ARRIVAL"]);
    expect(restoredArchive.isRead("ARC-C-01")).toBe(true);
    expect(restoredArchive.getUnreadCount()).toBe(0);

    // Bản lưu cũ thiếu readArchiveIds, completedDialogueIds, characterStates
    const legacyState = { ...saved.state } as Record<string, unknown>;
    delete legacyState.readArchiveIds;
    delete legacyState.completedDialogueIds;
    delete legacyState.characterStates;

    const legacyStore = new GameStateStore(createInitialState());
    expect(legacyStore.importSave({ ...saved, state: legacyState } as unknown as SaveData)).toBe(true);
    expect(legacyStore.snapshot().readArchiveIds).toEqual([]);
    expect(legacyStore.snapshot().completedDialogueIds).toEqual([]);
    expect(legacyStore.snapshot().characterStates).toEqual({});
  });

  it("INT-07: Phát lại hội thoại đã hoàn thành không lặp lại gameplay effect hay ghi trùng log/completion", () => {
    // Không cho phép phát lại hội thoại chưa hoàn thành
    expect(dialogueSystem.replayDialogue("DLG-SC02-RADIO")).toBe(false);

    // Hoàn thành DLG-SC02-RADIO và kích hoạt log một lần
    dialogueSystem.startDialogue("DLG-SC02-RADIO");
    dialogueSystem.selectChoice("sc02-radio-listen-live");
    dialogueSystem.selectChoice("sc02-radio-keep-silent");
    dialogueSystem.advance();
    expect(dialogueSystem.isDialogueCompleted("DLG-SC02-RADIO")).toBe(true);

    const logsAfterFirstRun = [...store.snapshot().logs];
    const completedAfterFirstRun = [...store.snapshot().completedDialogueIds];
    const onceAfterFirstRun = [...store.snapshot().triggeredOnceIds];

    // Phát lại hội thoại đã hoàn thành
    dialogueSystem.cancelDialogue();
    expect(dialogueSystem.replayDialogue("DLG-SC02-RADIO")).toBe(true);
    expect(dialogueSystem.isReplaying()).toBe(true);

    expect(dialogueSystem.selectChoice("sc02-radio-listen-live")).toBe(true);
    // Nhánh one-time vẫn đọc lại được trong chế độ phát lại
    expect(dialogueSystem.getAvailableChoices().some(c => c.id === "sc02-radio-keep-silent")).toBe(true);
    expect(dialogueSystem.selectChoice("sc02-radio-keep-silent")).toBe(true);
    expect(dialogueSystem.advance()).toBe(true);

    // Không lặp lại log, flag, onceId hay completedDialogueIds
    expect(store.snapshot().logs).toEqual(logsAfterFirstRun);
    expect(store.snapshot().completedDialogueIds).toEqual(completedAfterFirstRun);
    expect(store.snapshot().triggeredOnceIds).toEqual(onceAfterFirstRun);
    expect(store.snapshot().flags.identity_exposed).toBe(false);
  });
});
