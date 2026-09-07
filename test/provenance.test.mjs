import test from "node:test";
import assert from "node:assert/strict";

import { buildEnvelope, provenanceFor } from "../lib/envelope.mjs";

const comparison = {
  arms: [
    {
      name: "naive",
      label: "Arm A",
      subject: "fictional vendor",
      claims: 2,
      survives: 1,
      collapses: 1,
      survivalRate: 0.5,
      verdicts: [
        { claimId: "c1", claim: "x", verdict: "SURVIVES", reason: "r" },
      ],
    },
    {
      name: "gated",
      label: "Arm B",
      subject: "fictional brokerage",
      claims: 2,
      survives: 2,
      collapses: 0,
      survivalRate: 1,
      verdicts: [
        { claimId: "c1", claim: "y", verdict: "SURVIVES", reason: "r" },
      ],
    },
  ],
  spread: 0.5,
};

test("recorded provenance says the verdicts were applied by hand", () => {
  const text = provenanceFor({ mode: "recorded" });

  assert.match(text, /by hand/i);
  assert.match(text, /not.*captured from a live model run/i);
});

test("live provenance names the model and the run time", () => {
  const text = provenanceFor({
    mode: "live",
    model: "claude-opus-5",
    at: "2026-09-06T12:00:00.000Z",
  });

  assert.match(text, /claude-opus-5/);
  assert.match(text, /2026-09-06T12:00:00\.000Z/);
});

test("live provenance says the context was blinded", () => {
  const text = provenanceFor({
    mode: "live",
    model: "claude-opus-5",
    at: "2026-09-06T12:00:00.000Z",
  });

  assert.match(text, /blind/i);
});

test("live provenance never carries the hand-applied claim", () => {
  const text = provenanceFor({
    mode: "live",
    model: "claude-opus-5",
    at: "2026-09-06T12:00:00.000Z",
  });

  assert.ok(!/by hand/i.test(text));
  assert.ok(!/not captured from a live model run/i.test(text));
});

test("live provenance warns that a re-run varies", () => {
  const text = provenanceFor({
    mode: "live",
    model: "claude-opus-5",
    at: "2026-09-06T12:00:00.000Z",
  });

  assert.match(text, /vary|variance/i);
});

test("a recorded envelope carries the recorded provenance", () => {
  const envelope = buildEnvelope({ mode: "recorded", comparison });

  assert.equal(envelope.mode, "recorded");
  assert.match(envelope.provenance, /by hand/i);
});

test("a live envelope carries live provenance and not the hand-applied text", () => {
  const envelope = buildEnvelope({
    mode: "live",
    comparison,
    model: "claude-opus-5",
    at: "2026-09-06T12:00:00.000Z",
  });

  assert.equal(envelope.mode, "live");
  assert.match(envelope.provenance, /claude-opus-5/);
  assert.ok(!/by hand/i.test(envelope.provenance));
});

test("a live envelope records the model it used as a field", () => {
  const envelope = buildEnvelope({
    mode: "live",
    comparison,
    model: "claude-opus-5",
    at: "2026-09-06T12:00:00.000Z",
  });

  assert.equal(envelope.model, "claude-opus-5");
  assert.equal(envelope.ranAt, "2026-09-06T12:00:00.000Z");
});

test("a recorded envelope claims no model, since none was called", () => {
  const envelope = buildEnvelope({ mode: "recorded", comparison });

  assert.equal(envelope.model, null);
});

test("refuses a live envelope with no model named", () => {
  assert.throws(
    () => buildEnvelope({ mode: "live", comparison, at: "now" }),
    /model/
  );
});
