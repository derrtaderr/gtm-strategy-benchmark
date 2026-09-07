import test from "node:test";
import assert from "node:assert/strict";

import { examine } from "../lib/scrutiny.mjs";

const claim = (id, text, evidence = null) => ({
  id,
  text,
  signals: ["numeric"],
  evidence,
});

const alwaysSurvives = async (c) => ({
  verdict: "SURVIVES",
  reason: `${c.id} carries its basis`,
});

test("returns one verdict per claim, in claim order", async () => {
  const verdicts = await examine({
    claims: [claim("c1", "First."), claim("c2", "Second.")],
    context: "test",
    provider: alwaysSurvives,
  });

  assert.equal(verdicts.length, 2);
  assert.deepEqual(
    verdicts.map((v) => v.claimId),
    ["c1", "c2"]
  );
});

test("carries the claim text and the examiner reason onto the verdict", async () => {
  const [verdict] = await examine({
    claims: [claim("c1", "Deployments rose 40 percent.")],
    context: "test",
    provider: alwaysSurvives,
  });

  assert.equal(verdict.claim, "Deployments rose 40 percent.");
  assert.equal(verdict.verdict, "SURVIVES");
  assert.equal(verdict.reason, "c1 carries its basis");
});

test("passes the context through to the examiner", async () => {
  const seen = [];
  await examine({
    claims: [claim("c1", "First.")],
    context: "Northwind Robotics strategy",
    provider: async (c, ctx) => {
      seen.push(ctx);
      return { verdict: "COLLAPSES", reason: "no basis offered" };
    },
  });

  assert.deepEqual(seen, ["Northwind Robotics strategy"]);
});

test("refuses an empty claim set rather than reporting a rate over nothing", async () => {
  await assert.rejects(
    () => examine({ claims: [], context: "test", provider: alwaysSurvives }),
    /examined nothing/
  );
});

test("refuses when the examiner throws, naming the claim and the cause", async () => {
  await assert.rejects(
    () =>
      examine({
        claims: [claim("c1", "First."), claim("c2", "Second.")],
        context: "test",
        provider: async (c) => {
          if (c.id === "c2") throw new Error("upstream refused the request");
          return { verdict: "SURVIVES", reason: "fine" };
        },
      }),
    /c2[\s\S]*upstream refused the request/
  );
});

test("refuses a verdict outside the two allowed values, naming the bad value", async () => {
  await assert.rejects(
    () =>
      examine({
        claims: [claim("c1", "First.")],
        context: "test",
        provider: async () => ({ verdict: "MAYBE", reason: "unsure" }),
      }),
    /MAYBE/
  );
});

test("refuses a verdict carrying no reason", async () => {
  await assert.rejects(
    () =>
      examine({
        claims: [claim("c1", "First.")],
        context: "test",
        provider: async () => ({ verdict: "SURVIVES" }),
      }),
    /reason/
  );
});

test("refuses when no provider is supplied instead of assuming survival", async () => {
  await assert.rejects(
    () => examine({ claims: [claim("c1", "First.")], context: "test" }),
    /provider/
  );
});

test("records a COLLAPSES verdict without altering it", async () => {
  const [verdict] = await examine({
    claims: [claim("c1", "Deployments rose 40 percent.")],
    context: "test",
    provider: async () => ({
      verdict: "COLLAPSES",
      reason: "the number has no stated source",
    }),
  });

  assert.equal(verdict.verdict, "COLLAPSES");
  assert.equal(verdict.reason, "the number has no stated source");
});
