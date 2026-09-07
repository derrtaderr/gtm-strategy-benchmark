import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.join(here, "..");
const bin = path.join(root, "bin", "benchmark.mjs");

/** Run the CLI and always resolve, so exit codes can be asserted. */
async function cli(args, env = {}) {
  try {
    const { stdout, stderr } = await run(process.execPath, [bin, ...args], {
      cwd: root,
      env: { ...process.env, ANTHROPIC_API_KEY: "", ...env },
    });
    return { code: 0, stdout, stderr };
  } catch (err) {
    return { code: err.code, stdout: err.stdout, stderr: err.stderr };
  }
}

test("recorded mode prints the comparison table and exits 0", async () => {
  const { code, stdout } = await cli(["--recorded"]);

  assert.equal(code, 0);
  assert.match(stdout, /Arm A, naive/);
  assert.match(stdout, /Arm B, gated/);
  assert.match(stdout, /Survival rate/);
});

test("recorded mode needs no api key", async () => {
  const { code } = await cli(["--recorded"], { ANTHROPIC_API_KEY: "" });

  assert.equal(code, 0);
});

test("json mode emits a parseable envelope carrying both arms", async () => {
  const { code, stdout } = await cli(["--recorded", "--json"]);

  assert.equal(code, 0);
  const envelope = JSON.parse(stdout);
  assert.equal(envelope.mode, "recorded");
  assert.equal(envelope.arms.length, 2);
  assert.equal(typeof envelope.spread, "number");
  assert.ok(envelope.arms[0].verdicts.length > 0);
});

test("the json envelope states that the verdicts were applied by hand", async () => {
  const { stdout } = await cli(["--recorded", "--json"]);
  const envelope = JSON.parse(stdout);

  assert.match(envelope.provenance, /hand/i);
});

test("help exits 0 and describes recorded mode", async () => {
  const { code, stdout } = await cli(["--help"]);

  assert.equal(code, 0);
  assert.match(stdout, /--recorded/);
});

test("an unknown flag is a usage error and exits 1", async () => {
  const { code, stderr } = await cli(["--wat"]);

  assert.equal(code, 1);
  assert.match(stderr, /--wat/);
});

test("no arguments is a usage error and exits 1", async () => {
  const { code, stderr } = await cli([]);

  assert.equal(code, 1);
  assert.match(stderr, /--recorded/);
});

test("live mode without a key exits 2 and names the missing key", async () => {
  const { code, stderr } = await cli(
    ["--live", "--arm", "fixtures/arm-a-naive"],
    { ANTHROPIC_API_KEY: "" }
  );

  assert.equal(code, 2);
  assert.match(stderr, /ANTHROPIC_API_KEY/);
});

test("an unreadable arm directory exits 2 and names the path", async () => {
  const { code, stderr } = await cli([
    "--recorded",
    "--arm",
    "fixtures/no-such-arm",
  ]);

  assert.equal(code, 2);
  assert.match(stderr, /no-such-arm/);
});

test("the printed table never leaks an api key", async () => {
  const { stdout, stderr } = await cli(["--recorded"], {
    ANTHROPIC_API_KEY: "sk-ant-should-never-appear",
  });

  assert.ok(!stdout.includes("sk-ant-should-never-appear"));
  assert.ok(!stderr.includes("sk-ant-should-never-appear"));
});
