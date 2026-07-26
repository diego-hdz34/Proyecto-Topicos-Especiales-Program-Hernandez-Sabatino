/**
 * @fileoverview Pruebas de integración para HttpClient (SmartFetch).
 *
 * Estas son pruebas de INTEGRACIÓN porque el `HttpClient` tiene como dependencia
 * la API nativa `fetch`. Se utiliza `jest.spyOn(global, 'fetch')` para interceptar
 * y controlar las llamadas al fetch real, sin necesidad de conexión a internet.
 *
 * Se verifican:
 * - Los 5 métodos HTTP: GET, POST, PUT, PATCH, DELETE
 * - El comportamiento de timeout
 * - Los reintentos automáticos en errores 5xx
 * - Los interceptores de petición y respuesta
 * - Los parámetros de query string
 * - El uso de baseURL
 * - El soporte tanto para async/await como para Promise chaining
 *
 * @group Integration
 */

import { HttpClient } from '../src/client';
import { HttpError, TimeoutError } from '../src/errors';

// ─── Helpers y setup global ───────────────────────────────────────────────────

/**
 * Crea un objeto Response simulado que imita la estructura del Response nativo.
 */
function createMockResponse(
    status: number,
    body: unknown,
    contentType = 'application/json'
): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK'
            : status === 201 ? 'Created'
            : status === 204 ? 'No Content'
            : status === 404 ? 'Not Found'
            : 'Internal Server Error',
        headers: {
            get: (header: string) =>
                header.toLowerCase() === 'content-type' ? contentType : null,
        },
        json: jest.fn().mockResolvedValue(body),
        text: jest.fn().mockResolvedValue(
            typeof body === 'string' ? body : JSON.stringify(body)
        ),
    } as unknown as Response;
}

// ─── Suite de Integración ─────────────────────────────────────────────────────

describe('HttpClient - Pruebas de Integración', () => {
    let fetchSpy: jest.SpyInstance;

    beforeEach(() => {
        fetchSpy = jest.spyOn(global, 'fetch');
    });

    afterEach(() => {
        fetchSpy.mockRestore();
        jest.clearAllTimers();
    });

    // ─── Método GET ────────────────────────────────────────────────────────────

    describe('GET', () => {
        it('debe realizar una petición GET y retornar los datos parseados', async () => {
            const responseData = { id: 1, nombre: 'Alice' };
            fetchSpy.mockResolvedValueOnce(createMockResponse(200, responseData));

            const client = new HttpClient({ baseURL: 'https://api.example.com' });
            const result = await client.get<typeof responseData>('/users/1');

            expect(result).toEqual(responseData);
            expect(fetchSpy).toHaveBeenCalledTimes(1);
        });

        it('debe llamar a fetch con el método GET', async () => {
            fetchSpy.mockResolvedValueOnce(createMockResponse(200, {}));

            const client = new HttpClient({ baseURL: 'https://api.example.com' });
            await client.get('/users');

            expect(fetchSpy).toHaveBeenCalledWith(
                expect.stringContaining('/users'),
                expect.objectContaining({ method: 'GET' })
            );
        });

        it('debe añadir query params a la URL correctamente', async () => {
            fetchSpy.mockResolvedValueOnce(createMockResponse(200, []));

            const client = new HttpClient({ baseURL: 'https://api.example.com' });
            await client.get('/users', { params: { page: 1, limit: 10 } });

            const calledUrl = fetchSpy.mock.calls[0][0] as string;
            expect(calledUrl).toContain('page=1');
            expect(calledUrl).toContain('limit=10');
        });

        it('debe usar la baseURL como prefijo del endpoint', async () => {
            fetchSpy.mockResolvedValueOnce(createMockResponse(200, {}));

            const client = new HttpClient({ baseURL: 'https://api.example.com' });
            await client.get('/users/1');

            const calledUrl = fetchSpy.mock.calls[0][0] as string;
            expect(calledUrl).toContain('api.example.com');
            expect(calledUrl).toContain('/users/1');
        });
    });

    // ─── Método POST ───────────────────────────────────────────────────────────

    describe('POST', () => {
        it('debe enviar el body serializado como JSON', async () => {
            const nuevoUsuario = { nombre: 'Bob', edad: 25 };
            fetchSpy.mockResolvedValueOnce(createMockResponse(201, { id: 2, ...nuevoUsuario }));

            const client = new HttpClient({ baseURL: 'https://api.example.com' });
            await client.post('/users', nuevoUsuario);

            const fetchOptions = fetchSpy.mock.calls[0][1] as RequestInit;
            expect(fetchOptions.method).toBe('POST');
            expect(fetchOptions.body).toBe(JSON.stringify(nuevoUsuario));
        });

        it('debe retornar el recurso creado', async () => {
            const responseData = { id: 2, nombre: 'Bob' };
            fetchSpy.mockResolvedValueOnce(createMockResponse(201, responseData));

            const client = new HttpClient({ baseURL: 'https://api.example.com' });
            const result = await client.post<typeof responseData>('/users', { nombre: 'Bob' });

            expect(result).toEqual(responseData);
        });
    });

    // ─── Método PUT ────────────────────────────────────────────────────────────

    describe('PUT', () => {
        it('debe enviar el body completo con método PUT', async () => {
            const usuarioCompleto = { id: 1, nombre: 'Alice Actualizada', edad: 31 };
            fetchSpy.mockResolvedValueOnce(createMockResponse(200, usuarioCompleto));

            const client = new HttpClient({ baseURL: 'https://api.example.com' });
            await client.put('/users/1', usuarioCompleto);

            const fetchOptions = fetchSpy.mock.calls[0][1] as RequestInit;
            expect(fetchOptions.method).toBe('PUT');
            expect(fetchOptions.body).toBe(JSON.stringify(usuarioCompleto));
        });
    });

    // ─── Método PATCH ──────────────────────────────────────────────────────────

    describe('PATCH', () => {
        it('debe enviar solo los campos parciales con método PATCH', async () => {
            const camposActualizados = { nombre: 'Alice Modificada' };
            fetchSpy.mockResolvedValueOnce(createMockResponse(200, { id: 1, ...camposActualizados }));

            const client = new HttpClient({ baseURL: 'https://api.example.com' });
            await client.patch('/users/1', camposActualizados);

            const fetchOptions = fetchSpy.mock.calls[0][1] as RequestInit;
            expect(fetchOptions.method).toBe('PATCH');
            expect(fetchOptions.body).toBe(JSON.stringify(camposActualizados));
        });
    });

    // ─── Método DELETE ─────────────────────────────────────────────────────────

    describe('DELETE', () => {
        it('debe llamar a fetch con el método DELETE', async () => {
            fetchSpy.mockResolvedValueOnce(createMockResponse(204, null));

            const client = new HttpClient({ baseURL: 'https://api.example.com' });
            await client.delete('/users/1');

            const fetchOptions = fetchSpy.mock.calls[0][1] as RequestInit;
            expect(fetchOptions.method).toBe('DELETE');
        });
    });

    // ─── Manejo de Errores HTTP ────────────────────────────────────────────────

    describe('Manejo de errores HTTP', () => {
        it('debe lanzar HttpError cuando el servidor retorna 4xx', async () => {
            fetchSpy.mockResolvedValueOnce(
                createMockResponse(404, { error: 'No encontrado' })
            );

            const client = new HttpClient({ baseURL: 'https://api.example.com' });

            await expect(client.get('/users/999')).rejects.toBeInstanceOf(HttpError);
        });

        it('el HttpError debe contener el status HTTP correcto', async () => {
            fetchSpy.mockResolvedValueOnce(
                createMockResponse(403, { error: 'Prohibido' })
            );

            const client = new HttpClient({ baseURL: 'https://api.example.com' });

            try {
                await client.get('/admin');
            } catch (error) {
                expect(error).toBeInstanceOf(HttpError);
                expect((error as HttpError).status).toBe(403);
            }
        });

        it('debe lanzar HttpError en errores 5xx cuando retries es 0', async () => {
            fetchSpy.mockResolvedValueOnce(
                createMockResponse(500, { error: 'Error interno' })
            );

            const client = new HttpClient({
                baseURL: 'https://api.example.com',
                retries: 0,
            });

            await expect(client.get('/data')).rejects.toBeInstanceOf(HttpError);
            expect(fetchSpy).toHaveBeenCalledTimes(1);
        });
    });

    // ─── Reintentos Automáticos ────────────────────────────────────────────────

    describe('Reintentos automáticos (retry)', () => {
        it('debe reintentar en error 5xx y tener éxito en el siguiente intento', async () => {
            fetchSpy
                .mockResolvedValueOnce(createMockResponse(500, { error: 'Error servidor' }))
                .mockResolvedValueOnce(createMockResponse(200, { id: 1 }));

            const client = new HttpClient({
                baseURL: 'https://api.example.com',
                retries: 1,
            });
            const result = await client.get<{ id: number }>('/data');

            expect(result).toEqual({ id: 1 });
            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });

        it('debe lanzar HttpError después de agotar todos los reintentos', async () => {
            fetchSpy.mockResolvedValue(createMockResponse(503, { error: 'Servicio no disponible' }));

            const client = new HttpClient({
                baseURL: 'https://api.example.com',
                retries: 2,
            });

            await expect(client.get('/data')).rejects.toBeInstanceOf(HttpError);
            // 1 intento inicial + 2 reintentos = 3 llamadas
            expect(fetchSpy).toHaveBeenCalledTimes(3);
        });

        it('NO debe reintentar en errores 4xx', async () => {
            fetchSpy.mockResolvedValueOnce(createMockResponse(401, { error: 'No autorizado' }));

            const client = new HttpClient({
                baseURL: 'https://api.example.com',
                retries: 3,
            });

            await expect(client.get('/protected')).rejects.toBeInstanceOf(HttpError);
            // Solo 1 intento, sin reintentos para 4xx
            expect(fetchSpy).toHaveBeenCalledTimes(1);
        });

        it('debe permitir sobreescribir los reintentos por petición', async () => {
            fetchSpy.mockResolvedValue(createMockResponse(500, { error: 'Error' }));

            const client = new HttpClient({
                baseURL: 'https://api.example.com',
                retries: 5, // defecto del cliente
            });

            await expect(
                client.get('/data', { retries: 1 }) // sobreescribir a 1 reintento
            ).rejects.toBeInstanceOf(HttpError);

            // 1 intento + 1 reintento = 2 llamadas (no 6)
            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });
    });

    // ─── Timeout ───────────────────────────────────────────────────────────────

    describe('Timeout', () => {
        it('debe lanzar TimeoutError cuando la petición excede el tiempo límite', async () => {
            // fetch que escucha el AbortSignal, como hace el fetch real
            fetchSpy.mockImplementation((_url: string, init?: RequestInit) => {
                return new Promise((_resolve, reject) => {
                    const signal = init?.signal as AbortSignal;
                    signal?.addEventListener('abort', () => {
                        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
                    });
                });
            });

            const client = new HttpClient({
                baseURL: 'https://api.example.com',
                timeout: 1,
            });

            await expect(client.get('/slow-endpoint')).rejects.toBeInstanceOf(TimeoutError);
        });
    });

    // ─── Interceptores ─────────────────────────────────────────────────────────

    describe('Interceptores', () => {
        it('el interceptor de petición debe poder modificar las cabeceras', async () => {
            fetchSpy.mockResolvedValueOnce(createMockResponse(200, { data: true }));

            const client = new HttpClient({ baseURL: 'https://api.example.com' });

            client.interceptors.request = (url, options) => ({
                url,
                options: {
                    ...options,
                    headers: { ...options.headers, Authorization: 'Bearer token123' },
                },
            });

            await client.get('/secured');

            const fetchOptions = fetchSpy.mock.calls[0][1] as RequestInit;
            const headers = fetchOptions.headers as Record<string, string>;
            expect(headers['Authorization']).toBe('Bearer token123');
        });

        it('el interceptor de respuesta debe poder transformar la respuesta', async () => {
            const originalData = { raw: true };
            fetchSpy.mockResolvedValueOnce(createMockResponse(200, originalData));

            const client = new HttpClient({ baseURL: 'https://api.example.com' });

            // El interceptor modifica la respuesta para retornar datos diferentes
            client.interceptors.response = async (response) => {
                const data = await response.json();
                const modifiedBody = JSON.stringify({ ...data, interceptado: true });
                return {
                    ...response,
                    json: () => Promise.resolve(JSON.parse(modifiedBody)),
                } as Response;
            };

            const result = await client.get<{ raw: boolean; interceptado: boolean }>('/data');

            expect(result.interceptado).toBe(true);
        });
    });

    // ─── Cabeceras por defecto ─────────────────────────────────────────────────

    describe('Cabeceras', () => {
        it('debe enviar Content-Type: application/json por defecto', async () => {
            fetchSpy.mockResolvedValueOnce(createMockResponse(200, {}));

            const client = new HttpClient({ baseURL: 'https://api.example.com' });
            await client.get('/users');

            const fetchOptions = fetchSpy.mock.calls[0][1] as RequestInit;
            const headers = fetchOptions.headers as Record<string, string>;
            expect(headers['Content-Type']).toBe('application/json');
        });

        it('debe fusionar cabeceras personalizadas del cliente con las de la petición', async () => {
            fetchSpy.mockResolvedValueOnce(createMockResponse(200, {}));

            const client = new HttpClient({
                baseURL: 'https://api.example.com',
                headers: { 'X-App-Version': '1.0.0' },
            });

            await client.get('/users', {
                headers: { 'X-Request-ID': 'abc-123' },
            });

            const fetchOptions = fetchSpy.mock.calls[0][1] as RequestInit;
            const headers = fetchOptions.headers as Record<string, string>;
            expect(headers['X-App-Version']).toBe('1.0.0');
            expect(headers['X-Request-ID']).toBe('abc-123');
        });
    });

    // ─── Promise chaining ──────────────────────────────────────────────────────

    describe('Soporte para async/await y Promise chaining', () => {
        it('debe funcionar con .then() y .catch() (Promise chaining)', (done) => {
            const responseData = { id: 1 };
            fetchSpy.mockResolvedValueOnce(createMockResponse(200, responseData));

            const client = new HttpClient({ baseURL: 'https://api.example.com' });

            client.get<typeof responseData>('/users/1')
                .then(result => {
                    expect(result).toEqual(responseData);
                    done();
                })
                .catch(done.fail);
        });

        it('debe llamar a .catch() en caso de error (Promise chaining)', (done) => {
            fetchSpy.mockResolvedValueOnce(createMockResponse(500, { error: 'Error' }));

            const client = new HttpClient({ retries: 0 });

            client.get('/data')
                .then(() => done.fail('Debería haber fallado'))
                .catch(error => {
                    expect(error).toBeInstanceOf(HttpError);
                    done();
                });
        });
    });
});
