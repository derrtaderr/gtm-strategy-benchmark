# Go-to-market strategy, Acme Freight

Everything below is fictional. Acme Freight does not exist. This document is a
synthetic transcript written to represent the output of a gated-evidence walk,
and it is used as arm B of the benchmark.

Every claim below carries an evidence id and a confidence grade, written in the
form the benchmark reads. Claims that could not be bound to an evidence entry
were refused during drafting and are absent rather than softened.

## Evidence register

```
E1  Dispatch export, 14 months of tender records, pulled from the brokerage's
    own system and reconciled against invoices.          C1
E2  Churn analysis, produced independently by the finance team and by an
    outside bookkeeper, agreeing on direction.           C2
E3  Working assumption held by the operations lead, with no measurement
    behind it.                                           C5
E4  Five recorded shipper interviews, single interviewer, not corroborated.  C3
E5  Integration review, written by the vendor and confirmed by a second
    engineer against the live system.                    C2
E6  One outbound test, 140 sends, run over two weeks.    C1
E7  No evidence located. Recorded as an open question.   C5
```

## What the evidence supports

Acme Freight books 4,100 loads a month across its Southeast corridor. [evidence: E1 | grade: C1]

Carrier acceptance on the first tender averages 61 percent. [evidence: E1 | grade: C1]

Shippers who lost a load to a failed tender churn at a higher rate than shippers who did not. [evidence: E2 | grade: C2]

Three of the five shippers interviewed named tender reliability as their first reason for consolidating brokers. [evidence: E4 | grade: C3]

The dispatch team can be instrumented without a TMS migration. [evidence: E5 | grade: C2]

An outbound test produced 9 replies from 140 sends over two weeks. [evidence: E6 | grade: C1]

## What is assumed rather than known

Assume for planning that first-tender acceptance is a constraint on margin rather than only a symptom of one. [evidence: E3 | grade: C5]

Raising first-tender acceptance to 75 percent will lift gross margin by 3 points. [evidence: E3 | grade: C5]

Mid-market shippers moving 200 to 900 loads a month are the segment where reliability outranks price. [evidence: E4 | grade: C3]

The reply rate from the outbound test will hold as send volume scales. [evidence: E6 | grade: C4]

Paid search is deprioritized because no evidence was located either way on its performance for this segment. [evidence: E7 | grade: C5]

## What was refused

Acme Freight holds no usable data on win rate by lane, so this plan makes no lane-level targeting claim.
