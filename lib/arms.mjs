/**
 * The two benchmark arms.
 *
 * An arm is a directory holding a manifest, a strategy document, and the
 * recorded verdicts for that document. Every failure names the file that
 * caused it, because a benchmark that cannot say which fixture broke is a
 * benchmark nobody can fix.
 *
 * See SPEC.md section 6.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, "..", "fixtures");

/** The arms that ship with the repository, in comparison order. */
export const ARM_DIRS = [
  path.join(FIXTURES, "arm-a-naive"),
  path.join(FIXTURES, "arm-b-gated"),
];

const REQUIRED = ["name", "label", "subject", "context", "strategy", "verdicts"];

async function readJson(file) {
  let text;

  try {
    text = await readFile(file, "utf8");
  } catch (cause) {
    throw new Error(`Could not read ${file}. ${cause.message}`, { cause });
  }

  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new Error(
      `Could not parse ${file} as JSON. ${cause.message}`,
      { cause }
    );
  }
}

/**
 * @param {string} dir an arm directory
 * @returns {Promise<{name: string, label: string, subject: string, context: string, strategyText: string, records: Array<object>}>}
 */
export async function loadArm(dir) {
  const manifestPath = path.join(dir, "arm.json");
  const manifest = await readJson(manifestPath);

  for (const field of REQUIRED) {
    if (typeof manifest[field] !== "string" || manifest[field].trim() === "") {
      throw new Error(
        `${manifestPath} is missing the required field "${field}".`
      );
    }
  }

  const strategyPath = path.join(dir, manifest.strategy);
  let strategyText;

  try {
    strategyText = await readFile(strategyPath, "utf8");
  } catch (cause) {
    throw new Error(
      `Could not read the strategy document ${strategyPath}. ${cause.message}`,
      { cause }
    );
  }

  const verdictsPath = path.join(dir, manifest.verdicts);
  const payload = await readJson(verdictsPath);

  if (!Array.isArray(payload.verdicts)) {
    throw new Error(
      `${verdictsPath} carries no verdicts array. ` +
        `A recorded arm must ship the verdicts it replays.`
    );
  }

  return {
    name: manifest.name,
    label: manifest.label,
    subject: manifest.subject,
    context: manifest.context,
    strategyText,
    records: payload.verdicts,
  };
}
