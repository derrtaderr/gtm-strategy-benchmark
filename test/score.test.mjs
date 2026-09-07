import test from "node:test";
import assert from "node:assert/strict";

import { scoreArm, compareArms, renderTable } from "../lib/score.mjs";

const verdict = (id, v) => ({
  claimId: id,
  claim: `claim ${id}`,
  verdict: v,
  reason: "because",
});

test("counts survivors and collapses and reports the rate", () => {
  const score = scoreArm({
    name: "naive",
    label: "Arm A, naive",
    verdicts: [
      verdict("c1", "SURVIVES"),
      verdict("c2", "COLLAPSES"),
      verdict("c3", "COLLAPSES"),
      verdict("c4", "COLLAPSES"),
    ],
  });

  assert.equal(score.claims, 4);
  assert.equal(score.survives, 1);
  assert.equal(score.collapses, 3);
  assert.equal(score.survivalRate, 0.25);
});

test("keeps the rate unrounded in the data", () => {
  const score = scoreArm({
    name: "arm",
    label: "Arm",
    verdicts: [
      verdict("c1", "SURVIVES"),
      verdict("c2", "SURVIVES"),
      verdict("c3", "COLLAPSES"),
    ],
  });

  assert.equal(score.survivalRate, 2 / 3);
});

test("refuses to score an arm with no verdicts", () => {
  assert.throws(
    () => scoreArm({ name: "arm", label: "Arm", verdicts: [] }),
    /examined nothing/
  );
});

test("refuses a verdict list that is not an array", () => {
  assert.throws(
    () => scoreArm({ name: "arm", label: "Arm", verdicts: null }),
    /array/
  );
});

test("compares arms and reports the spread between the highest and lowest rate", () => {
  const naive = scoreArm({
    name: "naive",
    label: "Arm A",
    verdicts: [verdict("c1", "SURVIVES"), verdict("c2", "COLLAPSES")],
  });
  const gated = scoreArm({
    name: "gated",
    label: "Arm B",
    verdicts: [verdict("c1", "SURVIVES")],
  });

  const comparison = compareArms([naive, gated]);

  assert.equal(comparison.arms.length, 2);
  assert.equal(comparison.spread, 0.5);
});

test("refuses a comparison with fewer than two arms", () => {
  const only = scoreArm({
    name: "naive",
    label: "Arm A",
    verdicts: [verdict("c1", "SURVIVES")],
  });

  assert.throws(() => compareArms([only]), /two arms/);
});

test("renders a table carrying every arm label, count, and rate", () => {
  const naive = scoreArm({
    name: "naive",
    label: "Arm A, naive",
    verdicts: [verdict("c1", "SURVIVES"), verdict("c2", "COLLAPSES")],
  });
  const gated = scoreArm({
    name: "gated",
    label: "Arm B, gated",
    verdicts: [verdict("c1", "SURVIVES")],
  });

  const table = renderTable(compareArms([naive, gated]));

  assert.match(table, /Arm A, naive/);
  assert.match(table, /Arm B, gated/);
  assert.match(table, /50\.0%/);
  assert.match(table, /100\.0%/);
});
