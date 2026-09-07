# SPEC, strategy-benchmark

A reproducible benchmark that measures whether a GTM strategy's claims survive
adversarial scrutiny.

Status: design locked before code. Version 0.1.0.

---

## 1. The question this benchmark answers

Ask a general-purpose language model for a go-to-market strategy and it returns
fluent, confident prose. Ask where any single sentence came from and the prose
tends to thin out. The claim was generated, not established.

A gated-evidence walk works the other way around. Every assertion must carry a
graded evidence entry or the assertion is refused before it reaches the page.
The output is shorter. The interesting question is whether it is also sturdier.

This benchmark makes that question falsifiable by measuring one number.

**Claim survival rate.** Of the assertable claims a strategy document makes, the
fraction that hold up when an adversary demands the evidence behind them.

```
survival rate = SURVIVES / (SURVIVES + COLLAPSES)
```

Two arms are scored the same way and compared. Nothing else is measured.

---

## 2. The pipeline

Three stages, each a pure boundary the next stage consumes.

```
strategy document
        |
        v
  [ claim extraction ]      deterministic, no model
        |
        v
   claims[]  { id, text, signals[], evidence? }
        |
        v
  [ adversarial scrutiny ]  provider-injected, one call per claim
        |
        v
   verdicts[] { claimId, claim, verdict, reason }
        |
        v
  [ scoring ]               deterministic arithmetic
        |
        v
   survival rate per arm + comparison table
```

Extraction and scoring are deterministic. Scrutiny is the only stage where a
model can enter, and it enters through an injected function so that a recorded
provider can replace it exactly.

---

## 3. Stage one, claim extraction

`extractClaims(text)` is a pure function from document text to an ordered array
of claims. No model, no network, no randomness. The same text always yields the
same claims.

### What counts as an assertable claim

A sentence is an assertable claim when it carries at least one of four signals.
A sentence carrying none of them is prose, not a claim, and is skipped. This is
the definition the whole benchmark rests on, so it is written as rules a reader
can check by hand.

| Signal | Fires on |
|---|---|
| `numeric` | a digit not immediately preceded by a letter, which admits 40, 1.4, $2,400 and excludes Q1 and C2 |
| `causal` | because, since, therefore, thus, hence, so, which is why, drives, driven by, leads to, results in, causes |
| `projection` | will, expect, projected, forecast, should reach, anticipate, by Q1-Q4, by H1-H2, by a four digit year, within N |
| `segment` | a named market or entity, detected as a proper-noun run away from sentence start, or an explicit segment term such as mid-market, enterprise, SMB, ICP, vertical, persona, segment |

Excluded from consideration before signal matching:

### Two kinds of sentence are never claims, whatever signals they carry

**Cross references.** A sentence that only points at another part of the
document, such as "See section 3.4", carries a number and would otherwise be
manufactured into a claim out of what is really a table of contents entry.

**Meta-claims.** A sentence asserting something about the document's own scope
or restraint rather than about the world. "This plan makes no lane-level
targeting claim" and "no evidence was located either way" are both true by
construction, and a document earns nothing by describing itself accurately.

The reason this exclusion matters more than it looks. **A naive document
structurally cannot reach this denominator.** Only a disciplined document
narrates its own refusals, so counting meta-claims hands the gated arm free
survivors that the naive arm has no way to earn. Leaving them in flatters
exactly the arm this benchmark is trying to test, which is the failure mode a
self-authored benchmark is most prone to.

The rule is deliberately narrow. It fires on a document declining to assert
something and on a document reporting that it found no evidence. It does not
fire on a sentence that merely mentions the plan while asserting an outcome, so
"The plan produces 120 qualified opportunities in the first year" stays a claim
and collapses on its merits.

The `segment` proper-noun rule never looks at the first token of a sentence,
because every sentence starts with a capital letter and counting that would
mark all prose as naming a segment.

Signals always report in the fixed order numeric, causal, projection, segment,
so a claim's shape does not shift between runs.

Excluded from consideration before signal matching:

- markdown heading lines
- fenced code blocks
- blank lines

A list bullet has its marker removed and is then treated as an ordinary
sentence, so a bullet carrying a signal is a claim and a bullet carrying none is
skipped by the same rule as any other line.

A terminal mark ends a sentence only when whitespace or the end of the line
follows it. Decimal points and version numbers stay inside their sentence.

Rationale for excluding headings. A heading is a label for a section, not an
assertion the author is standing behind, and heading text trips the `segment`
detector constantly. Counting headings would inflate both arms with claims
nobody made.

### Evidence annotation

A strategy document may bind a claim to an evidence entry with an inline
annotation at the end of the sentence.

```
Northwind Robotics churn concentrates in accounts under 20 seats. [evidence: E3 | grade: C2]
```

The annotation is stripped from the claim text and recorded on the claim as
`{ id: "E3", grade: "C2" }`. A claim with no annotation carries `evidence: null`.

An annotation binds to the sentence immediately before it and to no other. If
that sentence carries no assertable claim, the annotation is an orphan and
extraction refuses, naming the evidence id and the sentence. Binding it to an
earlier claim would attribute evidence to a sentence it was never written for,
and dropping it would let a graded document be scored as an ungraded one.

Grades follow a five point admiralty-style scale, the convention the
gtm-architect discipline uses. This benchmark cites that discipline and
reimplements the grade vocabulary. It does not import the tool.

| Grade | Meaning |
|---|---|
| C1 | primary source, verified firsthand |
| C2 | corroborated by an independent second source |
| C3 | single source, unverified |
| C4 | inference drawn from adjacent data |
| C5 | assumption, stated as such |

An annotation carrying a grade outside C1-C5 is a malformed document. Extraction
throws and names the offending token. It does not silently drop the grade,
because a dropped grade would quietly turn a gated document into a naive one.

---

## 4. Stage two, adversarial scrutiny

`examine({ claims, context, provider })` runs one adversarial examination per
claim and returns the verdicts in claim order.

### The verdict contract

```js
{ verdict: "SURVIVES" | "COLLAPSES", reason: "<one sentence>" }
```

`SURVIVES` means the claim carries, or points at, evidence sufficient for a
skeptical reader to accept it as stated. `COLLAPSES` means the examination
demanded the basis for the claim and the claim could not supply one, or the
claim overstated what its evidence supports.

Note the asymmetry that makes this a real test. A gated claim is not
automatically a survivor. A C5 assumption stated as a firm projection collapses
the same way a naive claim does. The gate helps by forcing the grade to be
visible, not by granting immunity.

### The examiner is blinded

The examiner is never told which arm it is judging. Each arm supplies a context
line filling one neutral template, naming the company and its industry and
nothing else.

```
A go-to-market strategy document for Northwind Robotics, a warehouse automation vendor.
A go-to-market strategy document for Acme Freight, a regional freight brokerage.
```

A context saying "produced under a gated-evidence discipline" would tell the
judge the hypothesis, and a judge told the hypothesis is the channel through
which a benchmark rigs itself. A test composes the prompt for both arms and
asserts it carries no condition-revealing token, so the blinding is checked
rather than assumed.

One asymmetry remains and it is intentional. The prompt states whether the claim
is bound to a graded evidence entry, which necessarily differs between arms.
That is the property under examination rather than a label of the condition,
and the rubric cannot be applied without it.

### The provider seam

```js
provider: async (claim, context) => verdict
```

Two providers ship.

**Recorded.** Replays stored verdicts keyed by exact claim text. No key, no
network, byte-identical every run. This is the artifact a stranger reproduces.

**Live.** Calls the Anthropic messages API over plain `fetch`, no SDK, key read
from the environment and never printed, logged, or included in an error message.
Live results vary between runs. That is a property of the method, stated here
rather than hidden.

### Fail closed, everywhere

The failure this design exists to prevent is a benchmark that prints a
comfortable number when it actually examined nothing.

| Condition | Behavior |
|---|---|
| provider throws | the run refuses, naming the claim id and the underlying failure |
| provider returns a verdict outside the two allowed strings | the run refuses, naming the claim id and the bad value |
| provider returns no reason | the run refuses, naming the claim id |
| recorded provider has no record for a claim | the run refuses, naming the claim text |
| claim set is empty | the run refuses, because a benchmark that examined nothing must not print a rate |
| fixture file missing or malformed | the run refuses, naming the file path |
| live mode with no API key | the run refuses at construction, before any network call |
| an evidence annotation with nothing to bind to | extraction refuses, naming the evidence id and the orphaned sentence |
| a live envelope naming no model | the envelope refuses, since an unattributed verdict cannot be challenged |

There is no default verdict. There is no partial score. A run either examines
every claim or it produces no number at all.

---

## 5. Stage three, scoring

`scoreArm({ name, verdicts })` returns counts and a rate.

```js
{ name, label, claims, survives, collapses, survivalRate }
```

`survivalRate` is a float in [0, 1], rounded for display only, never rounded in
the data. Zero verdicts throws rather than dividing by zero or returning zero,
per the refusal table above.

`compareArms([...])` renders the comparison table and computes the spread
between arms. The spread is a descriptive difference, not a significance test.
With claim counts in the tens, no significance claim would be honest.

---

## 6. The two arms

Both arms are synthetic. Every company named is invented. There are no real
clients, accounts, numbers, or internal references anywhere in this repository.

### Arm A, naive

A strategy transcript of the kind produced by a single unconstrained prompt.
Fluent, structurally complete, confident. Numbers appear without provenance,
segments are asserted without a basis, and causal chains are stated as settled.
It is written to be a fair representative of that output, not a straw man. It
reads well. That is the point.

Subject: Northwind Robotics, a warehouse automation vendor.

### Arm B, gated

A strategy for the same class of company produced under the gated-evidence
discipline. Fewer claims survive to the page at all. Each surviving claim
carries an evidence id and a grade. Assumptions are labeled C5 and phrased as
assumptions rather than findings.

Subject: Acme Freight, a regional freight brokerage.

### Why the subjects differ

The arms are not the same document rewritten. Holding the subject constant would
let a reader assume the gated arm simply deleted sentences from the naive one.
Different subjects make it plain that these are two independent generations
scored by one rule.

The cost of that choice is stated in the limitations. Subject difficulty is not
controlled between arms.

---

## 7. Reproducibility model

Two modes, and the distinction is the honest core of this benchmark.

**Recorded mode is the artifact.** The fixtures ship with their verdicts
committed. `node bin/benchmark.mjs --recorded` reads them, scores them, and
prints the comparison table. No key. No network. No variance. Any stranger who
clones the repository gets the number in the README, byte for byte. If they do
not, that is a bug in this repository.

**Live mode is the method.** Point it at your own strategy documents with your
own key and it runs the same pipeline against a live examiner. The number will
move between runs. Live mode demonstrates that the recorded verdicts were
produced by a real process rather than authored to a conclusion, and it lets a
reader run the benchmark on documents we never saw.

### Provenance of the committed verdicts, stated plainly

The verdicts committed in this repository were **authored by applying the
examiner rubric in section 4 to each claim by hand**. They were not captured
from a live model run. Saying otherwise would be the exact failure this
benchmark was built to expose, so it is said here instead.

What that costs the result. The committed number demonstrates that the pipeline
runs end to end and that the two arms differ under a consistently applied rule.
It is not independent evidence, because the same author wrote the arms and
graded them.

What removes the cost. Run live mode against the fixtures with your own key.

```
node bin/benchmark.mjs --live --arm fixtures/arm-a-naive --json
```

The `verdicts` array in that envelope is the recorded fixture format. Replacing
the committed `verdicts.json` with a live capture upgrades the artifact from
consistently applied to independently judged, and nothing else in the pipeline
changes.

### Provenance is mode-conditional

The provenance line describes how the verdicts in front of you were actually
produced, and it therefore differs by mode. A recorded run says they were
applied by hand. A live run names the model, the run timestamp, and the blinded
context, and warns that a re-run will vary.

A single constant would mean a live run printing "not captured from a live model
run" about verdicts a model had just produced. Since this document instructs
readers to paste a live envelope into a fixture, that false line would travel
into their repositories. A live envelope that names no model is refused, because
an unattributed verdict cannot be reproduced or challenged.

---

## 8. What this benchmark does NOT claim

Written before the results, so it cannot be tuned to them.

1. **It does not measure business outcomes.** A strategy whose claims survive
   scrutiny may still fail in market. Claim survivability is an epistemic
   property of a document, not a prediction of revenue. Nothing here licenses
   the sentence "gated strategy performs better."

2. **The judge is a language model.** Scrutiny verdicts in live mode come from a
   model, and models are inconsistent, promptable, and biased toward agreement.
   The recorded fixtures remove the variance from reproduction but do not remove
   it from the origin of those verdicts.

3. **N is small.** Two documents, claims in the tens. This is an illustrative
   benchmark, not a study. No confidence interval is offered because none would
   be meaningful at this size.

4. **Extraction is heuristic.** Four signal rules over sentences will miss
   claims phrased obliquely and will occasionally admit a sentence that is not
   really an assertion. The rules are published in section 3 precisely so a
   reader can disagree with a specific one rather than with the black box.

5. **The arms are synthetic and self-authored, and so are the committed
   verdicts.** Both transcripts were written for this benchmark, and the
   verdicts shipped with them were applied by hand rather than captured from a
   live model. A skeptical reader should assume author bias, and should run
   live mode, which is the entire reason live mode exists. See section 7.

6. **Different subjects across arms.** Northwind and Acme are different
   businesses. Difficulty is not held constant.

7. **A grade is a label, not a proof.** The benchmark reads grades that a
   document asserts about itself. It does not verify that a C1 is genuinely a
   verified primary source.

---

## 9. Interfaces

```js
// lib/claims.mjs
extractClaims(text) -> Claim[]
// Claim = { id, text, signals: string[], evidence: {id, grade} | null }

// lib/scrutiny.mjs
examine({ claims, context, provider }) -> Promise<Verdict[]>
// Verdict = { claimId, claim, verdict, reason }

// lib/providers/recorded.mjs
recordedProvider(records) -> provider
// records = [{ claim, verdict, reason }]

// lib/providers/anthropic.mjs
anthropicProvider({ apiKey, model, fetchImpl }) -> provider

// lib/arms.mjs
loadArm(dirPath) -> Promise<{ name, label, subject, strategyText, records }>

// lib/score.mjs
scoreArm({ name, label, verdicts }) -> ArmScore
compareArms(ArmScore[]) -> { arms, spread }
renderTable(comparison) -> string
```

### CLI

```
node bin/benchmark.mjs --recorded          run both fixture arms, print table
node bin/benchmark.mjs --recorded --json   same run, JSON envelope on stdout
node bin/benchmark.mjs --live --arm <dir>  run one arm against a live examiner
node bin/benchmark.mjs --help              usage
```

Exit codes.

| Code | Meaning |
|---|---|
| 0 | the run completed and printed a result |
| 1 | usage error, such as an unknown flag or a missing required argument |
| 2 | input could not be read or scored, such as a malformed or missing fixture |

---

## 10. House constraints

- Plain Node.js ESM, `.mjs` throughout.
- Zero runtime dependencies. Zero development dependencies. Node builtins only.
- Tests run on `node:test` via `npm test`, with no key and no network.
- Fail closed everywhere. A refusal names what is missing.
- README examples are pasted from real command output, never hand-written.
- MIT licensed.
