import pc from 'picocolors';

interface SessionRow {
  source: string;
  model: string | null;
  total_input: number;
  total_output: number;
  total_cache_read: number;
  total_cache_write: number;
  tool_count: number;
  error_count: number;
}

interface ToolStat {
  tool_name: string;
  total: number;
  success: number;
  failed: number;
  avg_duration_ms: number | null;
}

interface ModelStat {
  model: string;
  sessions: number;
  input_tokens: number;
  output_tokens: number;
  cache_read: number;
  cache_write: number;
}

interface SourceStat {
  source: string;
  sessions: number;
  input_tokens: number;
  output_tokens: number;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

export async function stats(opts: { url: string; token: string; days: number; source?: string }) {
  const since = new Date();
  since.setDate(since.getDate() - opts.days);
  const from = since.toISOString();

  const headers = { Authorization: `Bearer ${opts.token}` };
  const base = opts.url;
  const sourceParam = opts.source ? `&source=${opts.source}` : '';

  try {
    const [sessionsRes, toolsRes, modelsRes, sourcesRes] = await Promise.all([
      fetch(`${base}/sessions?from=${from}&limit=10000${sourceParam}`, { headers }),
      fetch(`${base}/stats/tools?from=${from}${sourceParam}`, { headers }),
      fetch(`${base}/stats/models?from=${from}`, { headers }),
      fetch(`${base}/stats/sources?from=${from}`, { headers }),
    ]);

    const sessions = (await sessionsRes.json()) as SessionRow[];
    const tools = (await toolsRes.json()) as ToolStat[];
    const models = (await modelsRes.json()) as ModelStat[];
    const sources = (await sourcesRes.json()) as SourceStat[];

    const totalInput = sessions.reduce((s, r) => s + r.total_input, 0);
    const totalOutput = sessions.reduce((s, r) => s + r.total_output, 0);
    const totalCacheRead = sessions.reduce((s, r) => s + r.total_cache_read, 0);
    const totalCacheWrite = sessions.reduce((s, r) => s + r.total_cache_write, 0);
    const totalTools = sessions.reduce((s, r) => s + r.tool_count, 0);
    const totalErrors = sessions.reduce((s, r) => s + r.error_count, 0);

    console.log(`
${pc.cyan('dops stats')} — last ${opts.days} days (since ${from.slice(0, 10)})

  ${pc.bold('Overview')}
  ${pc.green('Sessions')}:     ${fmt(sessions.length)}
  ${pc.green('Output tokens')}: ${fmt(totalOutput)}
  ${pc.green('Input tokens')}:  ${fmt(totalInput)}
  ${pc.green('Cache read')}:    ${fmt(totalCacheRead)}
  ${pc.green('Cache write')}:   ${fmt(totalCacheWrite)}
  ${pc.green('Tool calls')}:    ${fmt(totalTools)}
  ${pc.green('Errors')}:        ${fmt(totalErrors)}`);

    if (sources.length > 0) {
      console.log(`\n  ${pc.bold('By source')}`);
      for (const s of sources) {
        console.log(
          `  ${pc.green(s.source.padEnd(12))} ${fmt(s.sessions).padStart(5)} sessions   ${fmt(s.output_tokens).padStart(12)} output tokens`,
        );
      }
    }

    if (models.length > 0) {
      console.log(`\n  ${pc.bold('By model')}`);
      for (const m of models) {
        console.log(
          `  ${pc.green(m.model.padEnd(30))} ${fmt(m.sessions).padStart(5)} sessions   ${fmt(m.output_tokens).padStart(12)} output tokens`,
        );
      }
    }

    if (tools.length > 0) {
      console.log(`\n  ${pc.bold('Top tools')}`);
      for (const t of tools.slice(0, 15)) {
        const rate = t.total > 0 ? Math.round((t.success / t.total) * 100) : 0;
        const dur = t.avg_duration_ms ? `${Math.round(t.avg_duration_ms)}ms` : '';
        console.log(
          `  ${pc.green(t.tool_name.padEnd(30))} ${fmt(t.total).padStart(5)} calls   ${rate}% ok${dur ? `   ${pc.dim(dur)}` : ''}`,
        );
      }
    }

    console.log('');
  } catch (err) {
    console.log(pc.red(`Failed to fetch stats: ${(err as Error).message}`));
    console.log(pc.dim(`Is dops running at ${opts.url}?`));
  }
}
