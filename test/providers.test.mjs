import test from "node:test";
import assert from "node:assert/strict";

import { recordedProvider } from "../lib/providers/recorded.mjs";
import { anthropicProvider } from "../lib/providers/anthropic.mjs";

const RECORDS = [
  {
    claim: "Deployments rose 40 percent.",
    verdict: "COLLAPSES",
    reason: "the number has no stated source",
  },
  {
    claim: "Churn concentrates under 20 seats.",
    verdict: "SURVIVES",
    reason: "the seat threshold is drawn from the cited export",
  },
];

test("recorded provider replays the stored verdict for a claim", async () => {
  const provider = recordedProvider(RECORDS);

  const verdict = await provider({ id: "c1", text: "Deployments rose 40 percent." });

  assert.equal(verdict.verdict, "COLLAPSES");
  assert.equal(verdict.reason, "the number has no stated source");
});

test("recorded provider is byte identical across repeated runs", async () => {
  const provider = recordedProvider(RECORDS);
  const first = await provider({ id: "c1", text: "Deployments rose 40 percent." });
  const second = await provider({ id: "c1", text: "Deployments rose 40 percent." });

  assert.deepEqual(first, second);
});

test("recorded provider refuses a claim it has no record for, naming the claim", async () => {
  const provider = recordedProvider(RECORDS);

  await assert.rejects(
    () => provider({ id: "c9", text: "Pipeline tripled." }),
    /Pipeline tripled\./
  );
});

test("recorded provider refuses a record set that is not an array", () => {
  assert.throws(() => recordedProvider({ claim: "x" }), /array/);
});

test("recorded provider refuses a record missing its verdict, naming the claim", () => {
  assert.throws(
    () => recordedProvider([{ claim: "Deployments rose 40 percent." }]),
    /Deployments rose 40 percent\./
  );
});

test("live provider refuses construction with no api key, before any network call", () => {
  assert.throws(
    () => anthropicProvider({ apiKey: "" }),
    /ANTHROPIC_API_KEY/
  );
});

test("live provider sends the key as a header and never returns it", async () => {
  const calls = [];
  const provider = anthropicProvider({
    apiKey: "sk-ant-test-secret",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          content: [
            {
              type: "text",
              text: '{"verdict":"COLLAPSES","reason":"no source given"}',
            },
          ],
        }),
      };
    },
  });

  const verdict = await provider(
    { id: "c1", text: "Deployments rose 40 percent.", evidence: null },
    "Northwind Robotics strategy"
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.headers["x-api-key"], "sk-ant-test-secret");
  assert.deepEqual(verdict, {
    verdict: "COLLAPSES",
    reason: "no source given",
  });
  assert.ok(!JSON.stringify(verdict).includes("sk-ant-test-secret"));
});

test("live provider refuses a non-ok response without leaking the key", async () => {
  const provider = anthropicProvider({
    apiKey: "sk-ant-test-secret",
    fetchImpl: async () => ({
      ok: false,
      status: 429,
      text: async () => "rate limited",
    }),
  });

  await assert.rejects(
    () => provider({ id: "c1", text: "First." }, ""),
    (err) => {
      assert.match(err.message, /429/);
      assert.ok(!err.message.includes("sk-ant-test-secret"));
      return true;
    }
  );
});

test("live provider refuses a response body it cannot parse as a verdict", async () => {
  const provider = anthropicProvider({
    apiKey: "sk-ant-test-secret",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: "text", text: "I think maybe." }] }),
    }),
  });

  await assert.rejects(() => provider({ id: "c1", text: "First." }, ""), /parse/i);
});
