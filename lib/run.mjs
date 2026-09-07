/**
 * The pipeline, assembled.
 *
 * Extraction, scrutiny, and scoring are separately testable. This module is
 * the wire between them and holds no rules of its own.
 */

import { extractClaims } from "./claims.mjs";
import { examine } from "./scrutiny.mjs";
import { scoreArm, compareArms } from "./score.mjs";
import { recordedProvider } from "./providers/recorded.mjs";
import { loadArm, ARM_DIRS } from "./arms.mjs";

/**
 * Run one arm end to end against an injected examiner.
 *
 * @param {{arm: object, provider: Function}} input
 */
export async function runArm({ arm, provider }) {
  const claims = extractClaims(arm.strategyText);

  const verdicts = await examine({
    claims,
    context: arm.context,
    provider,
  });

  return {
    ...scoreArm({ name: arm.name, label: arm.label, verdicts }),
    subject: arm.subject,
    verdicts,
  };
}

/**
 * Run every arm from its committed fixtures. No key, no network.
 *
 * @param {string[]} [dirs]
 */
export async function runRecorded(dirs = ARM_DIRS) {
  const scores = [];

  for (const dir of dirs) {
    const arm = await loadArm(dir);
    scores.push(await runArm({ arm, provider: recordedProvider(arm.records) }));
  }

  return compareArms(scores);
}
