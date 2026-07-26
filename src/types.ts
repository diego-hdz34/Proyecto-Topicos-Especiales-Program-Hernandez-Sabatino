/**
 * @fileoverview Definición de tipos e interfaces de SmartFetch.
 * Contiene todos los tipos utilizados por el cliente HTTP y sus aspectos.
 * @module types
 */

/**
 * Opciones de configuración para una petición HTTP individual.
 * Extiende la interfaz nativa `RequestInit` de fetch, sobrescribiendo
 * la propiedad `headers` para un tipado más estricto.
 */
export interface RequestOptions extends Omit<RequestInit, 'headers'> {
    /** Cabeceras HTTP personalizadas para esta petición. */
    headers?: Record<string, string>;
    /**
     * Parámetros de query string que se añadirán a la URL.
     * @example { page: 1, limit: 20 }
     */
    params?: Record<string, string | number | boolean>;
    /** Tiempo máximo de espera en milisegundos antes de cancelar la petición. */
    timeout?: number;
    /**
     * Número de reintentos automáticos en caso de error del servidor (5xx)
     * o error de red. Sobreescribe el valor por defecto del cliente.
     */
    retries?: number;
    /** Tiempo de espera en milisegundos entre cada reintento. */
    retryDelay?: number;
}

/**
 * Configuración global del cliente HTTP `SmartFetch`.
 * Estos valores se aplican a todas las peticiones realizadas por la instancia.
 */
export interface ClientConfig {
    /**
     * URL base que se antepondrá a todos los endpoints.
     * @example 'https://api.example.com/v1'
     */
    baseURL?: string;
    /** Cabeceras HTTP que se enviarán en todas las peticiones. */
    headers?: Record<string, string>;
    /** Tiempo máximo de espera global en milisegundos. Por defecto: 10000ms. */
    timeout?: number;
    /**
     * Número de reintentos automáticos globales ante fallos.
     * Por defecto: 0 (sin reintentos).
     */
    retries?: number;
    /** Tiempo de espera global en milisegundos entre cada reintento. Por defecto: 0. */
    retryDelay?: number;
}

/**
 * Función interceptora que se ejecuta antes de cada petición.
 * Permite modificar la URL o las opciones antes de que se realice el fetch.
 *
 * @param url - La URL completa de la petición.
 * @param options - Las opciones de la petición.
 * @returns La URL y opciones (posiblemente modificadas) envueltas en una promesa o directamente.
 */
export type RequestInterceptor = (
    url: string,
    options: RequestOptions
) => Promise<{ url: string; options: RequestOptions }> | { url: string; options: RequestOptions };

/**
 * Función interceptora que se ejecuta después de recibir la respuesta.
 * Permite inspeccionar o modificar la respuesta antes de que sea procesada.
 *
 * @param response - El objeto `Response` nativo de fetch.
 * @returns La respuesta (posiblemente modificada) envuelta en una promesa o directamente.
 */
export type ResponseInterceptor = (response: Response) => Promise<Response> | Response;

/**
 * Contenedor de los interceptores del cliente HTTP.
 */
export interface Interceptors {
    /** Interceptor que actúa antes de cada petición. */
    request?: RequestInterceptor;
    /** Interceptor que actúa después de cada respuesta. */
    response?: ResponseInterceptor;
}