import test from "node:test";
import assert from "node:assert/strict";

import { composeExamination } from "../lib/providers/anthropic.mjs";
import { loadArm, ARM_DIRS } from "../lib/arms.mjs";

/**
 * Tokens that would tell the examiner which arm of the experiment it is
 * judging. A judge told the hypothesis is not a judge.
 */
const CONDITION_TOKENS = [
  "unconstrained",
  "gated",
  "naive",
  "discipline",
  "benchmark",
  "arm a",
  "arm b",
  "condition",
  "control",
  "treatment",
  "hypothesis",
  "refused",
];

test("the prompt handed to the examiner reveals no condition, for either arm", async () => {
  for (const dir of ARM_DIRS) {
    const arm = await loadArm(dir);
    const prompt = composeExamination(
      { id: "c1", text: "Renewals rose 12 percent.", evidence: null },
      arm.context
    ).toLowerCase();

    for (const token of CONDITION_TOKENS) {
      assert.ok(
        !prompt.includes(token),
        `${arm.name} prompt leaks the condition token "${token}"`
      );
    }
  }
});

/**
 * One template, filled with a company and an industry and nothing else. The
 * industry differs because the subjects differ; the framing must not.
 */
const NEUTRAL_CONTEXT =
  /^A go-to-market strategy document for [A-Z][A-Za-z ]+, an? [a-z ]+\.$/;

test("both arms describe themselves with the same neutral template", async () => {
  for (const dir of ARM_DIRS) {
    const arm = await loadArm(dir);

    assert.match(
      arm.context,
      NEUTRAL_CONTEXT,
      `${arm.name} context departs from the neutral template`
    );
  }
});

test("the context names the company and industry and nothing more", async () => {
  const arm = await loadArm(ARM_DIRS[0]);

  assert.match(arm.context, /Northwind Robotics/);
  assert.match(arm.context, /warehouse automation/);
  assert.ok(arm.context.length < 120, "context should be a single neutral line");
});
