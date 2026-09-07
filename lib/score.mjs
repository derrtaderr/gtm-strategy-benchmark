/**
 * Scoring.
 *
 * Deterministic arithmetic over verdicts, plus the comparison table. The rate
 * is stored unrounded and rounded only where it is printed, so a reader never
 * scores a rounded number by accident.
 *
 * See SPEC.md section 5.
 */

import { SURVIVES, COLLAPSES } from "./scrutiny.mjs";

/**
 * @param {{name: string, label: string, verdicts: Array<object>}} input
 * @returns {{name: string, label: string, claims: number, survives: number, collapses: number, survivalRate: number}}
 */
export function scoreArm({ name, label, verdicts } = {}) {
  if (!Array.isArray(verdicts)) {
    throw new Error(
      `scoreArm requires an array of verdicts, received ${typeof verdicts}.`
    );
  }

  if (verdicts.length === 0) {
    throw new Error(
      `Refusing to score arm "${name}" with no verdicts. ` +
        "A benchmark that examined nothing must not print a rate."
    );
  }

  const survives = verdicts.filter((v) => v.verdict === SURVIVES).length;
  const collapses = verdicts.filter((v) => v.verdict === COLLAPSES).length;

  if (survives + collapses !== verdicts.length) {
    throw new Error(
      `Arm "${name}" carries a verdict that is neither ${SURVIVES} nor ${COLLAPSES}, ` +
        "so the rate would be computed over an incomplete denominator."
    );
  }

  return {
    name,
    label,
    claims: verdicts.length,
    survives,
    collapses,
    survivalRate: survives / verdicts.length,
  };
}

/**
 * @param {Array<object>} scores
 * @returns {{arms: Array<object>, spread: number}}
 */
export function compareArms(scores) {
  if (!Array.isArray(scores) || scores.length < 2) {
    throw new Error(
      "A comparison needs at least two arms. " +
        "One arm on its own is a measurement, not a benchmark."
    );
  }

  const rates = scores.map((s) => s.survivalRate);

  return {
    arms: scores,
    spread: Math.max(...rates) - Math.min(...rates),
  };
}

const percent = (rate) => `${(rate * 100).toFixed(1)}%`;

function pad(value, width) {
  const text = String(value);
  return text + " ".repeat(Math.max(0, width - text.length));
}

function padLeft(value, width) {
  const text = String(value);
  return " ".repeat(Math.max(0, width - text.length)) + text;
}

/**
 * @param {{arms: Array<object>, spread: number}} comparison
 * @returns {string}
 */
export function renderTable(comparison) {
  const headers = ["Arm", "Claims", "Survives", "Collapses", "Survival rate"];
  const rows = comparison.arms.map((a) => [
    a.label,
    String(a.claims),
    String(a.survives),
    String(a.collapses),
    percent(a.survivalRate),
  ]);

  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length))
  );

  const line = (cells) =>
    "| " +
    cells
      .map((c, i) => (i === 0 ? pad(c, widths[i]) : padLeft(c, widths[i])))
      .join(" | ") +
    " |";

  const rule =
    "|" + widths.map((w) => "-".repeat(w + 2)).join("|") + "|";

  return [
    line(headers),
    rule,
    ...rows.map(line),
    "",
    `Spread between arms: ${percent(comparison.spread)}`,
  ].join("\n");
}
