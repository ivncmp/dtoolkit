export interface HttpClientOptions {
  baseUrl: string;
  token?: string;
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly token: string | undefined;

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.token = options.token;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.rawRequest(method, path, body);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new SdkError(res.status, text, path);
    }

    return res.json() as Promise<T>;
  }

  async requestRaw(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Response> {
    const res = await this.rawRequest(method, path, body);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new SdkError(res.status, text, path);
    }

    return res;
  }

  get<T>(path: string): Promise<T> {
    return this.request("GET", path);
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request("POST", path, body);
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return this.request("PUT", path, body);
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request("PATCH", path, body);
  }

  del<T>(path: string): Promise<T> {
    return this.request("DELETE", path);
  }

  private rawRequest(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Response> {
    const headers: Record<string, string> = {};

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    return fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }
}

export class SdkError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly path: string,
  ) {
    super(`sdk ${status} on ${path}: ${body}`);
    this.name = "SdkError";
  }
}

export function enc(s: string): string {
  return encodeURIComponent(s);
}

export function qs(params: URLSearchParams): string {
  const str = params.toString();
  return str ? `?${str}` : "";
}
