/**
 * @fileoverview Aspecto de reintentos automáticos (Retry Aspect).
 *
 * Implementa el patrón de Programación Orientada a Aspectos (AOP) para añadir
 * resiliencia a las peticiones HTTP. Este módulo actúa como un "advice" que
 * envuelve ("advises") la lógica de ejecución principal, añadiendo el
 * comportamiento de reintento como una preocupación transversal (cross-cutting concern)
 * separada de la lógica de negocio.
 *
 * @module aspects/retry
 */

import { HttpError } from '../errors';

/**
 * Configuración del comportamiento de reintentos.
 */
export interface RetryConfig {
    /** Número máximo de reintentos después del primer intento fallido. */
    maxRetries: number;
    /** Tiempo de espera en milisegundos entre cada reintento. Por defecto: 0. */
    retryDelay?: number;
    /**
     * Función personalizada para determinar si un error específico debe provocar
     * un reintento. Por defecto, reintenta en errores 5xx y errores de red.
     *
     * @param error - El error capturado.
     * @returns `true` si se debe reintentar, `false` para propagar el error.
     */
    shouldRetry?: (error: unknown) => boolean;
}

/**
 * Determina si un error justifica un reintento según las reglas por defecto.
 * Se reintenta ante errores del servidor (HTTP 5xx) y errores de red
 * (el `TypeError` que lanza `fetch()` cuando no hay conexión).
 *
 * @param error - El error capturado durante la petición.
 * @returns `true` si la petición debe reintentarse, `false` en caso contrario.
 */
function isRetryableError(error: unknown): boolean {
    if (error instanceof HttpError) {
        return error.status >= 500;
    }
    // fetch() lanza TypeError ante fallos de red (sin conexión, DNS, CORS, etc.)
    if (error instanceof TypeError) {
        return true;
    }
    return false;
}

/**
 * Pausa la ejecución durante un número de milisegundos dado.
 *
 * @param ms - Tiempo de espera en milisegundos.
 * @returns Una promesa que se resuelve tras el tiempo indicado.
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Higher-Order Function (aspecto funcional) que envuelve una función asíncrona
 * y la reintenta automáticamente en caso de un error reintentable.
 *
 * Este es el núcleo del aspecto de reintentos. Aplica el principio AOP de
 * separar la lógica de reintento de la lógica de negocio principal.
 *
 * @template T - El tipo de dato que retorna la promesa.
 * @param fn - La función asíncrona a ejecutar (y potencialmente reintentar).
 * @param config - La configuración del comportamiento de reintentos.
 * @returns Una promesa que resuelve con el resultado o rechaza con el último error.
 *
 * @example
 * // Reintenta hasta 3 veces con 500ms de pausa entre intentos
 * const data = await withRetry(
 *     () => fetchSomeData(),
 *     { maxRetries: 3, retryDelay: 500 }
 * );
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    config: RetryConfig
): Promise<T> {
    const { maxRetries, retryDelay = 0, shouldRetry = isRetryableError } = config;

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            const isLastAttempt = attempt === maxRetries;
            if (isLastAttempt || !shouldRetry(error)) {
                throw error;
            }

            if (retryDelay > 0) {
                await sleep(retryDelay);
            }
        }
    }

    // Punto inalcanzable en runtime; requerido por el compilador de TypeScript.
    throw lastError;
}

/**
 * Decorador de método (aspecto declarativo) que aplica reintentos automáticos
 * al método decorado de forma transparente.
 *
 * Representa la aplicación del patrón AOP en su forma declarativa: el aspecto
 * de reintento se "teje" (weaves) alrededor del método sin modificar su código.
 *
 * @param maxRetries - Número máximo de reintentos tras el primer fallo.
 * @param retryDelay - Tiempo de espera en ms entre reintentos. Por defecto: 0.
 * @returns Un decorador de método compatible con TypeScript.
 *
 * @example
 * class MyService {
 *     \@WithRetry(3, 500)
 *     async fetchData(): Promise<Data> {
 *         // La lógica aquí no cambia; el aspecto se aplica externamente.
 *         return fetch('https://api.example.com/data').then(r => r.json());
 *     }
 * }
 */
export function WithRetry(maxRetries: number, retryDelay: number = 0) {
    return function (
        _target: object,
        _propertyKey: string,
        descriptor: PropertyDescriptor
    ): PropertyDescriptor {
        const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

        descriptor.value = function (...args: unknown[]): Promise<unknown> {
            return withRetry(
                () => originalMethod.apply(this, args) as Promise<unknown>,
                { maxRetries, retryDelay }
            );
        };

        return descriptor;
    };
}
