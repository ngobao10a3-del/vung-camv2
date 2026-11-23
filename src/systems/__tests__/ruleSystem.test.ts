import { beforeEach, describe, expect, it } from "vitest";
import { ACTION_TAGS } from "../../types/common";
import type { GameEvent } from "../../types/events";
import type { RuleDefinition } from "../../types/rules";
import { ConditionEvaluator } from "../../core/ConditionEvaluator";
import { EffectExecutor } from "../../core/EffectExecutor";
import { EventDispatcher } from "../../core/EventDispatcher";
import { createInitialState, GameStateStore } from "../../core/GameStateStore";
import { RuleSystem } from "../RuleSystem";

const SAMPLE_RULES: RuleDefinition[] = [
  {
    id: "R-01",
    code: "QUY TẮC 01",
    title: "Cánh cổng trong sương",
    type: "true",
    scope: "SC-01",
    baseText: "Không mở cửa ra ngoài khi sương mù đang áp sát.",
    violationTriggers: [
      {
        actionTag: ACTION_TAGS.OPEN_EXTERIOR_DOOR,
        condition: { flagEquals: { key: "fog_breached", value: true } }
      }
    ],
    maxViolations: 1,
    onViolate: {
      effects: [
        { type: "TRIGGER_FX", fx: "red_flash", durationMs: 600 },
        { type: "TRIGGER_ENDING", endingId: "END-03" }
      ]
    },
    countermeasureHint: "Giữ chặt cửa ngoài cho tới khi sương tan."
  },
  {
    id: "R-04",
    code: "QUY TẮC 04",
    title: "Sổ giao ca",
    type: "fake",
    scope: "SC-02",
    baseText: "Phải ký tên đầy đủ vào sổ trực ngay khi vào phòng.",
    violationTriggers: [],
    countermeasureHint: "Quy tắc giả do thực thể chèn vào để thu thập danh tính."
  },
  {
    id: "R-07",
    code: "QUY TẮC 07",
    title: "Chế độ điện dự phòng",
    type: "conditional",
    scope: "SC-04",
    baseText: "Khi nguồn điện hạ xuống LOW, tuyệt đối không ngắt cầu dao chính.",
    activeCondition: { flagEquals: { key: "power_mode", value: "low" } },
    violationTriggers: [{ actionTag: ACTION_TAGS.CUT_MAIN_RELAY }],
    onViolate: {
      effects: [{ type: "SHOW_LOG", message: "Vi phạm R-07 trong chế độ điện thấp." }]
    },
    countermeasureHint: "Chỉ thao tác khi điện ở mức NORMAL."
  },
  {
    id: "R-10",
    code: "QUY TẮC 10",
    title: "Nguồn sáng cầm tay",
    type: "transforming",
    scope: "Toàn trạm",
    baseText: "Luôn giữ đèn pin bật khi di chuyển trong hành lang tối.",
    transformCondition: { flagEquals: { key: "captain_missing_confirmed", value: true } },
    transformedText: "TẮT ĐÈN PIN NGAY. Ánh sáng trắng sẽ dẫn đường cho thứ ngoài sương.",
    onTransform: {
      onceId: "transform_r10_fx",
      effects: [{ type: "TRIGGER_FX", fx: "glitch", durationMs: 500 }]
    },
    violationTriggers: [
      {
        condition: {
          all: [
            { ruleLifecycleIs: { ruleId: "R-10", state: "transformed" } },
            { flagEquals: { key: "flashlight_on", value: true } }
          ]
        }
      }
    ],
    onViolate: {
      effects: [{ type: "SET_ENTITY_STATE", entityId: "EN-02", state: "stalking" }]
    },
    countermeasureHint: "Tắt đèn pin ngay sau khi đọc hồ sơ Trạm Trưởng."
  }
];

describe("RuleSystem Suite (RULE-01 to RULE-05)", () => {
  let store: GameStateStore;
  let evaluator: ConditionEvaluator;
  let executor: EffectExecutor;
  let dispatcher: EventDispatcher;
  let ruleSystem: RuleSystem;

  beforeEach(() => {
    store = new GameStateStore(createInitialState("CH-01", "SC-01"));
    evaluator = new ConditionEvaluator();
    executor = new EffectExecutor(store);
    dispatcher = new EventDispatcher(store, evaluator, executor);
    ruleSystem = new RuleSystem(store, evaluator, executor, dispatcher, SAMPLE_RULES);
  });

  it("RULE-01: Vi phạm quy tắc thật (R-01) phát RULE_VIOLATED và chạy hậu quả onViolate", () => {
    const events: GameEvent[] = [];
    dispatcher.subscribe(e => events.push(e));

    dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.OPEN_EXTERIOR_DOOR,
      targetId: "hs_gate",
      sceneId: "SC-01"
    });
    expect(ruleSystem.getViolationCount("R-01")).toBe(0);

    store.setFlag("fog_breached", true);
    dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.OPEN_EXTERIOR_DOOR,
      targetId: "hs_gate",
      sceneId: "SC-01"
    });

    expect(ruleSystem.getViolationCount("R-01")).toBe(1);
    expect(events.some(e => e.type === "RULE_VIOLATED" && e.ruleId === "R-01")).toBe(true);
    expect(store.snapshot().activeEndingId).toBe("END-03");
  });

  it("RULE-02: Quy tắc giả (R-04) không bao giờ tự kích hoạt RULE_VIOLATED", () => {
    dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.SIGN_LOGBOOK,
      targetId: "hs_logbook",
      sceneId: "SC-02"
    });

    expect(ruleSystem.getViolationCount("R-04")).toBe(0);
  });

  it("RULE-03: Quy tắc có điều kiện (R-07) tự động bật/tắt theo activeCondition", () => {
    expect(ruleSystem.getRuleLifecycle("R-07")).toBe("inactive");

    dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.CUT_MAIN_RELAY,
      targetId: "hs_relay",
      sceneId: "SC-04"
    });
    expect(ruleSystem.getViolationCount("R-07")).toBe(0);

    const followUps = executor.execute({
      effects: [{ type: "SET_FLAG", key: "power_mode", value: "low" }]
    });
    followUps.forEach(e => dispatcher.dispatch(e));
    expect(ruleSystem.getRuleLifecycle("R-07")).toBe("active");

    dispatcher.dispatch({
      type: "PLAYER_ACTION_PERFORMED",
      actionTag: ACTION_TAGS.CUT_MAIN_RELAY,
      targetId: "hs_relay",
      sceneId: "SC-04"
    });
    expect(ruleSystem.getViolationCount("R-07")).toBe(1);
  });

  it("RULE-04: Quy tắc biến đổi (R-10) đổi nội dung văn bản và bắt vi phạm trạng thái đèn pin", () => {
    expect(ruleSystem.getEffectiveRuleText("R-10")).toContain("Luôn giữ đèn pin bật");

    const transformBatch = executor.execute({
      effects: [{ type: "SET_FLAG", key: "captain_missing_confirmed", value: true }]
    });
    transformBatch.forEach(e => dispatcher.dispatch(e));

    expect(ruleSystem.getRuleLifecycle("R-10")).toBe("transformed");
    expect(ruleSystem.getEffectiveRuleText("R-10")).toContain("TẮT ĐÈN PIN NGAY");

    const flashBatch = executor.execute({
      effects: [{ type: "SET_FLAG", key: "flashlight_on", value: true }]
    });
    flashBatch.forEach(e => dispatcher.dispatch(e));

    expect(ruleSystem.getViolationCount("R-10")).toBe(1);
    expect(store.snapshot().entityStates["EN-02"]).toBe("stalking");
  });

  it("RULE-05: Tắt đèn pin rồi bật lại sau khi R-10 biến đổi tính là lần vi phạm mới", () => {
    executor.execute({
      effects: [{ type: "SET_FLAG", key: "captain_missing_confirmed", value: true }]
    }).forEach(e => dispatcher.dispatch(e));

    executor.execute({
      effects: [{ type: "SET_FLAG", key: "flashlight_on", value: true }]
    }).forEach(e => dispatcher.dispatch(e));
    expect(ruleSystem.getViolationCount("R-10")).toBe(1);

    executor.execute({
      effects: [{ type: "SET_FLAG", key: "flashlight_on", value: false }]
    }).forEach(e => dispatcher.dispatch(e));

    executor.execute({
      effects: [{ type: "SET_FLAG", key: "flashlight_on", value: true }]
    }).forEach(e => dispatcher.dispatch(e));
    expect(ruleSystem.getViolationCount("R-10")).toBe(2);
  });
});