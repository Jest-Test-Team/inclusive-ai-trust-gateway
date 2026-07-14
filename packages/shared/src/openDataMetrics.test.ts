import { describe, expect, it } from "vitest";
import {
  measureParsedCsv,
  openDataJudgmentDelta,
  parseCsv,
  scoreOpenDataReadiness,
  safetySignalsWithOpenDataProvenance,
} from "./openDataMetrics";
import { safetySignals } from "./sampleData";

describe("parseCsv", () => {
  it("parses headers and quoted commas", () => {
    const { headers, rows } = parseCsv('名稱,地址\n"甲,乙",台北\n丙,高雄\n');
    expect(headers).toEqual(["名稱", "地址"]);
    expect(rows).toHaveLength(2);
    expect(rows[0][0]).toBe("甲,乙");
  });
});

describe("measureParsedCsv", () => {
  it("flags schema gap when equity tokens are missing", () => {
    const m = measureParsedCsv({
      datasetId: "8572",
      catalogId: "ltc-institutions",
      scenarioId: "care-navigation",
      title: "test",
      headers: ["機構名稱", "地址", "核定床數"],
      rows: [
        ["A", "台北", "10"],
        ["B", "高雄", "20"],
      ],
      accessibilityTokens: ["wheelchair", "輪椅", "language", "語言"],
    });
    expect(m.rowsSampled).toBe(2);
    expect(m.schemaGap).toBe(true);
    expect(m.equityCoverage).toBe(0);
    expect(m.qualityScore).toBeGreaterThan(0);
    expect(m.qualityScore).toBeLessThan(70);
  });

  it("scores higher when equity columns exist", () => {
    const m = measureParsedCsv({
      datasetId: "128416",
      catalogId: "accessible-facilities",
      scenarioId: "care-navigation",
      title: "mrt",
      headers: ["Station_Name", "Elevator", "Toilet_Facilities_for_Disabled", "languages"],
      rows: Array.from({ length: 20 }, (_, i) => [`S${i}`, "Y", "Y", "zh-TW"]),
      accessibilityTokens: ["language", "languages", "elevator", "disabled"],
    });
    expect(m.schemaGap).toBe(false);
    expect(m.equityCoverage).toBeGreaterThan(0.5);
    expect(m.qualityScore).toBeGreaterThan(70);
  });
});

describe("scoreOpenDataReadiness", () => {
  it("falls back to sources × 22 without measurements", () => {
    expect(scoreOpenDataReadiness(4)).toBe(88);
    expect(scoreOpenDataReadiness(3)).toBe(66);
  });

  it("blends catalog floor with CSV quality", () => {
    const weak = measureParsedCsv({
      datasetId: "1",
      catalogId: "a",
      scenarioId: "care-navigation",
      title: "a",
      headers: ["a", "b"],
      rows: [["1", "2"]],
      accessibilityTokens: ["wheelchair"],
    });
    const scored = scoreOpenDataReadiness(4, [weak]);
    expect(scored).toBeGreaterThan(0);
    expect(scored).toBeLessThan(88);
  });
});

describe("openDataJudgmentDelta", () => {
  it("penalizes equity gaps", () => {
    const weak = measureParsedCsv({
      datasetId: "1",
      catalogId: "a",
      scenarioId: "x",
      title: "a",
      headers: ["name"],
      rows: [["x"]],
      accessibilityTokens: ["wheelchair"],
    });
    expect(openDataJudgmentDelta([weak])).toBeLessThan(0);
  });
});

describe("safetySignalsWithOpenDataProvenance", () => {
  it("promotes provenance control when CSV rows were measured", () => {
    const m = measureParsedCsv({
      datasetId: "1",
      catalogId: "a",
      scenarioId: "x",
      title: "a",
      headers: ["name"],
      rows: [["x"]],
      accessibilityTokens: [],
    });
    const next = safetySignalsWithOpenDataProvenance(safetySignals, [m]);
    const prov = next.find((s) => /provenance/i.test(s.control));
    expect(prov?.status).toBe("ready");
  });
});
