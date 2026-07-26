/**
 * @fileoverview Pruebas unitarias para el aspecto de reintentos (retry).
 *
 * Verifica el comportamiento de `withRetry` (HOF) y `@WithRetry` (decorador).
 * Son pruebas estrictamente unitarias: no se involucra fetch ni ninguna
 * dependencia de red. Solo se pasan funciones mock a `withRetry`.
 *
 * @group Unit
 */

import { withRetry, WithRetry } from '../src/aspects/retry';
import { HttpError, NetworkError } from '../src/errors';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Crea un HttpError con un status dado, para simular respuestas del servidor.
 */
function createHttpError(status: number): HttpError {
    const mockResponse = {
        ok: false,
        status,
        statusText: status >= 500 ? 'Internal Server Error' : 'Bad Request',
        headers: new Headers(),
        json: jest.fn(),
        text: jest.fn(),
    } as unknown as Response;
    return new HttpError(mockResponse, { error: 'test' });
}

// ─── withRetry ────────────────────────────────────────────────────────────────

describe('withRetry', () => {
    it('debe resolver en el primer intento si la función tiene éxito', async () => {
        const fn = jest.fn().mockResolvedValue('éxito');

        const result = await withRetry(fn, { maxRetries: 3 });

        expect(result).toBe('éxito');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('debe reintentar cuando la función lanza un HttpError 5xx', async () => {
        const error500 = createHttpError(500);
        const fn = jest.fn()
            .mockRejectedValueOnce(error500)
            .mockResolvedValue('recuperado');

        const result = await withRetry(fn, { maxRetries: 1 });

        expect(result).toBe('recuperado');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('debe reintentar cuando la función lanza un TypeError (error de red)', async () => {
        const networkError = new TypeError('Failed to fetch');
        const fn = jest.fn()
            .mockRejectedValueOnce(networkError)
            .mockRejectedValueOnce(networkError)
            .mockResolvedValue('recuperado');

        const result = await withRetry(fn, { maxRetries: 2 });

        expect(result).toBe('recuperado');
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('NO debe reintentar cuando la función lanza un HttpError 4xx', async () => {
        const error404 = createHttpError(404);
        const fn = jest.fn().mockRejectedValue(error404);

        await expect(withRetry(fn, { maxRetries: 3 })).rejects.toThrow(HttpError);
        // Solo se debe haber llamado una vez (sin reintentos)
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('NO debe reintentar cuando la función lanza un HttpError 400', async () => {
        const error400 = createHttpError(400);
        const fn = jest.fn().mockRejectedValue(error400);

        await expect(withRetry(fn, { maxRetries: 5 })).rejects.toThrow(HttpError);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('debe lanzar el último error después de agotar todos los reintentos', async () => {
        const error500 = createHttpError(500);
        const fn = jest.fn().mockRejectedValue(error500);

        await expect(withRetry(fn, { maxRetries: 2 })).rejects.toThrow(HttpError);
        // 1 intento inicial + 2 reintentos = 3 llamadas totales
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('debe llamar a la función exactamente maxRetries+1 veces cuando siempre falla', async () => {
        const fn = jest.fn().mockRejectedValue(createHttpError(503));

        try {
            await withRetry(fn, { maxRetries: 4 });
        } catch {
            // esperado
        }

        expect(fn).toHaveBeenCalledTimes(5);
    });

    it('debe usar una función shouldRetry personalizada', async () => {
        const customError = new Error('Custom retryable error');
        const fn = jest.fn()
            .mockRejectedValueOnce(customError)
            .mockResolvedValue('éxito');

        // Solo reintentar en instancias de Error con este mensaje específico
        const shouldRetry = (err: unknown) =>
            err instanceof Error && err.message === 'Custom retryable error';

        const result = await withRetry(fn, { maxRetries: 1, shouldRetry });

        expect(result).toBe('éxito');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('debe respetar el retryDelay entre reintentos', async () => {
        jest.useFakeTimers();

        const fn = jest.fn()
            .mockRejectedValueOnce(createHttpError(500))
            .mockResolvedValue('éxito');

        const promise = withRetry(fn, { maxRetries: 1, retryDelay: 1000 });

        // Antes de avanzar el tiempo, solo se ha llamado una vez
        expect(fn).toHaveBeenCalledTimes(1);

        // Avanzamos el tiempo para disparar el retryDelay
        await jest.advanceTimersByTimeAsync(1000);

        const result = await promise;
        expect(result).toBe('éxito');
        expect(fn).toHaveBeenCalledTimes(2);

        jest.useRealTimers();
    });

    it('debe funcionar con maxRetries: 0 (sin reintentos)', async () => {
        const fn = jest.fn().mockRejectedValue(createHttpError(500));

        await expect(withRetry(fn, { maxRetries: 0 })).rejects.toThrow(HttpError);
        // Solo el intento inicial, sin reintentos
        expect(fn).toHaveBeenCalledTimes(1);
    });
});

// ─── @WithRetry Decorator ─────────────────────────────────────────────────────

describe('@WithRetry (decorador)', () => {
    it('debe aplicar lógica de reintento al método decorado', async () => {
        const error500 = createHttpError(500);
        const mockFetch = jest.fn()
            .mockRejectedValueOnce(error500)
            .mockResolvedValue('éxito desde decorador');

        class ServicioEjemplo {
            @WithRetry(2)
            async obtenerDatos(): Promise<string> {
                return mockFetch();
            }
        }

        const servicio = new ServicioEjemplo();
        const result = await servicio.obtenerDatos();

        expect(result).toBe('éxito desde decorador');
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('debe lanzar el error si se agotan los reintentos del decorador', async () => {
        const error500 = createHttpError(500);
        const mockFetch = jest.fn().mockRejectedValue(error500);

        class ServicioEjemplo {
            @WithRetry(1)
            async obtenerDatos(): Promise<string> {
                return mockFetch();
            }
        }

        const servicio = new ServicioEjemplo();
        await expect(servicio.obtenerDatos()).rejects.toThrow(HttpError);
        // 1 intento + 1 reintento = 2 llamadas
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });
});
