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

test("fires the causal signal on an explanatory connector", () => {
  const claims = extractClaims("Renewals slipped because onboarding stalled.");

  assert.equal(claims.length, 1);
  assert.deepEqual(claims[0].signals, ["causal"]);
});

test("fires the projection signal on a forward looking assertion", () => {
  const claims = extractClaims("The motion will compound over the coming year.");

  assert.equal(claims.length, 1);
  assert.deepEqual(claims[0].signals, ["projection"]);
});

test("fires the segment signal on a named entity away from sentence start", () => {
  const claims = extractClaims("The buyer is Acme Freight.");

  assert.equal(claims.length, 1);
  assert.deepEqual(claims[0].signals, ["segment"]);
});

test("fires the segment signal on an explicit segment term", () => {
  const claims = extractClaims("Our wedge is the mid-market.");

  assert.equal(claims.length, 1);
  assert.deepEqual(claims[0].signals, ["segment"]);
});

test("does not fire the segment signal on a capitalized sentence start alone", () => {
  const claims = extractClaims("Renewals matter.");

  assert.deepEqual(claims, []);
});

test("reports every signal a sentence carries, in fixed order", () => {
  const claims = extractClaims(
    "Acme Freight will grow 30 percent because dispatch density compounds."
  );

  assert.equal(claims.length, 1);
  assert.deepEqual(claims[0].signals, [
    "numeric",
    "causal",
    "projection",
    "segment",
  ]);
});

test("skips markdown headings", () => {
  const claims = extractClaims("## Why Northwind Robotics wins\n\nOverview follows.");

  assert.deepEqual(claims, []);
});

test("skips fenced code blocks", () => {
  const claims = extractClaims(
    "Overview follows.\n\n```\nrevenue = seats * 4200\n```\n\nMore overview."
  );

  assert.deepEqual(claims, []);
});

test("treats a bullet as a sentence with the marker removed", () => {
  const claims = extractClaims("- Deployments rose 40 percent");

  assert.equal(claims.length, 1);
  assert.equal(claims[0].text, "Deployments rose 40 percent");
});

test("does not split a sentence on a decimal point", () => {
  const claims = extractClaims("Pipeline reached 1.4 million in coverage.");

  assert.equal(claims.length, 1);
  assert.equal(claims[0].text, "Pipeline reached 1.4 million in coverage.");
});

test("refuses input that is not text, naming the type received", () => {
  assert.throws(() => extractClaims(null), /received object/);
});

test("joins a sentence wrapped across lines instead of splitting it in two", () => {
  const claims = extractClaims(
    "The market is growing at 23 percent annually and\nwill exceed 51 billion within four years."
  );

  assert.equal(claims.length, 1);
  assert.equal(
    claims[0].text,
    "The market is growing at 23 percent annually and will exceed 51 billion within four years."
  );
});

test("keeps a blank line as a paragraph break", () => {
  const claims = extractClaims(
    "Renewals rose 12 percent.\n\nDeployments rose 40 percent."
  );

  assert.equal(claims.length, 2);
});

test("keeps each bullet a separate claim rather than joining the list", () => {
  const claims = extractClaims(
    "- Renewals rose 12 percent\n- Deployments rose 40 percent"
  );

  assert.deepEqual(
    claims.map((c) => c.text),
    ["Renewals rose 12 percent", "Deployments rose 40 percent"]
  );
});

test("binds each annotation in a paragraph to the sentence it closes", () => {
  const claims = extractClaims(
    "Loads reached 4,100 a month. [evidence: E1 | grade: C1] " +
      "Acceptance averages 61 percent. [evidence: E2 | grade: C3]"
  );

  assert.equal(claims.length, 2);
  assert.equal(claims[0].text, "Loads reached 4,100 a month.");
  assert.deepEqual(claims[0].evidence, { id: "E1", grade: "C1" });
  assert.equal(claims[1].text, "Acceptance averages 61 percent.");
  assert.deepEqual(claims[1].evidence, { id: "E2", grade: "C3" });
});

test("carries a null evidence entry when a claim is unannotated", () => {
  const claims = extractClaims("Deployments rose 40 percent.");

  assert.equal(claims[0].evidence, null);
});

test("binds an annotated claim to its evidence id and grade", () => {
  const claims = extractClaims(
    "Churn concentrates under 20 seats. [evidence: E3 | grade: C2]"
  );

  assert.equal(claims.length, 1);
  assert.deepEqual(claims[0].evidence, { id: "E3", grade: "C2" });
});

test("strips the annotation from the claim text", () => {
  const claims = extractClaims(
    "Churn concentrates under 20 seats. [evidence: E3 | grade: C2]"
  );

  assert.equal(claims[0].text, "Churn concentrates under 20 seats.");
});

test("accepts every grade from C1 through C5", () => {
  for (const grade of ["C1", "C2", "C3", "C4", "C5"]) {
    const claims = extractClaims(
      `Churn concentrates under 20 seats. [evidence: E1 | grade: ${grade}]`
    );
    assert.equal(claims[0].evidence.grade, grade);
  }
});

test("refuses a grade outside C1 through C5, naming the bad token", () => {
  assert.throws(
    () =>
      extractClaims(
        "Churn concentrates under 20 seats. [evidence: E3 | grade: C9]"
      ),
    /C9/
  );
});

test("refuses an annotation missing its grade rather than downgrading silently", () => {
  assert.throws(
    () => extractClaims("Churn concentrates under 20 seats. [evidence: E3]"),
    /grade/
  );
});
