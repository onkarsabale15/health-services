export interface HttpRequestConfig {
  url: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  headers?: Record<string, string>;
  params?: Record<string, string>;
  data?: unknown;
  authType?: string;
  authToken?: string;
  timeout?: number;
  responseType?: string;
  contentType?: string;
}

export interface HttpResponse<T = unknown> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export interface IHttpClient {
  request<T = unknown>(config: HttpRequestConfig): Promise<HttpResponse<T>>;
}
