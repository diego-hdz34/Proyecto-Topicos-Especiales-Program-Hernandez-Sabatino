/**
 * @fileoverview Clases de error personalizadas de SmartFetch.
 *
 * Define una jerarquía de errores tipados que permiten al consumidor de la
 * librería distinguir y manejar cada tipo de fallo de forma precisa.
 *
 * @module errors
 */

/**
 * Error lanzado cuando el servidor retorna un estado HTTP de error (4xx o 5xx).
 * Extiende `Error` para ser compatible con bloques `try/catch` estándar,
 * e incluye los detalles completos de la respuesta HTTP.
 *
 * @example
 * try {
 *     await client.get('/protected-resource');
 * } catch (error) {
 *     if (error instanceof HttpError) {
 *         console.log(error.status);    // 401
 *         console.log(error.statusText); // 'Unauthorized'
 *         console.log(error.data);      // Body de la respuesta de error
 *     }
 * }
 */
export class HttpError extends Error {
    /** Código de estado HTTP (ej. 404, 500). */
    public readonly status: number;
    /** Texto descriptivo del estado HTTP (ej. 'Not Found'). */
    public readonly statusText: string;
    /** Cuerpo de la respuesta de error, parseado según el Content-Type. */
    public readonly data: unknown;
    /** El objeto `Response` nativo de fetch para inspección adicional. */
    public readonly response: Response;

    /**
     * @param response - El objeto `Response` de fetch con status de error.
     * @param data - El cuerpo de la respuesta ya parseado.
     */
    constructor(response: Response, data: unknown) {
        super(`HTTP Error ${response.status}: ${response.statusText}`);
        this.name = 'HttpError';
        this.status = response.status;
        this.statusText = response.statusText;
        this.data = data;
        this.response = response;
    }
}

/**
 * Error lanzado cuando una petición supera el tiempo máximo de espera
 * configurado (timeout). La petición es cancelada automáticamente mediante
 * `AbortController` antes de que este error sea lanzado.
 *
 * @example
 * try {
 *     await client.get('/slow-endpoint', { timeout: 2000 });
 * } catch (error) {
 *     if (error instanceof TimeoutError) {
 *         console.log(error.message); // 'La petición excedió el tiempo límite de 2000ms'
 *     }
 * }
 */
export class TimeoutError extends Error {
    /** El tiempo límite en milisegundos que fue superado. */
    public readonly timeoutMs: number;

    /**
     * @param timeoutMs - El tiempo límite en milisegundos que fue superado.
     */
    constructor(timeoutMs: number) {
        super(`La petición excedió el tiempo límite de ${timeoutMs}ms`);
        this.name = 'TimeoutError';
        this.timeoutMs = timeoutMs;
    }
}

/**
 * Error lanzado ante fallos de conectividad de red (sin conexión a internet,
 * error de DNS, CORS, etc.). Wrappea el `TypeError` nativo que lanza `fetch()`
 * ante este tipo de errores, añadiendo contexto.
 *
 * @example
 * try {
 *     await client.get('/endpoint');
 * } catch (error) {
 *     if (error instanceof NetworkError) {
 *         console.log('Sin conexión:', error.message);
 *     }
 * }
 */
export class NetworkError extends Error {
    /** El error original de red lanzado por `fetch()`. */
    public readonly cause: TypeError;

    /**
     * @param cause - El `TypeError` original lanzado por la API nativa `fetch`.
     */
    constructor(cause: TypeError) {
        super(`Error de red: ${cause.message}`);
        this.name = 'NetworkError';
        this.cause = cause;
    }
}