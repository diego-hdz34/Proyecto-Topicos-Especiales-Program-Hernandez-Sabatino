/**
 * @fileoverview Pruebas unitarias para las clases de error de SmartFetch.
 *
 * Estas pruebas son puramente unitarias ya que las clases de error no tienen
 * ninguna dependencia externa: solo extienden la clase `Error` nativa.
 *
 * @group Unit
 */

import { HttpError, TimeoutError, NetworkError } from '../src/errors';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Crea un objeto Response simulado para usar en las pruebas de HttpError.
 */
function createMockResponse(status: number, statusText: string): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText,
        headers: new Headers(),
        json: jest.fn(),
        text: jest.fn(),
    } as unknown as Response;
}

// ─── HttpError ────────────────────────────────────────────────────────────────

describe('HttpError', () => {
    const mockResponse = createMockResponse(404, 'Not Found');
    const mockData = { error: 'El recurso no existe' };
    let error: HttpError;

    beforeEach(() => {
        error = new HttpError(mockResponse, mockData);
    });

    it('debe ser instancia de Error', () => {
        expect(error).toBeInstanceOf(Error);
    });

    it('debe tener el nombre "HttpError"', () => {
        expect(error.name).toBe('HttpError');
    });

    it('debe formatear el mensaje con el status y statusText', () => {
        expect(error.message).toBe('HTTP Error 404: Not Found');
    });

    it('debe almacenar el status HTTP correctamente', () => {
        expect(error.status).toBe(404);
    });

    it('debe almacenar el statusText correctamente', () => {
        expect(error.statusText).toBe('Not Found');
    });

    it('debe almacenar el body de la respuesta de error', () => {
        expect(error.data).toEqual(mockData);
    });

    it('debe almacenar el objeto Response original', () => {
        expect(error.response).toBe(mockResponse);
    });

    it('debe funcionar con errores 5xx (servidor)', () => {
        const serverError = new HttpError(
            createMockResponse(500, 'Internal Server Error'),
            null
        );
        expect(serverError.status).toBe(500);
        expect(serverError.message).toBe('HTTP Error 500: Internal Server Error');
    });
});

// ─── TimeoutError ─────────────────────────────────────────────────────────────

describe('TimeoutError', () => {
    const TIMEOUT_MS = 5000;
    let error: TimeoutError;

    beforeEach(() => {
        error = new TimeoutError(TIMEOUT_MS);
    });

    it('debe ser instancia de Error', () => {
        expect(error).toBeInstanceOf(Error);
    });

    it('debe tener el nombre "TimeoutError"', () => {
        expect(error.name).toBe('TimeoutError');
    });

    it('debe incluir el tiempo límite en el mensaje', () => {
        expect(error.message).toContain('5000ms');
    });

    it('debe almacenar el tiempo límite en la propiedad timeoutMs', () => {
        expect(error.timeoutMs).toBe(TIMEOUT_MS);
    });

    it('debe reflejar tiempos límite distintos en el mensaje', () => {
        const error2000 = new TimeoutError(2000);
        expect(error2000.message).toContain('2000ms');
        expect(error2000.timeoutMs).toBe(2000);
    });
});

// ─── NetworkError ─────────────────────────────────────────────────────────────

describe('NetworkError', () => {
    const originalError = new TypeError('Failed to fetch');
    let error: NetworkError;

    beforeEach(() => {
        error = new NetworkError(originalError);
    });

    it('debe ser instancia de Error', () => {
        expect(error).toBeInstanceOf(Error);
    });

    it('debe tener el nombre "NetworkError"', () => {
        expect(error.name).toBe('NetworkError');
    });

    it('debe incluir el mensaje del error original', () => {
        expect(error.message).toContain('Failed to fetch');
    });

    it('debe almacenar el TypeError original en la propiedad cause', () => {
        expect(error.cause).toBe(originalError);
        expect(error.cause).toBeInstanceOf(TypeError);
    });
});
