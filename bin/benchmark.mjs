#!/usr/bin/env node
/**
 * strategy-benchmark
 *
 * Prints the claim survival rate for each arm and the spread between them.
 *
 * Exit codes
 *   0  the run completed and printed a result
 *   1  usage error
 *   2  input could not be read or scored
 */

import path from "node:path";

import { runArm, runRecorded } from "../lib/run.mjs";
import { loadArm, ARM_DIRS } from "../lib/arms.mjs";
import { compareArms, renderTable } from "../lib/score.mjs";
import { recordedProvider } from "../lib/providers/recorded.mjs";
import { anthropicProvider, DEFAULT_MODEL } from "../lib/providers/anthropic.mjs";
import { buildEnvelope, provenanceFor } from "../lib/envelope.mjs";

const EXIT_OK = 0;
const EXIT_USAGE = 1;
const EXIT_INPUT = 2;

const USAGE = `strategy-benchmark

Measures how many of a strategy document's claims survive adversarial scrutiny.

  node bin/benchmark.mjs --recorded            both fixture arms, keyless
  node bin/benchmark.mjs --recorded --json     the same run as a JSON envelope
  node bin/benchmark.mjs --recorded --arm DIR  one arm from its own fixtures
  node bin/benchmark.mjs --live --arm DIR      one arm against a live examiner
  node bin/benchmark.mjs --help

Recorded mode needs no API key and no network. Live mode reads ANTHROPIC_API_KEY
from the environment and its results vary between runs.
`;

function parseArgs(argv) {
  const options = { recorded: false, live: false, json: false, arms: [] };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--recorded") options.recorded = true;
    else if (arg === "--live") options.live = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--arm") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error("--arm needs a directory path.");
      }
      options.arms.push(path.resolve(process.cwd(), value));
      i += 1;
    } else {
      throw new Error(`Unknown flag ${arg}. Run --help for usage.`);
    }
  }

  return options;
}

function printHuman({ mode, comparison, model, at }) {
  process.stdout.write(`Claim survival under adversarial scrutiny (${mode})\n\n`);
  process.stdout.write(`${renderTable(comparison)}\n\n`);

  for (const arm of comparison.arms) {
    process.stdout.write(`${arm.label} examines ${arm.subject}.\n`);
  }

  process.stdout.write(`\n${provenanceFor({ mode, model, at })}\n`);
}

async function main(argv) {
  let options;

  try {
    options = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    return EXIT_USAGE;
  }

  if (options.help) {
    process.stdout.write(USAGE);
    return EXIT_OK;
  }

  if (options.recorded === options.live) {
    process.stderr.write(
      "Choose exactly one mode, --recorded or --live. Run --help for usage.\n"
    );
    return EXIT_USAGE;
  }

  if (options.live && options.arms.length === 0) {
    process.stderr.write(
      "Live mode needs --arm pointing at the arm directory to examine.\n"
    );
    return EXIT_USAGE;
  }

  try {
    if (options.recorded) {
      const dirs = options.arms.length > 0 ? options.arms : ARM_DIRS;
      const comparison =
        dirs.length === 1
          ? await singleArmRecorded(dirs[0])
          : await runRecorded(dirs);

      emit(options, { mode: "recorded", comparison });
      return EXIT_OK;
    }

    const scores = [];
    const provider = anthropicProvider({
      apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    });

    for (const dir of options.arms) {
      const arm = await loadArm(dir);
      scores.push(await runArm({ arm, provider }));
    }

    const comparison =
      scores.length === 1 ? singleArm(scores[0]) : compareArms(scores);

    emit(options, {
      mode: "live",
      comparison,
      model: DEFAULT_MODEL,
      at: new Date().toISOString(),
    });
    return EXIT_OK;
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    return EXIT_INPUT;
  }
}

/**
 * One arm carries no spread. See SPEC.md section 5, a single arm is a
 * measurement rather than a benchmark, so there is nothing to spread against.
 */
function singleArm(score) {
  return { arms: [score] };
}

async function singleArmRecorded(dir) {
  const arm = await loadArm(dir);
  const score = await runArm({
    arm,
    provider: recordedProvider(arm.records),
  });
  return singleArm(score);
}

function emit(options, run) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(buildEnvelope(run), null, 2)}\n`);
    return;
  }
  printHuman(run);
}

process.exitCode = await main(process.argv.slice(2));
