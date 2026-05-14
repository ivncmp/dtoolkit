import type { AdapterStreamEvent } from '@dtoolkit/core';

import { HttpClient, SdkError, enc, qs } from '../http.js';

import type {
  AskOptions,
  AskResponse,
  DProxyHealthResponse,
  HistoryEntry,
  MemorySearchResult,
  TemplateDefinition,
  TemplateRunOptions,
} from './types.js';

export interface DProxyClientOptions {
  baseUrl: string;
  token?: string;
}

export class DProxyClient {
  private readonly http: HttpClient;

  constructor(baseUrl: string, token?: string);
  constructor(options: DProxyClientOptions);
  constructor(baseUrlOrOptions: string | DProxyClientOptions, token?: string) {
    if (typeof baseUrlOrOptions === 'string') {
      this.http = new HttpClient({ baseUrl: baseUrlOrOptions, token });
    } else {
      this.http = new HttpClient({
        baseUrl: baseUrlOrOptions.baseUrl,
        token: baseUrlOrOptions.token,
      });
    }
  }

  // --- Health ---

  async health(): Promise<DProxyHealthResponse> {
    return this.http.get('/v1/health');
  }

  // --- Ask ---

  async ask(prompt: string, options?: AskOptions): Promise<AskResponse> {
    return this.http.post('/v1/ask', { prompt, ...options });
  }

  async *askStream(prompt: string, options?: AskOptions): AsyncGenerator<AdapterStreamEvent> {
    const res = await this.http.requestRaw('POST', '/v1/ask', {
      prompt,
      stream: true,
      ...options,
    });

    if (!res.body) {
      throw new SdkError(0, 'Response body is null', '/v1/ask');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const payload = trimmed.slice(6);
          if (payload === '[DONE]') return;

          const event = JSON.parse(payload) as
            | AdapterStreamEvent
            | { type: 'error'; error: string };

          if (event.type === 'error') {
            throw new SdkError(0, (event as { error: string }).error, '/v1/ask');
          }

          yield event as AdapterStreamEvent;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // --- History ---

  async listHistory(limit?: number): Promise<HistoryEntry[]> {
    const params = new URLSearchParams();
    if (limit !== undefined) params.set('limit', String(limit));
    const res = await this.http.get<{ entries: HistoryEntry[] }>(`/v1/history${qs(params)}`);
    return res.entries;
  }

  async getHistory(id: string): Promise<HistoryEntry> {
    return this.http.get(`/v1/history/${enc(id)}`);
  }

  async searchHistory(query: string): Promise<HistoryEntry[]> {
    const params = new URLSearchParams({ q: query });
    const res = await this.http.get<{ entries: HistoryEntry[] }>(`/v1/history/search${qs(params)}`);
    return res.entries;
  }

  async clearHistory(before?: string): Promise<{ removed: number }> {
    const params = new URLSearchParams();
    if (before) params.set('before', before);
    return this.http.request('DELETE', `/v1/history${qs(params)}`);
  }

  // --- Memory ---

  async listMemoryKeys(): Promise<string[]> {
    const res = await this.http.get<{ keys: string[] }>('/v1/memory');
    return res.keys;
  }

  async getMemory(key: string): Promise<string> {
    const res = await this.http.get<{ key: string; content: string }>(`/v1/memory/${enc(key)}`);
    return res.content;
  }

  async setMemory(key: string, content: string): Promise<void> {
    await this.http.put(`/v1/memory/${enc(key)}`, { content });
  }

  async deleteMemory(key: string): Promise<void> {
    await this.http.del(`/v1/memory/${enc(key)}`);
  }

  async searchMemory(query: string): Promise<MemorySearchResult[]> {
    const params = new URLSearchParams({ q: query });
    const res = await this.http.get<{ results: MemorySearchResult[] }>(
      `/v1/memory/search${qs(params)}`,
    );
    return res.results;
  }

  // --- Templates ---

  async listTemplates(): Promise<TemplateDefinition[]> {
    const res = await this.http.get<{ templates: TemplateDefinition[] }>('/v1/templates');
    return res.templates;
  }

  async getTemplate(name: string): Promise<TemplateDefinition> {
    return this.http.get(`/v1/templates/${enc(name)}`);
  }

  async saveTemplate(name: string, template: TemplateDefinition): Promise<void> {
    await this.http.put(`/v1/templates/${enc(name)}`, template);
  }

  async runTemplate(name: string, options?: TemplateRunOptions): Promise<AskResponse> {
    return this.http.post(`/v1/templates/${enc(name)}/run`, options ?? {});
  }

  async deleteTemplate(name: string): Promise<void> {
    await this.http.del(`/v1/templates/${enc(name)}`);
  }

  // --- Config ---

  async getConfig(): Promise<unknown> {
    return this.http.get('/v1/config');
  }

  async getConfigValue(key: string): Promise<unknown> {
    const res = await this.http.get<{ key: string; value: unknown }>(`/v1/config/${key}`);
    return res.value;
  }

  async setConfigValue(key: string, value: string): Promise<void> {
    await this.http.put(`/v1/config/${key}`, { value });
  }
}
