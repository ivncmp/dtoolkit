import { HttpClient, qs } from '../http.js';

import type {
  DOpsCreateSession,
  DOpsDateFilters,
  DOpsEndSession,
  DOpsError,
  DOpsEvent,
  DOpsHealthResponse,
  DOpsModelStat,
  DOpsSessionDetail,
  DOpsSessionFilters,
  DOpsSessionRow,
  DOpsSourceStat,
  DOpsStatsFilters,
  DOpsTimeSeriesBucket,
  DOpsTimeSeriesFilters,
  DOpsTokenUsage,
  DOpsToolCall,
  DOpsToolStat,
} from './types.js';

export interface DOpsClientOptions {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
}

export class DOpsClient {
  private readonly http: HttpClient;

  constructor(baseUrl: string, token: string);
  constructor(options: DOpsClientOptions);
  constructor(baseUrlOrOptions: string | DOpsClientOptions, token?: string) {
    if (typeof baseUrlOrOptions === 'string') {
      this.http = new HttpClient({
        baseUrl: baseUrlOrOptions,
        token: token ?? '',
      });
    } else {
      this.http = new HttpClient({
        baseUrl: baseUrlOrOptions.baseUrl,
        token: baseUrlOrOptions.token,
        timeoutMs: baseUrlOrOptions.timeoutMs,
      });
    }
  }

  // --- Health ---

  async health(): Promise<DOpsHealthResponse> {
    return this.http.get('/health');
  }

  // --- Sessions ---

  async createSession(session: DOpsCreateSession): Promise<{ id: string }> {
    return this.http.post('/sessions', session);
  }

  async endSession(id: string, data?: DOpsEndSession): Promise<{ updated: true; id: string }> {
    return this.http.patch(`/sessions/${encodeURIComponent(id)}`, data);
  }

  async listSessions(filters?: DOpsSessionFilters): Promise<DOpsSessionRow[]> {
    const params = new URLSearchParams();
    if (filters?.source) params.set('source', filters.source);
    if (filters?.model) params.set('model', filters.model);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.from) params.set('from', filters.from);
    if (filters?.to) params.set('to', filters.to);
    if (filters?.limit != null) params.set('limit', String(filters.limit));
    if (filters?.offset != null) params.set('offset', String(filters.offset));
    return this.http.get(`/sessions${qs(params)}`);
  }

  async getSession(id: string): Promise<DOpsSessionDetail> {
    return this.http.get(`/sessions/${encodeURIComponent(id)}`);
  }

  // --- Events ---

  async ingestEvent(event: DOpsEvent): Promise<{ id: string }> {
    return this.http.post('/events', event);
  }

  async ingestBatch(events: DOpsEvent[]): Promise<{ ingested: number }> {
    return this.http.post('/events/batch', { events });
  }

  // --- Tool calls ---

  async recordToolCall(toolCall: DOpsToolCall): Promise<{ id: string }> {
    return this.http.post('/tool-calls', toolCall);
  }

  // --- Token usage ---

  async recordTokenUsage(usage: DOpsTokenUsage): Promise<{ id: string }> {
    return this.http.post('/token-usage', usage);
  }

  // --- Errors ---

  async recordError(error: DOpsError): Promise<{ id: string }> {
    return this.http.post('/errors', error);
  }

  // --- Stats ---

  async timeseries(filters?: DOpsTimeSeriesFilters): Promise<DOpsTimeSeriesBucket[]> {
    const params = new URLSearchParams();
    if (filters?.from) params.set('from', filters.from);
    if (filters?.to) params.set('to', filters.to);
    if (filters?.source) params.set('source', filters.source);
    if (filters?.interval) params.set('interval', filters.interval);
    return this.http.get(`/stats/timeseries${qs(params)}`);
  }

  async toolStats(filters?: DOpsStatsFilters): Promise<DOpsToolStat[]> {
    const params = new URLSearchParams();
    if (filters?.from) params.set('from', filters.from);
    if (filters?.to) params.set('to', filters.to);
    if (filters?.source) params.set('source', filters.source);
    return this.http.get(`/stats/tools${qs(params)}`);
  }

  async modelStats(filters?: DOpsDateFilters): Promise<DOpsModelStat[]> {
    const params = new URLSearchParams();
    if (filters?.from) params.set('from', filters.from);
    if (filters?.to) params.set('to', filters.to);
    return this.http.get(`/stats/models${qs(params)}`);
  }

  async sourceStats(filters?: DOpsDateFilters): Promise<DOpsSourceStat[]> {
    const params = new URLSearchParams();
    if (filters?.from) params.set('from', filters.from);
    if (filters?.to) params.set('to', filters.to);
    return this.http.get(`/stats/sources${qs(params)}`);
  }
}
