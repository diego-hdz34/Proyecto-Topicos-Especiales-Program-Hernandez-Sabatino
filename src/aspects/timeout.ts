/**
 * @fileoverview Aspecto de timeout automático (Timeout Aspect).
 *
 * Implementa el patrón de Programación Orientada a Aspectos (AOP) para la
 * cancelación automática de peticiones que exceden un tiempo máximo de espera.
 *
 * Provee dos formas de aplicar el aspecto:
 * 1. `withTimeout`: HOF (Higher-Order Function) para uso funcional. Utiliza
 *    `AbortController` para una cancelación real a nivel de red.
 * 2. `@WithTimeout`: Decorador de método para uso declarativo vía `Promise.race`.
 *
 * @module aspects/timeout
 */

import { TimeoutError } from '../errors';

/**
 * Higher-Order Function (aspecto funcional) que envuelve una función asíncrona
 * y la cancela automáticamente si excede el tiempo límite especificado.
 *
 * Provee un `AbortSignal` a la función receptora, lo que permite que `fetch()`
 * cancele la petición real a nivel de red (no solo ignorar la respuesta).
 *
 * @template T - El tipo de dato que retorna la promesa.
 * @param fn - Una función que acepta un `AbortSignal` y retorna una promesa.
 *             La función debe pasar este signal a `fetch()` para que la
 *             cancelación sea efectiva a nivel de red.
 * @param timeoutMs - El tiempo máximo de espera en milisegundos.
 * @returns Una promesa que resuelve con el resultado de `fn` o rechaza con `TimeoutError`.
 *
 * @example
 * const data = await withTimeout(
 *     (signal) => fetch('https://api.example.com/data', { signal }).then(r => r.json()),
 *     5000
 * );
 */
export async function withTimeout<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number
): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fn(controller.signal);
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new TimeoutError(timeoutMs);
        }
        throw error;
    } finally {
        // Siempre limpiamos el temporizador para evitar fugas de memoria.
        clearTimeout(timeoutId);
    }
}

/**
 * Decorador de método (aspecto declarativo) que aplica un tiempo límite de espera
 * al método decorado mediante `Promise.race`.
 *
 * Útil para añadir timeouts a métodos de servicio de forma declarativa, sin
 * necesidad de modificar la lógica interna del método. A diferencia de `withTimeout`,
 * este decorador no cancela la petición subyacente a nivel de red, ya que no
 * tiene acceso al `AbortController` interno del método.
 *
 * @param timeoutMs - El tiempo máximo de espera en milisegundos.
 * @returns Un decorador de método compatible con TypeScript.
 *
 * @example
 * class MyService {
 *     \@WithTimeout(3000)
 *     async fetchData(): Promise<Data> {
 *         // Si esto tarda más de 3s, se rechaza con TimeoutError
 *         return someSlowOperation();
 *     }
 * }
 */
export function WithTimeout(timeoutMs: number) {
    return function (
        _target: object,
        _propertyKey: string,
        descriptor: PropertyDescriptor
    ): PropertyDescriptor {
        const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

        descriptor.value = function (...args: unknown[]): Promise<unknown> {
            const methodPromise = originalMethod.apply(this, args) as Promise<unknown>;
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new TimeoutError(timeoutMs)), timeoutMs);
            });
            return Promise.race([methodPromise, timeoutPromise]);
        };

        return descriptor;
    };
}
