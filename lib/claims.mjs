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

/**
 * An inline evidence annotation, for example `[evidence: E3 | grade: C2]`.
 * Global, because a paragraph may bind several claims. See SPEC.md section 3.
 */
const ANNOTATION_PATTERN = /\[\s*evidence:([^\]]*)\]/gi;

/** The inside of an annotation, split into id and grade. */
const ANNOTATION_BODY = /^\s*([^|]+?)\s*(?:\|\s*grade:\s*(\S+?)\s*)?$/i;

/** Admiralty-style confidence grades, C1 strongest through C5 weakest. */
const GRADES = new Set(["C1", "C2", "C3", "C4", "C5"]);

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

/**
 * Group the document into paragraphs.
 *
 * Markdown wraps sentences across lines, so a line is not a unit of meaning.
 * Consecutive prose lines join into one paragraph. A blank line, a heading, a
 * fence, and the start of a bullet each break the paragraph, which keeps list
 * items separate from one another and from the prose around them.
 */
function paragraphsIn(text) {
  const paragraphs = [];
  let current = [];
  let inFence = false;

  const flush = () => {
    if (current.length > 0) {
      paragraphs.push(current.join(" "));
      current = [];
    }
  };

  for (const raw of text.split("\n")) {
    if (FENCE_LINE.test(raw)) {
      inFence = !inFence;
      flush();
      continue;
    }
    if (inFence) continue;

    if (raw.trim() === "" || HEADING_LINE.test(raw)) {
      flush();
      continue;
    }

    if (BULLET_MARKER.test(raw)) {
      flush();
      current.push(raw.replace(BULLET_MARKER, "").trim());
      continue;
    }

    current.push(raw.trim());
  }

  flush();
  return paragraphs;
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
 * Read one annotation's inner text into an evidence entry.
 *
 * A malformed annotation refuses rather than degrading. Dropping a grade would
 * quietly turn a gated document into a naive one, which is exactly the
 * difference this benchmark is trying to measure.
 */
function readAnnotation(inner, whole) {
  const parts = inner.match(ANNOTATION_BODY);
  const id = parts === null ? "" : parts[1];
  const grade = parts === null ? undefined : parts[2];

  if (grade === undefined) {
    throw new Error(
      `Malformed evidence annotation "${whole}". ` +
        `An evidence entry must carry a grade, written as [evidence: ${id || "E1"} | grade: C1].`
    );
  }

  if (!GRADES.has(grade.toUpperCase())) {
    throw new Error(
      `Unknown evidence grade "${grade}" in annotation "${whole}". ` +
        `Grades are C1 through C5.`
    );
  }

  return { id, grade: grade.toUpperCase() };
}

/**
 * Cut a paragraph into chunks at each annotation.
 *
 * Each chunk is the prose running up to an annotation, and that annotation
 * binds to the last claim the chunk produces, which is the sentence it was
 * written after. The final chunk carries no annotation.
 *
 * @returns {Array<{text: string, evidence: {id: string, grade: string} | null}>}
 */
function chunksIn(paragraph) {
  const chunks = [];
  let cursor = 0;

  ANNOTATION_PATTERN.lastIndex = 0;
  let match;

  while ((match = ANNOTATION_PATTERN.exec(paragraph)) !== null) {
    chunks.push({
      text: paragraph.slice(cursor, match.index),
      evidence: readAnnotation(match[1], match[0]),
    });
    cursor = match.index + match[0].length;
  }

  chunks.push({ text: paragraph.slice(cursor), evidence: null });
  return chunks;
}

/**
 * @param {string} text a strategy document
 * @returns {Array<{id: string, text: string, signals: string[], evidence: {id: string, grade: string} | null}>}
 */
export function extractClaims(text) {
  if (typeof text !== "string") {
    throw new TypeError(
      `extractClaims requires document text, received ${typeof text}`
    );
  }

  const claims = [];

  for (const paragraph of paragraphsIn(text)) {
    for (const chunk of chunksIn(paragraph)) {
      const sentences = sentencesIn(chunk.text);
      let lastSentenceBecameAClaim = false;

      for (const sentence of sentences) {
        const signals = signalsFor(sentence);

        if (signals.length === 0) {
          lastSentenceBecameAClaim = false;
          continue;
        }

        claims.push({
          id: `c${claims.length + 1}`,
          text: sentence,
          signals,
          evidence: null,
        });
        lastSentenceBecameAClaim = true;
      }

      if (chunk.evidence === null) continue;

      // An annotation binds to the sentence immediately before it and to no
      // other. Binding it to an earlier claim would attribute evidence to a
      // sentence it was never written for, and dropping it silently would let
      // a graded document be scored as an ungraded one. Both are refused.
      if (!lastSentenceBecameAClaim) {
        const orphan = sentences[sentences.length - 1];

        throw new Error(
          `Evidence entry ${chunk.evidence.id} at grade ${chunk.evidence.grade} ` +
            `has nothing to bind to. The sentence before it, ` +
            `"${orphan === undefined ? "" : orphan.trim()}", carries no assertable claim. ` +
            `Attach the evidence to a claim or remove the annotation.`
        );
      }

      claims[claims.length - 1].evidence = chunk.evidence;
    }
  }

  return claims;
}
