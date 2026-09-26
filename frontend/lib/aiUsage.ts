type ModelPricing = {
  input: number;
  output: number;
};

export type PersistableUsageEvent = {
  operation: string;
  model: string;
  provider?: string;
  usageSource?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs?: number | null;
  status?: string;
  errorCode?: string | null;
};

function parsePricing(): Record<string, ModelPricing> {
  const raw = process.env.OPENAI_MODEL_PRICING_JSON?.trim();
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, { input?: unknown; output?: unknown }>;
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([model, value]) => {
        const input = Number(value?.input);
        const output = Number(value?.output ?? value?.input);
        if (!Number.isFinite(input) || input < 0 || !Number.isFinite(output) || output < 0) {
          return [];
        }
        return [[model, { input, output }]];
      })
    );
  } catch {
    return {};
  }
}

const pricing = parsePricing();

export function calculateUsageCosts(model: string, promptTokens: number, completionTokens: number) {
  const entry = pricing[model];
  if (!entry) {
    return {
      costInputUsd: null,
      costOutputUsd: null,
      costTotalUsd: null
    };
  }

  const costInputUsd = Number(((promptTokens / 1_000_000) * entry.input).toFixed(8));
  const costOutputUsd = Number(((completionTokens / 1_000_000) * entry.output).toFixed(8));

  return {
    costInputUsd,
    costOutputUsd,
    costTotalUsd: Number((costInputUsd + costOutputUsd).toFixed(8))
  };
}
