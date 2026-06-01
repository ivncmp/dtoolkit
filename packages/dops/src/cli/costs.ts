import pc from 'picocolors';

interface ModelStat {
  model: string;
  sessions: number;
  input_tokens: number;
  output_tokens: number;
  cache_read: number;
  cache_write: number;
}

type Pricing = Record<
  string,
  { input: number; output: number; cache_read: number; cache_write: number }
>;

function calcCost(model: string, tokens: ModelStat, pricing: Pricing): number {
  const p = pricing[model];
  if (!p) return 0;

  return (
    (tokens.input_tokens / 1_000_000) * p.input +
    (tokens.output_tokens / 1_000_000) * p.output +
    (tokens.cache_read / 1_000_000) * p.cache_read +
    (tokens.cache_write / 1_000_000) * p.cache_write
  );
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

export async function costs(opts: { url: string; token: string; days: number }) {
  const since = new Date();
  since.setDate(since.getDate() - opts.days);
  const from = since.toISOString();

  const headers = { Authorization: `Bearer ${opts.token}` };

  try {
    const [modelsRes, healthRes] = await Promise.all([
      fetch(`${opts.url}/stats/models?from=${from}`, { headers }),
      fetch(`${opts.url}/health`),
    ]);
    const models = (await modelsRes.json()) as ModelStat[];
    const health = (await healthRes.json()) as { pricing?: Pricing };
    const pricing: Pricing = health.pricing || {};

    let totalCost = 0;

    console.log(`
${pc.cyan('dops costs')} — last ${opts.days} days (since ${from.slice(0, 10)})
`);

    if (models.length === 0) {
      console.log(pc.dim('  No data found.'));
      return;
    }

    console.log(
      `  ${'Model'.padEnd(35)} ${'Sessions'.padStart(8)} ${'Output'.padStart(12)} ${'Cache Read'.padStart(14)} ${'Cost'.padStart(10)}`,
    );
    console.log(
      `  ${'─'.repeat(35)} ${'─'.repeat(8)} ${'─'.repeat(12)} ${'─'.repeat(14)} ${'─'.repeat(10)}`,
    );

    for (const m of models) {
      const cost = calcCost(m.model, m, pricing);
      totalCost += cost;
      const costStr = cost > 0 ? `$${cost.toFixed(2)}` : pc.dim('no pricing');

      console.log(
        `  ${pc.green(m.model.padEnd(35))} ${fmt(m.sessions).padStart(8)} ${fmt(m.output_tokens).padStart(12)} ${fmt(m.cache_read).padStart(14)} ${costStr.padStart(10)}`,
      );
    }

    console.log(
      `  ${'─'.repeat(35)} ${'─'.repeat(8)} ${'─'.repeat(12)} ${'─'.repeat(14)} ${'─'.repeat(10)}`,
    );
    console.log(
      `  ${pc.bold('Total'.padEnd(35))} ${fmt(models.reduce((s, m) => s + m.sessions, 0)).padStart(8)} ${fmt(models.reduce((s, m) => s + m.output_tokens, 0)).padStart(12)} ${fmt(models.reduce((s, m) => s + m.cache_read, 0)).padStart(14)} ${pc.bold(`$${totalCost.toFixed(2)}`).padStart(10)}`,
    );

    console.log(
      `\n  ${pc.dim('Pricing: per 1M tokens. Models without pricing data show "no pricing".')}`,
    );
    console.log('');
  } catch (err) {
    console.log(pc.red(`Failed to fetch costs: ${(err as Error).message}`));
    console.log(pc.dim(`Is dops running at ${opts.url}?`));
  }
}
