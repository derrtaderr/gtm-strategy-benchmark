/**
 * The recorded examiner.
 *
 * Replays verdicts captured from a live run. No key, no network, no variance.
 * This is the provider that makes the benchmark reproducible for a stranger,
 * so its only job is to be boring and to refuse anything it was not given.
 *
 * See SPEC.md section 7.
 */

import { SURVIVES, COLLAPSES } from "../scrutiny.mjs";

const ALLOWED = new Set([SURVIVES, COLLAPSES]);

/**
 * @param {Array<{claim: string, verdict: string, reason: string}>} records
 * @returns {(claim: {text: string}) => Promise<{verdict: string, reason: string}>}
 */
export function recordedProvider(records) {
  if (!Array.isArray(records)) {
    throw new Error(
      `Recorded verdicts must be an array, received ${typeof records}.`
    );
  }

  const byClaim = new Map();

  for (const record of records) {
    if (record === null || typeof record !== "object") {
      throw new Error(
        `Recorded verdicts must be objects, found ${typeof record}.`
      );
    }
    if (typeof record.claim !== "string" || record.claim.trim() === "") {
      throw new Error("A recorded verdict is missing its claim text.");
    }
    if (!ALLOWED.has(record.verdict)) {
      throw new Error(
        `Recorded verdict for "${record.claim}" is "${record.verdict}", ` +
          `which is not ${SURVIVES} or ${COLLAPSES}.`
      );
    }
    if (typeof record.reason !== "string" || record.reason.trim() === "") {
      throw new Error(
        `Recorded verdict for "${record.claim}" carries no reason.`
      );
    }
    if (byClaim.has(record.claim)) {
      throw new Error(
        `Two recorded verdicts share the claim "${record.claim}". ` +
          `A replay cannot choose between them.`
      );
    }

    byClaim.set(record.claim, {
      verdict: record.verdict,
      reason: record.reason,
    });
  }

  return async function replay(claim) {
    const found = byClaim.get(claim.text);

    if (found === undefined) {
      throw new Error(
        `No recorded verdict for "${claim.text}". ` +
          `Recorded mode replays a captured run and will not invent a verdict ` +
          `for a claim it has never seen. Re-record the arm or fix the fixture.`
      );
    }

    return { verdict: found.verdict, reason: found.reason };
  };
}
