# gtm-strategy-benchmark
Ask a language model for a go-to-market strategy and you get fluent, confident
prose. This benchmark asks a harder question of that prose, which is how much of
it survives an adversary demanding the evidence behind every sentence.

Two strategy documents are scored by one rule. Arm A is naive, written the way a
single unconstrained prompt writes. Arm B is gated, written under a discipline
where every claim must carry a graded evidence entry or be refused before it
reaches the page. The number reported is **claim survival rate**, the fraction
of a document's assertable claims that hold up under examination.

---

## Sixty second quickstart, no API key

```bash
git clone <this repo> && cd strategy-benchmark
npm test                          # 99 tests, no key, no network
node bin/benchmark.mjs --recorded
```

Zero dependencies. There is no `npm install` step because there is nothing to
install. Node 20 or newer.

---

## The headline number

The complete output of `node bin/benchmark.mjs --recorded`, pasted verbatim.
Nothing is trimmed, including the closing paragraph about where these verdicts
came from, which is the last line anyone should be allowed to cut.

```
Claim survival under adversarial scrutiny (recorded)

| Arm          | Claims | Survives | Collapses | Survival rate |
|--------------|--------|----------|-----------|---------------|
| Arm A, naive |     16 |        1 |        15 |          6.3% |
| Arm B, gated |     10 |        6 |         4 |         60.0% |

Spread between arms: 53.8%

Arm A, naive examines Northwind Robotics, a fictional warehouse automation vendor.
Arm B, gated examines Acme Freight, a fictional regional freight brokerage.

The verdicts committed in this repository were applied by hand from the examiner rubric in SPEC.md section 4. They were not captured from a live model run. Run --live with your own key to judge these claims independently.
```

Read the shape of it rather than the decimal. The gated arm makes fewer claims
and keeps more of them. The naive arm makes more claims and keeps almost none,
because almost none of them are attached to anything.

The four collapses in arm B are the part worth staring at. A gated claim is not
automatically a survivor. A C5 assumption phrased as a firm projection collapses
exactly the way a naive claim does, and one arm B claim collapses for stating a
magnitude its cited evidence supports only as a direction. The gate helps by
making the grade visible, not by granting immunity.

Arm B's denominator is deliberately smaller than it could be. Sentences where
the document describes its own restraint, such as "this plan makes no
lane-level targeting claim", are excluded before scoring. They are true by
construction, and a naive document structurally cannot produce them, so
counting them would hand the gated arm survivors the naive arm has no way to
earn. Excluding them moved arm B from 66.7% down to 60.0%, and the number is
worth more for it.

---

## How it works

Three stages. Two of them are deterministic, and the third is the only place a
model can enter.

```
strategy document
        |
        v
  [ claim extraction ]      deterministic, published rules, no model
        |
        v
  [ adversarial scrutiny ]  one examination per claim, provider injected
        |
        v
  [ scoring ]               deterministic arithmetic
```

**Claim extraction** treats a sentence as an assertable claim when it carries at
least one of four signals, which are a number, a causal connector, a forward
looking projection, or a named market or entity. Two kinds of sentence are never
claims whatever signals they carry, which are bare cross references such as "See
section 3.4" and meta-claims where the document describes its own scope rather
than the world. The rules are written out in full in [SPEC.md](SPEC.md) section
3 so you can disagree with a specific one rather than with a black box.

**Scrutiny** hands each claim to an examiner that demands its basis and returns
`SURVIVES` or `COLLAPSES` with a reason. The examiner is an injected function,
so the recorded provider replays committed verdicts byte for byte while the live
provider talks to a model.

**Scoring** counts and divides. That is all it does.

### The examiner is blinded

The examiner is never told which arm it is judging. Both arms supply a context
line filling one neutral template, naming the company and its industry and
nothing else.

```
A go-to-market strategy document for Northwind Robotics, a warehouse automation vendor.
A go-to-market strategy document for Acme Freight, a regional freight brokerage.
```

A context saying "produced under a gated-evidence discipline" would hand the
judge the hypothesis, which is how a benchmark quietly rigs itself. A test
composes the prompt for both arms and greps it for condition-revealing tokens,
so the blinding is checked rather than promised.

One asymmetry stays on purpose. The prompt does state whether the claim is bound
to a graded evidence entry, because that is the property under examination and
the rubric cannot be applied without it.

### Everything fails closed

The failure this design exists to prevent is a benchmark printing a comfortable
number when it examined nothing. So a missing key, a throwing examiner, an
unknown verdict string, a verdict with no reason, a fixture with no recorded
verdict for a claim, and an empty claim set each refuse the run and name what is
missing. There is no default verdict anywhere in the pipeline, and no partial
score.

Real output, with only the absolute checkout path swapped for a generic one.

```bash
$ node bin/benchmark.mjs --recorded --arm fixtures/no-such-arm
Could not read /home/you/strategy-benchmark/fixtures/no-such-arm/arm.json. ENOENT: no such file or directory, open '/home/you/strategy-benchmark/fixtures/no-such-arm/arm.json'
$ echo $?
2
```

---

## What this benchmark does not claim

Written before the results, so it could not be tuned to them. The full list is
[SPEC.md](SPEC.md) section 8. The four that matter most to a reader deciding
how much weight to put on the number.

1. **It does not measure business outcomes.** Claim survivability is a property
   of a document. A strategy whose claims survive scrutiny can still fail in
   market, and nothing here licenses the sentence "gated strategy performs
   better."

2. **The committed verdicts were applied by hand.** They were produced by
   applying the published examiner rubric to each claim, not captured from a
   live model run. The committed number therefore shows that two arms differ
   under a consistently applied rule. It is not independent judgment, because
   the same author wrote both arms and graded them. Live mode exists to remove
   exactly this limitation, and the tool prints this caveat on every run.

3. **N is small and the arms are synthetic.** Two invented companies, claims in
   the tens, both documents written for this benchmark. No confidence interval
   is offered because none would mean anything at this size.

4. **Extraction is heuristic.** Four rules over sentences will miss a claim
   phrased obliquely and will occasionally admit a sentence that is not really
   an assertion.

Arm A was deliberately written to be thinly evidenced, which is what a naive
prompt produces and is the whole reason it is arm A. Its 6.3% is a fair score of
that document and not a fair score of every unconstrained model output.

---

## Running it on your own strategies

Live mode runs the same pipeline against a real examiner, with your key and your
documents.

```bash
export ANTHROPIC_API_KEY=...
node bin/benchmark.mjs --live --arm path/to/your-arm
```

An arm is a directory holding three files.

```
your-arm/
  arm.json        name, label, subject, context, and the two filenames below
  strategy.md     the document to score
  verdicts.json   recorded verdicts, only read in recorded mode
```

The key is read from the environment, held in a closure, sent as a request
header, and never printed, logged, or returned. Live results vary between runs,
which is a property of using a model as a judge rather than a defect to hide.

To turn a live run into a reproducible fixture, capture its verdicts.

```bash
node bin/benchmark.mjs --live --arm path/to/your-arm --json
```

The `verdicts` array in that envelope is the recorded fixture format. Writing it
into `verdicts.json` upgrades your arm from consistently applied to
independently judged, and nothing else in the pipeline changes.

A live envelope carries its own provenance rather than the committed one, so
what you paste describes how it was actually made.

```json
{
  "mode": "live",
  "provenance": "These verdicts were judged live by claude-opus-5 at 2026-09-06T12:00:00.000Z, against a blinded context that names only the company and its industry. A model judge is not deterministic, so a re-run will vary. Commit these verdicts to an arm's verdicts.json to freeze this run as a reproducible fixture.",
  "model": "claude-opus-5",
  "ranAt": "2026-09-06T12:00:00.000Z"
}
```

### Evidence annotations

A gated document binds a claim to its evidence inline, at the end of the
sentence.

```markdown
Carrier acceptance on the first tender averages 61 percent. [evidence: E1 | grade: C1]
```

Grades run C1 through C5 following the admiralty-style convention the
gtm-architect discipline uses, from a verified primary source down to a stated
assumption. This repository cites that discipline and reimplements the
vocabulary. It does not import the tool. A grade outside C1 to C5, or an
annotation with no grade at all, is refused loudly rather than dropped, because
a silently dropped grade turns a gated document into a naive one.

An annotation binds to the sentence immediately before it and to no other. If
that sentence carries no assertable claim the run refuses and names the orphan,
rather than attaching the evidence to some earlier claim it was never written
for.

```
$ node bin/benchmark.mjs --recorded --arm ./orphan-arm
Evidence entry E4 at grade C5 has nothing to bind to. The sentence before it, "We assume that holds.", carries no assertable claim. Attach the evidence to a claim or remove the annotation.
```

---

## CLI

```
node bin/benchmark.mjs --recorded            both fixture arms, keyless
node bin/benchmark.mjs --recorded --json     the same run as a JSON envelope
node bin/benchmark.mjs --recorded --arm DIR  one arm from its own fixtures
node bin/benchmark.mjs --live --arm DIR      one arm against a live examiner
node bin/benchmark.mjs --help
```

| Exit code | Meaning |
|---|---|
| 0 | the run completed and printed a result |
| 1 | usage error, such as an unknown flag or a missing argument |
| 2 | input could not be read or scored |

---

## Layout

```
SPEC.md                     the design, the refusal table, the limitations
lib/claims.mjs              deterministic claim extraction
lib/scrutiny.mjs            the examination loop and its verdict contract
lib/providers/recorded.mjs  replays committed verdicts, no key
lib/providers/anthropic.mjs live examiner over plain fetch, no SDK
lib/arms.mjs                fixture loading, every error names its file
lib/score.mjs               rates, spread, and the comparison table
lib/run.mjs                 the wire between the three stages
bin/benchmark.mjs           the CLI
fixtures/                   two synthetic arms and their recorded verdicts
test/                       99 tests on node:test
```

Everything in `fixtures/` is invented. Northwind Robotics and Acme Freight do
not exist, and every number attributed to them was made up for this benchmark.

MIT licensed.
