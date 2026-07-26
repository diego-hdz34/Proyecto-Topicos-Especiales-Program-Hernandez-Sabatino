/**
 * @fileoverview Pruebas unitarias para el aspecto de timeout.
 *
 * Verifica el comportamiento de `withTimeout` (HOF) y `@WithTimeout` (decorador).
 * Son pruebas puramente unitarias: no involucran fetch ni dependencias de red.
 *
 * Para simular timeouts de forma eficiente, se usan funciones que escuchan
 * el AbortSignal (igual que lo hace fetch en producción).
 *
 * @group Unit
 */

import { withTimeout, WithTimeout } from '../src/aspects/timeout';
import { TimeoutError } from '../src/errors';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Crea una promesa que respeta el AbortSignal y se resuelve tras un delay.
 * Simula el comportamiento de fetch ante una cancelación por timeout.
 */
function createAbortableOperation<T>(
    result: T,
    delayMs: number
): (signal: AbortSignal) => Promise<T> {
    return (signal: AbortSignal): Promise<T> => {
        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => resolve(result), delayMs);

            signal.addEventListener('abort', () => {
                clearTimeout(timer);
                const abortError = Object.assign(new Error('The operation was aborted'), {
                    name: 'AbortError',
                });
                reject(abortError);
            });
        });
    };
}

// ─── withTimeout ─────────────────────────────────────────────────────────────

describe('withTimeout', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('debe resolver el valor si la función termina antes del timeout', async () => {
        // La operación tarda 10ms, timeout es 500ms → debe resolver normalmente
        const fastOperation = createAbortableOperation('resultado rápido', 10);

        const result = await withTimeout(fastOperation, 500);

        expect(result).toBe('resultado rápido');
    });

    it('debe lanzar TimeoutError si la función excede el tiempo límite', async () => {
        // La operación nunca resolvería, pero el timeout de 1ms la cancela
        const slowOperation = createAbortableOperation('resultado lento', 10000);

        await expect(withTimeout(slowOperation, 1)).rejects.toBeInstanceOf(TimeoutError);
    });

    it('debe incluir el tiempo límite en el TimeoutError', async () => {
        const slowOperation = createAbortableOperation('resultado', 10000);

        try {
            await withTimeout(slowOperation, 1);
            fail('Debería haber lanzado TimeoutError');
        } catch (error) {
            expect(error).toBeInstanceOf(TimeoutError);
            expect((error as TimeoutError).timeoutMs).toBe(1);
        }
    });

    it('debe proveer un AbortSignal válido a la función', async () => {
        let receivedSignal: AbortSignal | null = null;

        const captureSignal = (signal: AbortSignal): Promise<string> => {
            receivedSignal = signal;
            return Promise.resolve('ok');
        };

        await withTimeout(captureSignal, 1000);

        expect(receivedSignal).not.toBeNull();
        expect(receivedSignal).toBeInstanceOf(AbortSignal);
    });

    it('el AbortSignal debe estar activo (no abortado) durante la ejecución normal', async () => {
        let signalWasAbortedDuringExecution = false;

        const checkSignal = (signal: AbortSignal): Promise<string> => {
            signalWasAbortedDuringExecution = signal.aborted;
            return Promise.resolve('completado');
        };

        await withTimeout(checkSignal, 1000);

        expect(signalWasAbortedDuringExecution).toBe(false);
    });

    it('debe propagar errores distintos a AbortError sin transformarlos', async () => {
        const customError = new Error('Error de lógica de negocio');

        const failingOperation = (_signal: AbortSignal): Promise<never> => {
            return Promise.reject(customError);
        };

        await expect(withTimeout(failingOperation, 1000)).rejects.toBe(customError);
    });

    it('debe limpiar el temporizador después de una resolución exitosa', async () => {
        jest.useFakeTimers();
        const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

        const fastOperation = (_signal: AbortSignal) => Promise.resolve('ok');
        await withTimeout(fastOperation, 5000);

        expect(clearTimeoutSpy).toHaveBeenCalled();

        clearTimeoutSpy.mockRestore();
        jest.useRealTimers();
    });
});

// ─── @WithTimeout Decorator ───────────────────────────────────────────────────

describe('@WithTimeout (decorador)', () => {
    it('debe resolver si el método termina antes del timeout', async () => {
        class ServicioEjemplo {
            @WithTimeout(500)
            async obtenerDatos(): Promise<string> {
                return 'datos rápidos';
            }
        }

        const servicio = new ServicioEjemplo();
        const result = await servicio.obtenerDatos();

        expect(result).toBe('datos rápidos');
    });

    it('debe lanzar TimeoutError si el método excede el tiempo límite', async () => {
        class ServicioLento {
            // Timeout de 1ms: la promesa interna (que resuelve en 1s) nunca gana
            @WithTimeout(1)
            async obtenerDatos(): Promise<string> {
                return new Promise(resolve => setTimeout(() => resolve('tardío'), 1000));
            }
        }

        const servicio = new ServicioLento();

        await expect(servicio.obtenerDatos()).rejects.toBeInstanceOf(TimeoutError);
    });

    it('debe lanzar TimeoutError con el tiempo correcto en la propiedad timeoutMs', async () => {
        const TIMEOUT = 1;

        class ServicioLento {
            @WithTimeout(TIMEOUT)
            async operacion(): Promise<string> {
                return new Promise(resolve => setTimeout(() => resolve('resultado'), 1000));
            }
        }

        const servicio = new ServicioLento();

        try {
            await servicio.operacion();
            throw new Error('Debería haber lanzado TimeoutError');
        } catch (error) {
            expect(error).toBeInstanceOf(TimeoutError);
            expect((error as TimeoutError).timeoutMs).toBe(TIMEOUT);
        }
    });
});
