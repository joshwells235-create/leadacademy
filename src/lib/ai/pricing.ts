/**
 * USD per million tokens, for usage tracking. Update when Anthropic changes pricing.
 * Source: https://www.anthropic.com/pricing
 */
export const PRICING_PER_MILLION: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-opus-4-6": { input: 15, output: 75 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

export function estimateCostCents(
  model: string,
  tokensIn: number,
  tokensOut: number,
): number {
  const p = PRICING_PER_MILLION[model];
  if (!p) return 0;
  const usd = (tokensIn / 1_000_000) * p.input + (tokensOut / 1_000_000) * p.output;
  return Math.round(usd * 100);
}
