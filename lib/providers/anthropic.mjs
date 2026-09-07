/**
 * The live examiner.
 *
 * Calls the Anthropic messages API over plain fetch. No SDK, no dependency.
 * The key is read from the environment by the caller, held in a closure, sent
 * as a header, and never written to stdout, to an error message, or to a
 * returned value.
 *
 * Live verdicts vary between runs. That is a property of the method and it is
 * stated in SPEC.md section 8 rather than hidden.
 */

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-opus-5";
const DEFAULT_MAX_TOKENS = 1024;

const SYSTEM_PROMPT = [
  "You are an adversarial examiner reviewing one claim from a go-to-market strategy.",
  "Demand the basis for the claim. Ask what evidence would have to exist for it to be true as stated, and whether the document supplies it.",
  "Return SURVIVES only when a skeptical reader could accept the claim as written on the basis the document actually provides.",
  "Return COLLAPSES when the claim has no stated basis, or when it overstates what its evidence supports.",
  "A claim carrying a weak evidence grade is not automatically a survivor. A C5 assumption phrased as a firm projection collapses.",
  "Reply with a bare JSON object and nothing else, shaped exactly as",
  '{"verdict": "SURVIVES" | "COLLAPSES", "reason": "<one sentence>"}',
].join(" ");

function describeClaim(claim, context) {
  const evidence =
    claim.evidence === null || claim.evidence === undefined
      ? "none stated"
      : `${claim.evidence.id} at grade ${claim.evidence.grade}`;

  return [
    `Document context: ${context || "not supplied"}`,
    `Claim: ${claim.text}`,
    `Evidence the document binds to this claim: ${evidence}`,
  ].join("\n");
}

/** Pull the first JSON object out of the model's text block. */
function parseVerdict(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end <= start) {
    throw new Error(
      `Could not parse a verdict from the examiner response. ` +
        `Expected a JSON object carrying verdict and reason, received: ${text.slice(0, 200)}`
    );
  }

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (cause) {
    throw new Error(
      `Could not parse the examiner response as JSON. ` +
        `Received: ${text.slice(0, 200)}`,
      { cause }
    );
  }
}

/**
 * @param {object} options
 * @param {string} options.apiKey read from the environment by the caller
 * @param {string} [options.model]
 * @param {number} [options.maxTokens]
 * @param {typeof fetch} [options.fetchImpl] injected for tests
 */
export function anthropicProvider({
  apiKey,
  model = DEFAULT_MODEL,
  maxTokens = DEFAULT_MAX_TOKENS,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof apiKey !== "string" || apiKey.trim() === "") {
    throw new Error(
      "Live mode needs an API key and none was supplied. " +
        "Set ANTHROPIC_API_KEY in the environment, or run with --recorded, " +
        "which needs no key at all."
    );
  }

  if (typeof fetchImpl !== "function") {
    throw new Error(
      "No fetch implementation is available. Live mode needs Node 20 or newer."
    );
  }

  return async function examineLive(claim, context) {
    const response = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: describeClaim(claim, context) }],
      }),
    });

    if (!response.ok) {
      // The body is echoed, the key is not. Nothing in this branch may carry
      // the credential outward.
      const detail = await response.text().catch(() => "<no body>");
      throw new Error(
        `The examiner API returned status ${response.status}. ` +
          `Detail: ${String(detail).slice(0, 300)}`
      );
    }

    const payload = await response.json();

    if (payload.stop_reason === "refusal") {
      throw new Error(
        `The examiner declined to review claim ${claim.id}. ` +
          `The run is refused rather than scored without it.`
      );
    }

    const block = (payload.content || []).find((b) => b.type === "text");

    if (block === undefined) {
      throw new Error(
        `The examiner response carried no text block for claim ${claim.id}, ` +
          `so no verdict could be parsed.`
      );
    }

    const parsed = parseVerdict(block.text);

    return { verdict: parsed.verdict, reason: parsed.reason };
  };
}
