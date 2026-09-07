import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { loadArm, ARM_DIRS } from "../lib/arms.mjs";

const here = path.dirname(new URL(import.meta.url).pathname);
const fixtures = path.join(here, "..", "fixtures");

test("loads the naive arm with its text and recorded verdicts", async () => {
  const arm = await loadArm(path.join(fixtures, "arm-a-naive"));

  assert.equal(arm.name, "naive");
  assert.equal(arm.label, "Arm A, naive");
  assert.match(arm.strategyText, /Northwind Robotics/);
  assert.ok(arm.records.length > 0);
});

test("loads the gated arm with its text and recorded verdicts", async () => {
  const arm = await loadArm(path.join(fixtures, "arm-b-gated"));

  assert.equal(arm.name, "gated");
  assert.equal(arm.label, "Arm B, gated");
  assert.match(arm.strategyText, /Acme Freight/);
  assert.ok(arm.records.length > 0);
});

test("ships exactly the two arms the benchmark compares", () => {
  assert.equal(ARM_DIRS.length, 2);
});

test("every recorded verdict matches a claim the extractor finds", async () => {
  const { extractClaims } = await import("../lib/claims.mjs");

  for (const dir of ARM_DIRS) {
    const arm = await loadArm(dir);
    const claims = extractClaims(arm.strategyText).map((c) => c.text);
    const recorded = arm.records.map((r) => r.claim);

    assert.deepEqual(
      recorded,
      claims,
      `${arm.name} verdicts drifted from its strategy text`
    );
  }
});

test("names no real company, client, or person in any fixture", async () => {
  for (const dir of ARM_DIRS) {
    const arm = await loadArm(dir);
    assert.match(arm.subject, /fictional/);
  }
});

test("refuses a missing arm directory, naming the path", async () => {
  const missing = path.join(fixtures, "arm-does-not-exist");

  await assert.rejects(() => loadArm(missing), /arm-does-not-exist/);
});

test("refuses a malformed arm manifest, naming the file", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "arm-"));
  await writeFile(path.join(dir, "arm.json"), "{ not json");

  await assert.rejects(() => loadArm(dir), /arm\.json/);
});

test("refuses an arm manifest missing a required field, naming the field", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "arm-"));
  await writeFile(path.join(dir, "arm.json"), JSON.stringify({ name: "x" }));

  await assert.rejects(() => loadArm(dir), /label/);
});

test("refuses a verdicts file that is not shaped as a verdict list", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "arm-"));
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "arm.json"),
    JSON.stringify({
      name: "x",
      label: "X",
      subject: "fictional",
      context: "c",
      strategy: "strategy.md",
      verdicts: "verdicts.json",
    })
  );
  await writeFile(path.join(dir, "strategy.md"), "Renewals rose 12 percent.");
  await writeFile(path.join(dir, "verdicts.json"), JSON.stringify({ nope: 1 }));

  await assert.rejects(() => loadArm(dir), /verdicts\.json/);
});
