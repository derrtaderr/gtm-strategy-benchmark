/**
 * The output envelope and its provenance line.
 *
 * Provenance is mode-conditional. A recorded run replays verdicts that were
 * applied by hand, and a live run just captured verdicts from a model. Printing
 * the hand-applied sentence after a live run would be a false statement about
 * how the number was produced, and the README tells readers to paste a live
 * envelope straight into a fixture, so the lie would travel.
 */

const RECORDED_PROVENANCE =
  "The verdicts committed in this repository were applied by hand from the " +
  "examiner rubric in SPEC.md section 4. They were not captured from a live " +
  "model run. Run --live with your own key to judge these claims independently.";

/**
 * @param {{mode: string, model?: string, at?: string}} input
 * @returns {string}
 */
export function provenanceFor({ mode, model, at }) {
  if (mode === "recorded") return RECORDED_PROVENANCE;

  if (mode === "live") {
    if (typeof model !== "string" || model.trim() === "") {
      throw new Error(
        "A live run must name the model that produced its verdicts. " +
          "An unattributed live verdict cannot be reproduced or challenged."
      );
    }

    return (
      `These verdicts were judged live by ${model} at ${at}, against a blinded ` +
      `context that names only the company and its industry. A model judge is ` +
      `not deterministic, so a re-run will vary. Commit these verdicts to an ` +
      `arm's verdicts.json to freeze this run as a reproducible fixture.`
    );
  }

  throw new Error(
    `Unknown run mode "${mode}". Provenance must describe how the verdicts ` +
      `were actually produced, so an unrecognised mode is refused.`
  );
}

/**
 * @param {{mode: string, comparison: object, model?: string, at?: string}} input
 */
export function buildEnvelope({ mode, comparison, model, at }) {
  const provenance = provenanceFor({ mode, model, at });

  const envelope = {
    mode,
    provenance,
    model: mode === "live" ? model : null,
    arms: comparison.arms.map((a) => ({
      name: a.name,
      label: a.label,
      subject: a.subject,
      claims: a.claims,
      survives: a.survives,
      collapses: a.collapses,
      survivalRate: a.survivalRate,
      verdicts: a.verdicts,
    })),
  };

  if (mode === "live") envelope.ranAt = at;

  // A single arm has no spread. See SPEC.md section 5, one arm is a
  // measurement rather than a benchmark.
  if (comparison.arms.length > 1) envelope.spread = comparison.spread;

  return envelope;
}
