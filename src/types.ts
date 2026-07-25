export interface RequestOptions extends Omit<RequestInit, 'headers'> {
    headers?: Record<string, string>;
    params?: Record<string, string | number | boolean>;
    timeout?: number;
}

export interface ClientConfig {
    baseURL?: string;
    headers?: Record<string, string>;
    timeout?: number;
}

export type RequestInterceptor = (
    url: string,
    options: RequestOptions
) => Promise<{ url: string; options: RequestOptions }> | { url: string; options: RequestOptions };

export type ResponseInterceptor = (response: Response) => Promise<Response> | Response;

export interface Interceptors {
    request?: RequestInterceptor;
    response?: ResponseInterceptor;
}