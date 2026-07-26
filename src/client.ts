/**
 * @fileoverview Cliente HTTP principal de SmartFetch.
 *
 * Implementa el patrón **Facade** para simplificar la API nativa `fetch`,
 * componiendo los aspectos de `withRetry` y `withTimeout` para proveer
 * resiliencia y control de tiempo de forma automática y configurable.
 *
 * @module client
 */

import { ClientConfig, RequestOptions, Interceptors } from './types';
import { HttpError, TimeoutError } from './errors';
import { withRetry } from './aspects/retry';
import { withTimeout } from './aspects/timeout';

/**
 * Cliente HTTP avanzado que actúa como wrapper sobre la API nativa `fetch`.
 *
 * Provee una interfaz limpia y configurable para realizar peticiones HTTP,
 * integrando de forma transparente los aspectos de timeout y reintentos automáticos.
 *
 * @example
 * // Crear una instancia configurada
 * const client = new HttpClient({
 *     baseURL: 'https://api.example.com',
 *     timeout: 5000,
 *     retries: 2,
 * });
 *
 * // Realizar una petición GET tipada
 * const user = await client.get<User>('/users/1');
 */
export class HttpClient {
    private readonly baseURL: string;
    private readonly defaultHeaders: Record<string, string>;
    private readonly defaultTimeout: number;
    private readonly defaultRetries: number;
    private readonly defaultRetryDelay: number;

    /** Interceptores de petición y respuesta configurables por el usuario. */
    public interceptors: Interceptors;

    /**
     * Crea una nueva instancia del cliente HTTP.
     *
     * @param config - Configuración global del cliente. Todos los campos son opcionales.
     */
    constructor(config: ClientConfig = {}) {
        this.baseURL = config.baseURL ? config.baseURL.replace(/\/$/, '') : '';
        this.defaultHeaders = config.headers ?? {};
        this.defaultTimeout = config.timeout ?? 10000;
        this.defaultRetries = config.retries ?? 0;
        this.defaultRetryDelay = config.retryDelay ?? 0;
        this.interceptors = {};
    }

    /**
     * Construye la URL completa combinando la baseURL, el endpoint y los
     * parámetros de query string.
     *
     * @param endpoint - El path del endpoint (ej. `/users/1`).
     * @param params - Parámetros opcionales de query string.
     * @returns La URL completa como string.
     */
    private buildURL(
        endpoint: string,
        params?: Record<string, string | number | boolean>
    ): string {
        const fullPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const urlString = this.baseURL ? `${this.baseURL}${fullPath}` : endpoint;
        const url = new URL(
            urlString,
            typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
        );

        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    url.searchParams.append(key, String(value));
                }
            });
        }

        return url.toString();
    }

    /**
     * Combina las cabeceras por defecto del cliente con las de la petición individual.
     *
     * @param options - Las opciones de la petición actual.
     * @returns Un objeto `RequestOptions` con las cabeceras fusionadas.
     */
    private buildRequestOptions(options: RequestOptions): RequestOptions {
        return {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...this.defaultHeaders,
                ...options.headers,
            },
        };
    }

    /**
     * Ejecuta la llamada real a `fetch` con el signal de cancelación provisto.
     * Aplica el interceptor de respuesta si está definido, parsea el body
     * según el Content-Type y lanza `HttpError` si el status no es 2xx.
     *
     * @template T - Tipo esperado del body de la respuesta.
     * @param url - URL completa de la petición.
     * @param options - Opciones de la petición con cabeceras ya fusionadas.
     * @param signal - `AbortSignal` para cancelar la petición por timeout.
     * @returns El body de la respuesta parseado y tipado como `T`.
     * @throws {HttpError} Si el servidor retorna un status 4xx o 5xx.
     */
    private async executeRequest<T>(
        url: string,
        options: RequestOptions,
        signal: AbortSignal
    ): Promise<T> {
        let response = await fetch(url, { ...options, signal });

        if (this.interceptors.response) {
            response = await this.interceptors.response(response);
        }

        const data = await this.parseResponseBody(response);

        if (!response.ok) {
            throw new HttpError(response, data);
        }

        return data as T;
    }

    /**
     * Parsea el cuerpo de la respuesta HTTP según su `Content-Type`.
     * Intenta parsear como JSON si el tipo es `application/json`, de lo
     * contrario retorna el contenido como texto plano.
     *
     * @param response - El objeto `Response` nativo de fetch.
     * @returns El cuerpo parseado (objeto, array, string, etc.) o `null` si falla.
     */
    private async parseResponseBody(response: Response): Promise<unknown> {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
            return response.json().catch(() => null);
        }
        return response.text().catch(() => null);
    }

    /**
     * Método central de la librería. Realiza una petición HTTP aplicando de forma
     * automática y transparente los aspectos de **timeout** y **reintentos**.
     *
     * El flujo de composición es:
     * `withRetry( () => withTimeout( signal => executeRequest(...), timeout ), retries )`
     *
     * @template T - Tipo esperado del body de la respuesta.
     * @param endpoint - El path del endpoint relativo a la `baseURL`.
     * @param options - Opciones específicas para esta petición.
     * @returns Una promesa que resuelve con el body tipado como `T`.
     * @throws {TimeoutError} Si la petición supera el tiempo máximo de espera.
     * @throws {HttpError} Si el servidor retorna un error HTTP (4xx/5xx) sin reintentos restantes.
     *
     * @example
     * // Uso con async/await
     * const post = await client.request<Post>('/posts/1', { method: 'GET' });
     *
     * // Uso con Promise chaining
     * client.request<Post>('/posts', { method: 'POST', body: JSON.stringify(newPost) })
     *     .then(created => console.log(created))
     *     .catch(err => console.error(err));
     */
    public async request<T = unknown>(
        endpoint: string,
        options: RequestOptions = {}
    ): Promise<T> {
        let url = this.buildURL(endpoint, options.params);
        let requestOptions = this.buildRequestOptions(options);

        if (this.interceptors.request) {
            const intercepted = await this.interceptors.request(url, requestOptions);
            url = intercepted.url;
            requestOptions = intercepted.options;
        }

        const timeoutMs = options.timeout ?? this.defaultTimeout;
        const maxRetries = options.retries ?? this.defaultRetries;
        const retryDelay = options.retryDelay ?? this.defaultRetryDelay;

        return withRetry(
            () => withTimeout(
                (signal) => this.executeRequest<T>(url, requestOptions, signal),
                timeoutMs
            ),
            { maxRetries, retryDelay }
        );
    }

    /**
     * Realiza una petición HTTP GET.
     *
     * @template T - Tipo esperado del body de la respuesta.
     * @param endpoint - El path del endpoint.
     * @param options - Opciones adicionales (headers, params, timeout, etc.). No permite `body`.
     * @returns Una promesa con el body de la respuesta tipado como `T`.
     *
     * @example
     * const users = await client.get<User[]>('/users', { params: { limit: 10 } });
     */
    public get<T = unknown>(
        endpoint: string,
        options?: Omit<RequestOptions, 'body'>
    ): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'GET' });
    }

    /**
     * Realiza una petición HTTP POST.
     *
     * @template T - Tipo esperado del body de la respuesta.
     * @param endpoint - El path del endpoint.
     * @param body - El cuerpo de la petición. Se serializa automáticamente a JSON.
     * @param options - Opciones adicionales de la petición.
     * @returns Una promesa con el body de la respuesta tipado como `T`.
     *
     * @example
     * const newUser = await client.post<User>('/users', { name: 'Alice', age: 30 });
     */
    public post<T = unknown>(
        endpoint: string,
        body?: unknown,
        options?: RequestOptions
    ): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'POST',
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    }

    /**
     * Realiza una petición HTTP PUT para reemplazar un recurso completo.
     *
     * @template T - Tipo esperado del body de la respuesta.
     * @param endpoint - El path del endpoint.
     * @param body - El cuerpo completo del recurso a reemplazar. Se serializa a JSON.
     * @param options - Opciones adicionales de la petición.
     * @returns Una promesa con el body de la respuesta tipado como `T`.
     *
     * @example
     * const updated = await client.put<User>('/users/1', { name: 'Bob', age: 25 });
     */
    public put<T = unknown>(
        endpoint: string,
        body?: unknown,
        options?: RequestOptions
    ): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'PUT',
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    }

    /**
     * Realiza una petición HTTP PATCH para actualizar parcialmente un recurso.
     *
     * @template T - Tipo esperado del body de la respuesta.
     * @param endpoint - El path del endpoint.
     * @param body - Los campos a actualizar en el recurso. Se serializa a JSON.
     * @param options - Opciones adicionales de la petición.
     * @returns Una promesa con el body de la respuesta tipado como `T`.
     *
     * @example
     * // Solo actualiza el nombre, el resto del recurso permanece igual
     * const patched = await client.patch<User>('/users/1', { name: 'Carol' });
     */
    public patch<T = unknown>(
        endpoint: string,
        body?: unknown,
        options?: RequestOptions
    ): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'PATCH',
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    }

    /**
     * Realiza una petición HTTP DELETE para eliminar un recurso.
     *
     * @template T - Tipo esperado del body de la respuesta (si el servidor retorna datos).
     * @param endpoint - El path del endpoint.
     * @param options - Opciones adicionales de la petición. No permite `body`.
     * @returns Una promesa con el body de la respuesta tipado como `T`.
     *
     * @example
     * await client.delete('/users/1');
     */
    public delete<T = unknown>(
        endpoint: string,
        options?: Omit<RequestOptions, 'body'>
    ): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'DELETE' });
    }
}

// Re-exportamos TimeoutError desde aquí para conveniencia del usuario
export { TimeoutError };