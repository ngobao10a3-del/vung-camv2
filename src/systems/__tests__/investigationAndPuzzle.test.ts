import { beforeEach, describe, expect, it } from "vitest";
import type { PuzzleDefinition, PuzzleSolution } from "../../types/common";
import type { GameEvent } from "../../types/events";
import type { ClueDefinition, DeductionGroup } from "../../types/investigation";
import { ConditionEvaluator } from "../../core/ConditionEvaluator";
import { EffectExecutor } from "../../core/EffectExecutor";
import { EventDispatcher } from "../../core/EventDispatcher";
import { createInitialState, GameStateStore } from "../../core/GameStateStore";
import { InvestigationSystem } from "../InvestigationSystem";
import { PuzzleSystem } from "../PuzzleSystem";

const SAMPLE_CLUES: ClueDefinition[] = [
  { id: "C-01", title: "Bản in gốc quy chế trực", category: "document", summary: "Bản in 1998 không có điều khoản ký sổ.", detailContent: "Mục 4 bị tẩy xóa.", relatedRuleIds: ["R-04"] },
  { id: "C-02", title: "Băng ghi âm ca trực cũ", category: "audio_transcript", summary: "Bộ đàm lặp lại tên người ký sổ.", detailContent: "Kết thúc bằng tiếng gõ cửa.", relatedRuleIds: ["R-04"] },
  { id: "C-03", title: "Sơ đồ mạch đèn hải đăng", category: "blueprint", summary: "Kính lọc đỏ triệt tiêu bước sóng thu hút thực thể.", detailContent: "Lắp vào chóa đèn.", relatedRuleIds: ["R-03"] },
  { id: "C-04", title: "Nhật ký bảo trì chóa đèn", category: "document", summary: "Kính lọc đỏ cất ở tầng 2.", detailContent: "Ghi chú kỹ thuật viên.", relatedRuleIds: ["R-03"] }
];

const SAMPLE_DEDUCTIONS: DeductionGroup[] = [
  { id: "DG-R04-FAKE", ruleId: "R-04", requiredClueIds: ["C-01", "C-02"], resultingStatus: "debunked_fake", deductionNote: "R-04 là quy tắc giả.", unlockCountermeasure: true },
  { id: "DG-R04-CONFLICT", ruleId: "R-04", requiredClueIds: ["C-03"], resultingStatus: "verified", deductionNote: "Bằng chứng đối nghịch." },
  { id: "DG-R03-ORDERED", ruleId: "R-03", requiredClueIds: ["C-03", "C-04"], orderMatters: true, resultingStatus: "verified", deductionNote: "Xác minh kính lọc đỏ.", unlockCountermeasure: true }
];

const SAMPLE_PUZZLES: PuzzleDefinition[] = [
  { id: "PZ-01", sceneId: "SC-02", title: "Khóa số tủ hồ sơ", description: "Nhập mã 4 số.", solutionType: "passcode", maxAttempts: 2 },
  { id: "PZ-02", sceneId: "SC-04", title: "Khởi động máy phát", description: "Bật đúng thứ tự 3 công tắc.", solutionType: "sequence_order" },
  { id: "PZ-03", sceneId: "SC-05", title: "Lắp cụm lọc quang học", description: "Kết hợp I-04 và I-05.", solutionType: "item_combination" }
];

const SAMPLE_SOLUTIONS: PuzzleSolution[] = [
  { puzzleId: "PZ-01", expectedSolution: "2340", onSolve: { effects: [{ type: "ADD_ITEM", itemId: "I-02" }] }, onFail: { effects: [{ type: "SHOW_LOG", message: "Sai mã." }] } },
  { puzzleId: "PZ-02", expectedSolution: ["SW-B", "SW-A", "SW-C"], onSolve: { effects: [{ type: "SET_FLAG", key: "power_mode", value: "low" }] } },
  { puzzleId: "PZ-03", expectedSolution: ["I-04", "I-05"], onSolve: { effects: [{ type: "REMOVE_ITEM", itemId: "I-04" }, { type: "REMOVE_ITEM", itemId: "I-05" }, { type: "SET_FLAG", key: "red_filter_installed", value: true }] } }
];

describe("InvestigationSystem & PuzzleSystem Suite (INV-01..05, PUZ-01..06)", () => {
  let store: GameStateStore;
  let evaluator: ConditionEvaluator;
  let executor: EffectExecutor;
  let dispatcher: EventDispatcher;
  let investigation: InvestigationSystem;
  let puzzles: PuzzleSystem;

  beforeEach(() => {
    store = new GameStateStore(createInitialState("CH-01", "SC-02"));
    evaluator = new ConditionEvaluator();
    executor = new EffectExecutor(store);
    dispatcher = new EventDispatcher(store, evaluator, executor);
    investigation = new InvestigationSystem(store, executor, dispatcher, SAMPLE_CLUES, SAMPLE_DEDUCTIONS);
    puzzles = new PuzzleSystem(store, executor, dispatcher, SAMPLE_PUZZLES, SAMPLE_SOLUTIONS);
  });

  it("INV-01: Chặn gắn manh mối chưa thu thập vào Sổ tay đối chiếu", () => {
    expect(investigation.linkClueToRule("R-04", "C-01")).toEqual({ ok: false, reason: "NOT_DISCOVERED" });
  });

  it("INV-02: Gắn đủ C-01 & C-02 vạch trần R-04 là debunked_fake và mở khóa biện pháp khắc chế", () => {
    const events: GameEvent[] = [];
    dispatcher.subscribe(e => events.push(e));
    store.discoverRule("R-04");
    store.discoverClue("C-01");
    store.discoverClue("C-02");

    expect(investigation.linkClueToRule("R-04", "C-01").ok).toBe(true);
    expect(investigation.getInvestigationStatus("R-04")).toBe("unverified");

    expect(investigation.linkClueToRule("R-04", "C-02").ok).toBe(true);
    expect(investigation.getInvestigationStatus("R-04")).toBe("debunked_fake");
    expect(investigation.isCountermeasureUnlocked("R-04")).toBe(true);
    expect(events.some(e => e.type === "DEDUCTION_UPDATED" && e.ruleId === "R-04" && e.status === "debunked_fake")).toBe(true);
  });

  it("INV-03: Nhóm suy luận có orderMatters = true chỉ kích hoạt khi gắn đúng trình tự", () => {
    store.discoverRule("R-03");
    store.discoverClue("C-03");
    store.discoverClue("C-04");

    investigation.linkClueToRule("R-03", "C-04");
    investigation.linkClueToRule("R-03", "C-03");
    expect(investigation.getInvestigationStatus("R-03")).toBe("unverified");

    investigation.unlinkClueFromRule("R-03", "C-04");
    investigation.linkClueToRule("R-03", "C-04");
    expect(investigation.getInvestigationStatus("R-03")).toBe("verified");
  });

  it("INV-04: Hai kết luận đối nghịch trên cùng một quy tắc tự động đẩy sang conflicted", () => {
    store.discoverRule("R-04");
    store.discoverClue("C-01");
    store.discoverClue("C-02");
    store.discoverClue("C-03");

    investigation.linkClueToRule("R-04", "C-01");
    investigation.linkClueToRule("R-04", "C-02");
    expect(investigation.getInvestigationStatus("R-04")).toBe("debunked_fake");

    investigation.linkClueToRule("R-04", "C-03");
    expect(investigation.getInvestigationStatus("R-04")).toBe("conflicted");
  });

  it("INV-05: Dữ liệu Sổ tay đối chiếu được bảo toàn độc lập qua exportSave và importSave", () => {
    store.discoverRule("R-04");
    store.discoverClue("C-01");
    store.discoverClue("C-02");
    investigation.linkClueToRule("R-04", "C-01");
    investigation.linkClueToRule("R-04", "C-02");

    const save = store.exportSave("slot-inv");
    const restoredStore = new GameStateStore(createInitialState());
    const restoredExecutor = new EffectExecutor(restoredStore);
    const restoredDispatcher = new EventDispatcher(restoredStore, new ConditionEvaluator(), restoredExecutor);
    expect(restoredStore.importSave(save)).toBe(true);

    const restoredInv = new InvestigationSystem(restoredStore, restoredExecutor, restoredDispatcher, SAMPLE_CLUES, SAMPLE_DEDUCTIONS);
    expect(restoredInv.getInvestigationStatus("R-04")).toBe("debunked_fake");
    expect(restoredInv.isCountermeasureUnlocked("R-04")).toBe(true);
    expect(restoredInv.getLinkedClueIds("R-04")).toEqual(["C-01", "C-02"]);
  });

  it("PUZ-01: Giải đúng passcode PZ-01 (kể cả khoảng trắng bên trong) phát PUZZLE_SOLVED và trao I-02", () => {
    const events: GameEvent[] = [];
    dispatcher.subscribe(e => events.push(e));
    const res = puzzles.submitSolution("PZ-01", " 23 40 ");
    expect(res.status).toBe("solved");
    expect(puzzles.isSolved("PZ-01")).toBe(true);
    expect(store.snapshot().inventoryItemIds).toContain("I-02");
    expect(events.some(e => e.type === "PUZZLE_SOLVED" && e.puzzleId === "PZ-01")).toBe(true);
  });

  it("PUZ-02: Nhập sai quá maxAttempts khóa giải đố PZ-01 và chạy onFail", () => {
    expect(puzzles.submitSolution("PZ-01", "0000")).toEqual({ status: "failed", attemptsUsed: 1, remainingAttempts: 1 });
    expect(puzzles.submitSolution("PZ-01", "1111")).toEqual({ status: "locked", attemptsUsed: 2, remainingAttempts: 0 });
    expect(puzzles.submitSolution("PZ-01", "2340").status).toBe("locked");
    expect(puzzles.isSolved("PZ-01")).toBe(false);
  });

  it("PUZ-03: Giải đố sequence_order (PZ-02) yêu cầu đúng thứ tự thao tác", () => {
    expect(puzzles.submitSolution("PZ-02", ["SW-A", "SW-B", "SW-C"]).status).toBe("failed");
    expect(puzzles.submitSolution("PZ-02", ["sw-b", "sw-a", "sw-c"]).status).toBe("solved");
    expect(store.snapshot().flags.power_mode).toBe("low");
  });

  it("PUZ-04: Giải đố item_combination (PZ-03) kiểm tra sở hữu vật phẩm và không phụ thuộc thứ tự", () => {
    expect(puzzles.submitSolution("PZ-03", ["I-05", "I-04"]).status).toBe("missing_items");
    expect(puzzles.getAttemptCount("PZ-03")).toBe(0);

    store.addItem("I-04");
    store.addItem("I-05");
    expect(puzzles.submitSolution("PZ-03", ["I-05", "I-04"]).status).toBe("solved");
    expect(store.snapshot().flags.red_filter_installed).toBe(true);
    expect(store.snapshot().inventoryItemIds).toEqual([]);
  });

  it("PUZ-05: PuzzleDefinition không bao giờ chứa đáp án trong dữ liệu trả về cho UI", () => {
    const def = puzzles.getPuzzleDefinition("PZ-01");
    expect(def).toBeDefined();
    expect("expectedSolution" in (def as object)).toBe(false);
  });

  it("PUZ-06: Số lần thử giải đố được bảo toàn qua exportSave và importSave chống reset lượt thử", () => {
    puzzles.submitSolution("PZ-01", "0000");
    expect(puzzles.getAttemptCount("PZ-01")).toBe(1);

    const save = store.exportSave("slot-puz");
    const restoredStore = new GameStateStore(createInitialState());
    const restoredExecutor = new EffectExecutor(restoredStore);
    const restoredDispatcher = new EventDispatcher(restoredStore, new ConditionEvaluator(), restoredExecutor);
    expect(restoredStore.importSave(save)).toBe(true);

    const restoredPuzzles = new PuzzleSystem(restoredStore, restoredExecutor, restoredDispatcher, SAMPLE_PUZZLES, SAMPLE_SOLUTIONS);
    expect(restoredPuzzles.getAttemptCount("PZ-01")).toBe(1);
    expect(restoredPuzzles.submitSolution("PZ-01", "1111")).toEqual({ status: "locked", attemptsUsed: 2, remainingAttempts: 0 });
  });
});