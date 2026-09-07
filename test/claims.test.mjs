import test from "node:test";
import assert from "node:assert/strict";

import { extractClaims } from "../lib/claims.mjs";

test("extracts a sentence carrying a number as a claim", () => {
  const claims = extractClaims("Northwind Robotics grew deployments 40 percent.");

  assert.equal(claims.length, 1);
  assert.equal(claims[0].text, "Northwind Robotics grew deployments 40 percent.");
  assert.ok(claims[0].signals.includes("numeric"));
});

test("skips a sentence that asserts nothing", () => {
  const claims = extractClaims("This document outlines the approach.");

  assert.deepEqual(claims, []);
});

test("assigns stable sequential ids in document order", () => {
  const claims = extractClaims(
    "Deployments rose 40 percent. This section is an overview. Renewals rose 12 percent."
  );

  assert.deepEqual(
    claims.map((c) => c.id),
    ["c1", "c2"]
  );
  assert.equal(claims[0].text, "Deployments rose 40 percent.");
  assert.equal(claims[1].text, "Renewals rose 12 percent.");
});
