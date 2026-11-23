import { describe, expect, it } from "vitest";
import { ACTION_TAGS } from "../../types/common";
import { ConditionEvaluator } from "../../core/ConditionEvaluator";
import { EffectExecutor } from "../../core/EffectExecutor";
import { EventDispatcher } from "../../core/EventDispatcher";
import { createInitialState, GameStateStore } from "../../core/GameStateStore";
import { CHAPTER1_CLUES, CHAPTER1_DEDUCTION_GROUPS } from "../../data/chapter1Investigation";
import { InvestigationSystem } from "../InvestigationSystem";
import { PuzzleSystem } from "../PuzzleSystem";
import { RuleSystem } from "../RuleSystem";

function setupChapter01() {
  const store = new GameStateStore(createInitialState("CH-01", "SC-01"));
  const evaluator = new ConditionEvaluator();
  const executor = new EffectExecutor(store);
  const dispatcher = new EventDispatcher(store, evaluator, executor);

  store.discoverRule("R-01");
  store.discoverRule("R-02");
  store.discoverRule("R-03");
  store.discoverRule("R-04");
  store.discoverRule("R-05");
  store.discoverRule("R-10");

  const investigation = new InvestigationSystem(store, executor, dispatcher, CHAPTER1_CLUES, CHAPTER1_DEDUCTION_GROUPS);
  const puzzles = new PuzzleSystem(
    store,
    executor,
    dispatcher,
    [
      { id: "PZ-01", sceneId: "SC-04", title: "Cân bằng tải", description: "Triệt nhiễu", solutionType: "passcode" },
      { id: "PZ-02", sceneId: "SC-05", title: "Tọa độ điểm mù", description: "Góc khuất", solutionType: "passcode" },
      { id: "PZ-03", sceneId: "SC-05", title: "Khóa tần số", description: "Liên động", solutionType: "passcode" }
    ],
    [
      { puzzleId: "PZ-01", expectedSolution: "LOW", onSolve: { effects: [{ type: "SET_FLAG", key: "power_mode", value: "low" }] } },
      { puzzleId: "PZ-02", expectedSolution: "2714", onSolve: { effects: [{ type: "ADD_ITEM", itemId: "I-05" }, { type: "DISCOVER_CLUE", clueId: "C-08" }] } },
      { puzzleId: "PZ-03", expectedSolution: "6208", onSolve: { effects: [{ type: "SHOW_LOG", message: "Mở khóa buồng đèn" }] } }
    ]
  );

  const rules = new RuleSystem(store, evaluator, executor, dispatcher, [
    {
      id: "R-03", code: "QUY TẮC 03", title: "Vùng sáng trung tâm", type: "true", scope: "SC-06",
      baseText: "Không bước vào vùng sáng trung tâm trước khi lắp bộ lọc đỏ.",
      violationTriggers: [{ actionTag: ACTION_TAGS.ENTER_LANTERN_BEAM, condition: { flagEquals: { key: "red_filter_installed", value: false } } }],
      maxViolations: 1,
      onViolate: { effects: [{ type: "TRIGGER_ENDING", endingId: "END-03" }] },
      countermeasureHint: "Lắp bộ lọc đỏ."
    },
    {
      id: "R-10", code: "QUY TẮC 10", title: "Nguồn sáng nhân tạo", type: "transforming", scope: "Toàn trạm",
      baseText: "Luôn bật đèn pin khi di chuyển trong khu vực tối.",
      transformCondition: { any: [{ flagEquals: { key: "fog_breached", value: true } }, { flagEquals: { key: "power_mode", value: "low" } }] },
      transformedText: "Tắt đèn pin trước khi di chuyển.",
      violationTriggers: [{ actionTag: ACTION_TAGS.LEAVE_SCENE, condition: { flagEquals: { key: "flashlight_on", value: true } } }],
      maxViolations: 1,
      onViolate: { effects: [{ type: "SHOW_LOG", message: "[VI PHẠM R-10] Sương di chuyển theo ánh đèn pin." }] },
      countermeasureHint: "Tắt đèn pin trước khi rời cảnh."
    }
  ]);

  return { store, executor, dispatcher, investigation, puzzles, rules };
}

describe("FIX 07 & FIX 09 · Chapter 01 Full Flow Verification", () => {
  it("CH01-FLOW-01: Đường đi hoàn hảo mở khóa đủ điều kiện kết thúc Hạng S (END-01)", () => {
    const { store, executor, dispatcher, investigation, puzzles } = setupChapter01();

    ["C-01", "C-02", "C-04", "C-05", "C-07", "C-08"].forEach(id => store.discoverClue(id));

    expect(puzzles.submitSolution("PZ-01", "LOW").status).toBe("solved");
    expect(puzzles.submitSolution("PZ-02", "2714").status).toBe("solved");
    expect(puzzles.submitSolution("PZ-03", "6208").status).toBe("solved");

    expect(investigation.linkClueToRule("R-03", "C-02").ok).toBe(true);
    expect(investigation.linkClueToRule("R-03", "C-07").ok).toBe(true);
    expect(investigation.linkClueToRule("R-04", "C-01").ok).toBe(true);
    expect(investigation.linkClueToRule("R-04", "C-08").ok).toBe(true);
    expect(investigation.linkClueToRule("R-05", "C-04").ok).toBe(true);
    expect(investigation.linkClueToRule("R-05", "C-08").ok).toBe(true);

    expect(investigation.getInvestigationStatus("R-03")).toBe("verified");
    expect(investigation.getInvestigationStatus("R-04")).toBe("debunked_fake");
    expect(investigation.getInvestigationStatus("R-05")).toBe("debunked_fake");

    store.setFlag("red_filter_installed", true);
    executor.execute({ effects: [{ type: "TRIGGER_ENDING", endingId: "END-01" }] }).forEach(e => dispatcher.dispatch(e));
    expect(store.snapshot().activeEndingId).toBe("END-01");
  });

  it("CH01-FLOW-02: Bước vào vùng sáng trung tâm khi chưa lắp bộ lọc đỏ kích hoạt END-03", () => {
    const { store, dispatcher } = setupChapter01();
    store.setFlag("red_filter_installed", false);
    store.changeScene("SC-06");

    dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.ENTER_LANTERN_BEAM,
      targetId: "central_beam",
      sceneId: "SC-06"
    });

    expect(store.snapshot().activeEndingId).toBe("END-03");
  });

  it("CH01-FLOW-03: R-10 biến đổi khi power_mode = low và ghi nhận vi phạm nếu rời cảnh khi đèn pin bật", () => {
    const { store, dispatcher, rules } = setupChapter01();
    store.setFlag("power_mode", "low");
    dispatcher.dispatch({ type: "STATE_CHANGED", domain: "flags", targetId: "power_mode", sceneId: "SC-04" });
    expect(rules.getRuleLifecycle("R-10")).toBe("transformed");

    store.setFlag("flashlight_on", true);
    dispatcher.dispatch({ type: "PLAYER_ACTION_PERFORMED", actionTag: ACTION_TAGS.LEAVE_SCENE, targetId: "leave_SC-04", sceneId: "SC-04" });
    expect(rules.getViolationCount("R-10")).toBe(1);
  });
});