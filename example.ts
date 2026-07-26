/**
 * @fileoverview SmartFetch - Archivo de ejemplo de uso completo.
 *
 * Este archivo demuestra todas las funcionalidades principales de la librería
 * SmartFetch usando la API pública JSONPlaceholder (https://jsonplaceholder.typicode.com)
 * como servidor de pruebas real.
 *
 * Para ejecutar este archivo:
 *   npx ts-node example.ts
 *
 * @module example
 */

import {
    HttpClient,
    HttpError,
    TimeoutError,
    withRetry,
    withTimeout,
    WithRetry,
    WithTimeout,
} from './src/index';

// ─── Tipos de datos de la API de ejemplo ──────────────────────────────────────

interface Post {
    id: number;
    title: string;
    body: string;
    userId: number;
}

interface User {
    id: number;
    name: string;
    email: string;
}

// ─── Separador visual para la consola ─────────────────────────────────────────

function separator(titulo: string): void {
    console.log('\n' + '═'.repeat(60));
    console.log(`  ${titulo}`);
    console.log('═'.repeat(60));
}

// =============================================================================
// 1. CONFIGURACIÓN DEL CLIENTE
// =============================================================================

separator('1. Configuración del Cliente');

/**
 * Se crea una instancia del cliente HTTP con configuración global.
 * Todos los parámetros son opcionales.
 */
const client = new HttpClient({
    baseURL: 'https://jsonplaceholder.typicode.com',
    timeout: 8000,   // 8 segundos de timeout global
    retries: 2,      // 2 reintentos automáticos en errores 5xx o de red
    retryDelay: 500, // 500ms de espera entre reintentos
    headers: {
        'X-App-Name': 'SmartFetch-Example',
    },
});

console.log(' Cliente creado con baseURL, timeout=8s, retries=2');

// =============================================================================
// 2. MÉTODO GET — async/await
// =============================================================================

async function ejemploGet(): Promise<void> {
    separator('2. GET con async/await');

    // Obtener un recurso individual
    const post = await client.get<Post>('/posts/1');
    console.log(' Post obtenido:', post);

    // Obtener una lista con query params
    const posts = await client.get<Post[]>('/posts', {
        params: { userId: 1, _limit: 3 },
    });
    console.log(` Posts del usuario 1 (limitado a 3): ${posts.length} resultados`);
    posts.forEach(p => console.log(`   - [${p.id}] ${p.title}`));
}

// =============================================================================
// 3. MÉTODO GET — Promise chaining (entonces/catch)
// =============================================================================

function ejemploGetPromiseChaining(): Promise<void> {
    separator('3. GET con Promise chaining');

    return client.get<User>('/users/1')
        .then(user => {
            console.log(` Usuario encontrado: ${user.name} (${user.email})`);
        })
        .catch(error => {
            console.error(' Error al obtener usuario:', error);
        });
}

// =============================================================================
// 4. MÉTODO POST — Crear recurso
// =============================================================================

async function ejemploPost(): Promise<void> {
    separator('4. POST — Crear nuevo post');

    const nuevoPost = {
        title: 'SmartFetch en acción',
        body: 'Este post fue creado usando SmartFetch, el wrapper avanzado sobre fetch.',
        userId: 1,
    };

    const postCreado = await client.post<Post>('/posts', nuevoPost);
    console.log(' Post creado con ID:', postCreado.id);
    console.log('   Título:', postCreado.title);
}

// =============================================================================
// 5. MÉTODO PUT — Reemplazar recurso completo
// =============================================================================

async function ejemploPut(): Promise<void> {
    separator('5. PUT — Reemplazar post completo');

    const postCompleto: Omit<Post, 'id'> = {
        title: 'Título completamente nuevo',
        body: 'Cuerpo reemplazado completamente con PUT.',
        userId: 1,
    };

    const postActualizado = await client.put<Post>('/posts/1', postCompleto);
    console.log(' Post reemplazado. Nuevo título:', postActualizado.title);
}

// =============================================================================
// 6. MÉTODO PATCH — Actualización parcial
// =============================================================================

async function ejemploPatch(): Promise<void> {
    separator('6. PATCH — Actualización parcial del post');

    // Solo actualizamos el título, el resto del recurso no cambia
    const camposActualizados = { title: 'Título parcialmente actualizado con PATCH' };

    const postParcial = await client.patch<Post>('/posts/1', camposActualizados);
    console.log(' Título actualizado parcialmente:', postParcial.title);
}

// =============================================================================
// 7. MÉTODO DELETE — Eliminar recurso
// =============================================================================

async function ejemploDelete(): Promise<void> {
    separator('7. DELETE — Eliminar post');

    await client.delete('/posts/1');
    console.log(' Post eliminado correctamente (204 No Content)');
}

// =============================================================================
// 8. MANEJO DE ERRORES HTTP
// =============================================================================

async function ejemploErroresHTTP(): Promise<void> {
    separator('8. Manejo de Errores HTTP');

    try {
        // Este endpoint no existe, retornará 404
        await client.get('/posts/99999');
    } catch (error) {
        if (error instanceof HttpError) {
            console.log(` HttpError capturado:`);
            console.log(`   Status: ${error.status} ${error.statusText}`);
            console.log(`   Mensaje: ${error.message}`);
        }
    }
}

// =============================================================================
// 9. TIMEOUT — Cancelación automática
// =============================================================================

async function ejemploTimeout(): Promise<void> {
    separator('9. Timeout — Cancelación automática');

    // Creamos un cliente con timeout extremadamente corto (1ms) para forzar el timeout
    const clienteRapido = new HttpClient({
        baseURL: 'https://jsonplaceholder.typicode.com',
        timeout: 1,   // 1ms — imposible de cumplir
        retries: 0,
    });

    try {
        await clienteRapido.get('/posts/1');
    } catch (error) {
        if (error instanceof TimeoutError) {
            console.log(`⏱️  TimeoutError capturado:`);
            console.log(`   Mensaje: ${error.message}`);
            console.log(`   Tiempo límite: ${error.timeoutMs}ms`);
        }
    }
}

// =============================================================================
// 10. INTERCEPTORES
// =============================================================================

async function ejemploInterceptores(): Promise<void> {
    separator('10. Interceptores de Petición y Respuesta');

    const clienteConInterceptores = new HttpClient({
        baseURL: 'https://jsonplaceholder.typicode.com',
    });

    // Interceptor de PETICIÓN — añade un token de autorización a todas las requests
    clienteConInterceptores.interceptors.request = (url, options) => {
        console.log(` [Interceptor Req] Añadiendo Authorization a: ${url}`);
        return {
            url,
            options: {
                ...options,
                headers: { ...options.headers, Authorization: 'Bearer mi-token-jwt' },
            },
        };
    };

    // Interceptor de RESPUESTA — registra cada respuesta recibida
    clienteConInterceptores.interceptors.response = (response) => {
        console.log(` [Interceptor Res] Status recibido: ${response.status}`);
        return response;
    };

    await clienteConInterceptores.get('/posts/1');
    console.log(' Petición completada con interceptores activos');
}

// =============================================================================
// 11. AOP — withRetry como Higher-Order Function
// =============================================================================

async function ejemploWithRetry(): Promise<void> {
    separator('11. AOP — withRetry (Higher-Order Function)');

    let intentos = 0;

    /**
     * Función que simula un servicio inestable:
     * falla las primeras 2 veces y tiene éxito en la tercera.
     */
    const servicioInestable = async (): Promise<string> => {
        intentos++;
        if (intentos < 3) {
            console.log(`    Intento ${intentos}: simulando error de red...`);
            throw new TypeError('Failed to fetch — error de red simulado');
        }
        console.log(`    Intento ${intentos}: éxito`);
        return 'Datos obtenidos correctamente';
    };

    const resultado = await withRetry(servicioInestable, {
        maxRetries: 3,
        retryDelay: 100,
    });

    console.log('Resultado final:', resultado);
}

// =============================================================================
// 12. AOP — withTimeout como Higher-Order Function
// =============================================================================

async function ejemploWithTimeout(): Promise<void> {
    separator('12. AOP — withTimeout (Higher-Order Function)');

    // Operación rápida que sí cumple el timeout
    const operacionRapida = (_signal: AbortSignal): Promise<string> =>
        Promise.resolve('Completado antes del timeout');

    const resultado = await withTimeout(operacionRapida, 5000);
    console.log(' withTimeout resolvió a tiempo:', resultado);
}

// =============================================================================
// 13. AOP — Decoradores @WithRetry y @WithTimeout
// =============================================================================

function ejemploDecoradores(): void {
    separator('13. AOP — Decoradores @WithRetry y @WithTimeout');

    /**
     * Servicio de ejemplo que usa los decoradores AOP de SmartFetch.
     * Los decoradores aplican reintento y timeout de forma declarativa,
     * sin modificar la lógica del método.
     */
    class ServicioUsuarios {
        private intentos = 0;

        /**
         * Método con reintentos automáticos aplicados por el decorador @WithRetry.
         * Si falla (con error reintentable), se reintentará hasta 2 veces.
         */
        @WithRetry(2, 100)
        async obtenerUsuario(): Promise<User> {
            this.intentos++;
            if (this.intentos === 1) {
                throw new TypeError('Error de red simulado para el decorador');
            }
            return { id: 1, name: 'Alice', email: 'alice@example.com' };
        }

        /**
         * Método con timeout automático aplicado por el decorador @WithTimeout.
         */
        @WithTimeout(5000)
        async obtenerPosts(): Promise<string> {
            return 'Posts obtenidos correctamente';
        }
    }

    const servicio = new ServicioUsuarios();

    servicio.obtenerUsuario()
        .then(user => console.log(' @WithRetry — Usuario obtenido:', user.name))
        .catch(err => console.error(' Error:', err));

    servicio.obtenerPosts()
        .then(result => console.log('@WithTimeout — Resultado:', result))
        .catch(err => console.error('Timeout:', err));
}

// =============================================================================
// EJECUCIÓN PRINCIPAL
// =============================================================================

async function main(): Promise<void> {
    console.log('\n SmartFetch — Demostración completa de funcionalidades');
    console.log('   Usando JSONPlaceholder como API de prueba');

    try {
        await ejemploGet();
        await ejemploGetPromiseChaining();
        await ejemploPost();
        await ejemploPut();
        await ejemploPatch();
        await ejemploDelete();
        await ejemploErroresHTTP();
        await ejemploTimeout();
        await ejemploInterceptores();
        await ejemploWithRetry();
        await ejemploWithTimeout();
        ejemploDecoradores();

        separator('Demostración completada exitosamente');
    } catch (error) {
        console.error('\n Error inesperado en la demostración:', error);
    }
}

main();
