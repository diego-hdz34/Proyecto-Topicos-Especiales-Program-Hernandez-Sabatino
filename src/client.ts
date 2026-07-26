import { ClientConfig, RequestOptions, Interceptors } from './types';
import { HttpError, TimeoutError } from './errors';

export class HttpClient {
    private baseURL: string;
    private defaultHeaders: Record<string, string>;
    private defaultTimeout: number;
    public interceptors: Interceptors;

    constructor(config: ClientConfig = {}) {
        this.baseURL = config.baseURL ? config.baseURL.replace(/\/$/, '') : '';
        this.defaultHeaders = config.headers || {};
        this.defaultTimeout = config.timeout || 10000; // 10s por defecto
        this.interceptors = {};
    }

    private buildURL(endpoint: string, params?: Record<string, string | number | boolean>): string {
        const fullPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const urlString = this.baseURL ? `${this.baseURL}${fullPath}` : endpoint;
        const url = new URL(urlString, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');

        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    url.searchParams.append(key, String(value));
                }
            });
        }

        return url.toString();
    }

    public async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        let url = this.buildURL(endpoint, options.params);

        let requestOptions: RequestOptions = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...this.defaultHeaders,
                ...options.headers,
            },
        };

        // Aplicar interceptor de petición si existe
        if (this.interceptors.request) {
            const intercepted = await this.interceptors.request(url, requestOptions);
            url = intercepted.url;
            requestOptions = intercepted.options;
        }

        // Configuración de Timeout con AbortController
        const timeoutMs = options.timeout ?? this.defaultTimeout;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            let response = await fetch(url, {
                ...requestOptions,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // Aplicar interceptor de respuesta si existe
            if (this.interceptors.response) {
                response = await this.interceptors.response(response);
            }

            // Parsear respuesta según el Content-Type
            let data: any = null;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json().catch(() => null);
            } else {
                data = await response.text().catch(() => null);
            }

            // Validar si la respuesta no es 2xx
            if (!response.ok) {
                throw new HttpError(response, data);
            }

            return data as T;
        } catch (error: any) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw new TimeoutError(timeoutMs);
            }
            throw error;
        }
    }

    // Métodos de conveniencia HTTP
    public get<T = any>(endpoint: string, options?: Omit<RequestOptions, 'body'>): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'GET' });
    }

    public post<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined,
        });
    }

    public put<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'PUT',
            body: body ? JSON.stringify(body) : undefined,
        });
    }

    public delete<T = any>(endpoint: string, options?: Omit<RequestOptions, 'body'>): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'DELETE' });
    }
}