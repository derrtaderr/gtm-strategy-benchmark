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

/** A digit not immediately preceded by a letter. Keeps Q1 and C2 out. */
const NUMERIC_PATTERN = /(?<![A-Za-z])\d/;

const CAUSAL_PATTERN =
  /\b(because|since|therefore|so that|which is why|drives|driven by|leads to|results in|causes)\b/i;

const PROJECTION_PATTERN =
  /\b(will|expects?|expected|projected|forecasts?|should reach|anticipates?|by Q[1-4]\b|by H[12]\b|by 20\d\d\b|within \d+)\b/i;

/** Segment vocabulary a document uses to name a market rather than an entity. */
const SEGMENT_TERM_PATTERN =
  /\b(mid-market|midmarket|enterprise|SMB|ICP|vertical|persona|segment)s?\b/i;

/** Signals always report in this order so output is stable across runs. */
const SIGNAL_ORDER = ["numeric", "causal", "projection", "segment"];

const HEADING_LINE = /^\s{0,3}#{1,6}\s/;
const BULLET_MARKER = /^\s*[-*+]\s+/;
const FENCE_LINE = /^\s*```/;
const TERMINALS = ".!?";

/**
 * A proper-noun run anywhere but the first token of the sentence. The first
 * token is excluded because every sentence starts with a capital letter, so
 * counting it would mark all prose as naming a segment.
 */
function namesAnEntity(sentence) {
  const tokens = sentence.split(/\s+/).filter((t) => t !== "");

  return tokens
    .slice(1)
    .map((t) => t.replace(/^[^A-Za-z0-9]+/, "").replace(/[^A-Za-z0-9]+$/, ""))
    .some((t) => /^[A-Z][A-Za-z0-9&'-]*$/.test(t));
}

function signalsFor(sentence) {
  const fired = {
    numeric: NUMERIC_PATTERN.test(sentence),
    causal: CAUSAL_PATTERN.test(sentence),
    projection: PROJECTION_PATTERN.test(sentence),
    segment:
      SEGMENT_TERM_PATTERN.test(sentence) || namesAnEntity(sentence),
  };

  return SIGNAL_ORDER.filter((name) => fired[name]);
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

/**
 * Split a line into sentences. A terminal mark ends a sentence only when what
 * follows is whitespace or the end of the line, which keeps decimal points and
 * version numbers inside the sentence they belong to.
 */
function sentencesIn(line) {
  const sentences = [];
  let start = 0;

  for (let i = 0; i < line.length; i += 1) {
    if (!TERMINALS.includes(line[i])) continue;

    let end = i;
    while (end + 1 < line.length && TERMINALS.includes(line[end + 1])) end += 1;

    const next = line[end + 1];
    if (next !== undefined && !/\s/.test(next)) {
      i = end;
      continue;
    }

    sentences.push(line.slice(start, end + 1).trim());
    start = end + 1;
    i = end;
  }

  const tail = line.slice(start).trim();
  if (tail !== "") sentences.push(tail);

  return sentences.filter((s) => s !== "");
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
