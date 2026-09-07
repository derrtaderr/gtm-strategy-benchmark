/**
 * Adversarial scrutiny.
 *
 * Each claim is handed to an examiner that demands the basis for it. The
 * examiner is injected, so a recorded provider replays a run exactly and a live
 * provider talks to a model. Nothing else in this module knows the difference.
 *
 * Every failure mode refuses. There is no default verdict and no partial
 * score, because the failure this design exists to prevent is a benchmark that
 * prints a comfortable number when it examined nothing.
 *
 * See SPEC.md section 4.
 */

export const SURVIVES = "SURVIVES";
export const COLLAPSES = "COLLAPSES";

const ALLOWED = new Set([SURVIVES, COLLAPSES]);

function validate(raw, claim) {
  if (raw === null || typeof raw !== "object") {
    throw new Error(
      `Examiner returned ${raw === null ? "null" : typeof raw} for claim ${claim.id}. ` +
        `A verdict must be an object carrying verdict and reason.`
    );
  }

  if (!ALLOWED.has(raw.verdict)) {
    throw new Error(
      `Examiner returned an unknown verdict "${raw.verdict}" for claim ${claim.id}. ` +
        `Allowed values are ${SURVIVES} and ${COLLAPSES}.`
    );
  }

  if (typeof raw.reason !== "string" || raw.reason.trim() === "") {
    throw new Error(
      `Examiner returned no reason for claim ${claim.id}. ` +
        `A verdict without a reason cannot be audited, so it is refused.`
    );
  }

  return {
    claimId: claim.id,
    claim: claim.text,
    verdict: raw.verdict,
    reason: raw.reason.trim(),
  };
}

/**
 * @param {object} input
 * @param {Array<{id: string, text: string}>} input.claims
 * @param {string} input.context document-level context handed to the examiner
 * @param {(claim: object, context: string) => Promise<object>} input.provider
 * @returns {Promise<Array<{claimId: string, claim: string, verdict: string, reason: string}>>}
 */
export async function examine({ claims, context = "", provider } = {}) {
  if (typeof provider !== "function") {
    throw new Error(
      "No examiner provider was supplied, so no claim can be examined. " +
        "Pass a provider function rather than letting the run assume survival."
    );
  }

  if (!Array.isArray(claims)) {
    throw new Error(
      `examine requires an array of claims, received ${typeof claims}.`
    );
  }

  if (claims.length === 0) {
    throw new Error(
      "Refusing to score an empty claim set. " +
        "A benchmark that examined nothing must not print a rate."
    );
  }

  const verdicts = [];

  // Sequential on purpose. Order is part of the reproducible artifact, and a
  // live examiner should not be fanned out at an unbounded rate.
  for (const claim of claims) {
    let raw;
    try {
      raw = await provider(claim, context);
    } catch (cause) {
      throw new Error(
        `Examination failed on claim ${claim.id} and the run is refused. ` +
          `No verdict is assumed. Cause: ${cause.message}`,
        { cause }
      );
    }

    verdicts.push(validate(raw, claim));
  }

  return verdicts;
}
