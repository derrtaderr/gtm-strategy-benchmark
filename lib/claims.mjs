/**
 * Deterministic claim extraction.
 *
 * A strategy document is prose. Only some of that prose is an assertion the
 * author is standing behind. This module draws that line with published rules
 * rather than a model, so the same text always yields the same claims and a
 * reader can disagree with a specific rule.
 *
 * See SPEC.md section 3.
 */

const SIGNAL_NUMERIC = "numeric";

/** A digit not immediately preceded by a letter. Keeps Q1 and C2 out. */
const NUMERIC_PATTERN = /(?<![A-Za-z])\d/;

const HEADING_LINE = /^\s{0,3}#{1,6}\s/;
const BULLET_MARKER = /^\s*[-*+]\s+/;
const FENCE_LINE = /^\s*```/;

/** A run of sentence characters closed by terminal punctuation, or a tail. */
const SENTENCE_PATTERN = /[^.!?]+(?:[.!?]+(?=\s|$)|$)/g;

function signalsFor(sentence) {
  const signals = [];
  if (NUMERIC_PATTERN.test(sentence)) signals.push(SIGNAL_NUMERIC);
  return signals;
}

function readableLines(text) {
  const lines = [];
  let inFence = false;

  for (const raw of text.split("\n")) {
    if (FENCE_LINE.test(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (raw.trim() === "") continue;
    if (HEADING_LINE.test(raw)) continue;

    lines.push(raw.replace(BULLET_MARKER, "").trim());
  }

  return lines;
}

function sentencesIn(line) {
  const found = line.match(SENTENCE_PATTERN) || [];
  return found.map((s) => s.trim()).filter((s) => s !== "");
}

/**
 * @param {string} text a strategy document
 * @returns {Array<{id: string, text: string, signals: string[]}>}
 */
export function extractClaims(text) {
  if (typeof text !== "string") {
    throw new TypeError(
      `extractClaims requires document text, received ${typeof text}`
    );
  }

  const claims = [];

  for (const line of readableLines(text)) {
    for (const sentence of sentencesIn(line)) {
      const signals = signalsFor(sentence);
      if (signals.length === 0) continue;

      claims.push({
        id: `c${claims.length + 1}`,
        text: sentence,
        signals,
      });
    }
  }

  return claims;
}
