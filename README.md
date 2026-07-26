# SmartFetch

**Un wrapper avanzado, resiliente y tipado sobre la API nativa `fetch` de JavaScript.**

SmartFetch te da la potencia de una librería HTTP de alto nivel (como [axios](https://axios-http.com/)), pero construida 100% sobre el estándar nativo `fetch`, sin dependencias externas en producción y con soporte completo para TypeScript.

[![Tests](https://img.shields.io/badge/tests-62%20passing-brightgreen)](#pruebas)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## Caracteristicas

| Caracteristica | Descripcion |
|---|---|
| **0 dependencias en produccion** | Basado 100% en `fetch` nativo |
| **TypeScript nativo** | Tipado estricto con genericos en todas las respuestas |
| **Timeout automatico** | Cancelacion real via `AbortController` |
| **Reintentos automaticos** | Reintenta en errores 5xx y de red (configurable) |
| **BaseURL + Query Params** | Gestion simplificada de rutas y parametros |
| **Interceptores** | Modifica peticiones y respuestas globalmente |
| **Aspectos AOP** | HOFs `withRetry`/`withTimeout` y decoradores TypeScript |
| **async/await y Promises** | Compatibilidad total con ambos patrones |

---

## Instalacion

### Desde NPM (cuando este publicado)

```bash
npm install smartfetch
```

### Instalacion local para desarrollo

Si deseas clonar el repositorio y usarlo localmente en otro proyecto:

```bash
# 1. Clonar el repositorio
git clone https://github.com/diego-hdz34/Proyecto-Topicos-Especiales-Program-Hernandez-Sabatino.git
cd Proyecto-Topicos-Especiales-Program-Hernandez-Sabatino

# 2. Instalar dependencias y compilar
npm install
npm run build

# 3. Enlazar globalmente (en la carpeta de SmartFetch)
npm link

# 4. En tu proyecto destino
npm link smartfetch
```

### Desde GitHub directamente

```bash
npm install github:diego-hdz34/Proyecto-Topicos-Especiales-Program-Hernandez-Sabatino
```

---

## Inicio Rapido

```typescript
import { HttpClient } from 'smartfetch';

const client = new HttpClient({
    baseURL: 'https://api.ejemplo.com',
    timeout: 5000,
    retries: 2,
});

// Con async/await
const data = await client.get<{ id: number; name: string }>('/users/1');
console.log(data.name);

// Con Promise chaining
client.get('/users')
    .then(users => console.log(users))
    .catch(err => console.error(err));
```

---

## Uso

### Configuracion del Cliente

Crea una instancia de `HttpClient` con tu configuracion global. Todos los parametros son opcionales.

```typescript
import { HttpClient } from 'smartfetch';

const client = new HttpClient({
    baseURL: 'https://api.ejemplo.com/v1', // URL base para todos los endpoints
    timeout: 10000,                         // Timeout en ms (por defecto: 10000)
    retries: 1,                             // Reintentos automaticos (por defecto: 1)
    retryDelay: 500,                        // Espera entre reintentos en ms (por defecto: 0)
    headers: {                              // Cabeceras globales
        'Authorization': 'Bearer tu-token',
        'X-App-Version': '1.0.0',
    },
});
```

| Parametro | Tipo | Por defecto | Descripcion |
|---|---|---|---|
| `baseURL` | `string` | `''` | Prefijo para todos los endpoints |
| `timeout` | `number` | `10000` | Tiempo maximo de espera (ms) |
| `retries` | `number` | `1` | Numero de reintentos ante errores 5xx o de red |
| `retryDelay` | `number` | `0` | Pausa entre reintentos (ms) |
| `headers` | `Record<string, string>` | `{}` | Cabeceras HTTP globales |

---

### Metodos HTTP

Todos los metodos soportan tipado generico `<T>` para la respuesta y son compatibles con `async/await` y Promise chaining.

#### GET

```typescript
// Peticion simple
const post = await client.get<Post>('/posts/1');

// Con query params (genera: /posts?userId=1&_limit=5)
const posts = await client.get<Post[]>('/posts', {
    params: { userId: 1, _limit: 5 },
});

// Con timeout y cabeceras especificas para esta peticion
const data = await client.get<Data>('/data', {
    timeout: 3000,
    headers: { 'X-Custom': 'valor' },
});
```

#### POST

```typescript
interface NuevoPost {
    title: string;
    body: string;
    userId: number;
}

const postCreado = await client.post<Post>('/posts', {
    title: 'Mi primer post',
    body: 'Contenido del post',
    userId: 1,
});

console.log(postCreado.id); // El ID asignado por el servidor
```

#### PUT

```typescript
// Reemplaza el recurso completo
const actualizado = await client.put<Post>('/posts/1', {
    title: 'Titulo completamente nuevo',
    body: 'Cuerpo reemplazado',
    userId: 1,
});
```

#### PATCH

```typescript
// Actualiza solo los campos indicados
const parcial = await client.patch<Post>('/posts/1', {
    title: 'Solo cambia el titulo',
    // Los demas campos permanecen igual
});
```

#### DELETE

```typescript
// Elimina un recurso
await client.delete('/posts/1');

// Con tipo si el servidor retorna datos
const resultado = await client.delete<{ deleted: boolean }>('/posts/1');
```

---

### Timeout — Cancelacion automatica

El timeout cancela la peticion de red realmente a traves de `AbortController`. Puede configurarse globalmente o por peticion.

```typescript
// Global para todas las peticiones del cliente
const client = new HttpClient({
    baseURL: 'https://api.ejemplo.com',
    timeout: 5000, // 5 segundos
});

// Sobreescribir para una peticion especifica
try {
    const data = await client.get('/slow-endpoint', { timeout: 2000 });
} catch (error) {
    if (error instanceof TimeoutError) {
        console.log(`Timeout despues de ${error.timeoutMs}ms`);
    }
}
```

---

### Reintentos Automaticos (Retry)

SmartFetch reintenta automaticamente ante **errores del servidor (5xx)** y **errores de red** (sin conexion, DNS, CORS). Los errores de cliente **4xx** no se reintentan.

```typescript
const client = new HttpClient({
    baseURL: 'https://api.ejemplo.com',
    retries: 3,      // Hasta 3 reintentos
    retryDelay: 1000, // 1 segundo entre intentos
});

// Tambien se puede sobreescribir por peticion
const data = await client.get('/unstable-endpoint', {
    retries: 5,
    retryDelay: 2000,
});
```

| Tipo de error | Se reintenta? |
|---|---|
| Errores de servidor (5xx) | Si |
| Errores de red (`TypeError`) | Si |
| Errores de cliente (4xx) | No |
| `TimeoutError` | No |

---

### Manejo de Errores

SmartFetch provee clases de error tipadas para un manejo preciso.

```typescript
import { HttpClient, HttpError, TimeoutError, NetworkError } from 'smartfetch';

try {
    const data = await client.get('/endpoint');
} catch (error) {
    if (error instanceof HttpError) {
        // Error HTTP del servidor (4xx o 5xx)
        console.log(error.status);     // Codigo de estado (404, 500, etc.)
        console.log(error.statusText); // Texto del estado ('Not Found')
        console.log(error.data);       // Body de la respuesta de error
        console.log(error.response);   // El objeto Response completo
    }

    if (error instanceof TimeoutError) {
        // La peticion excedio el tiempo limite
        console.log(error.timeoutMs);  // El tiempo limite configurado (ms)
        console.log(error.message);    // 'La peticion excedio el tiempo limite de Xms'
    }

    if (error instanceof NetworkError) {
        // Error de conectividad (sin internet, DNS, CORS)
        console.log(error.cause);      // El TypeError original de fetch
    }
}
```

---

### Interceptores

Modifica todas las peticiones o respuestas de forma global y centralizada.

```typescript
const client = new HttpClient({ baseURL: 'https://api.ejemplo.com' });

// Interceptor de PETICION — se ejecuta antes de cada fetch
client.interceptors.request = (url, options) => {
    const token = localStorage.getItem('jwt-token');
    return {
        url,
        options: {
            ...options,
            headers: { ...options.headers, Authorization: `Bearer ${token}` },
        },
    };
};

// Interceptor de RESPUESTA — se ejecuta al recibir cada respuesta
client.interceptors.response = async (response) => {
    if (response.status === 401) {
        console.log('Token expirado, redirigiendo al login...');
        // window.location.href = '/login';
    }
    return response;
};
```

---

### Aspectos AOP — Funciones de Alto Orden (HOF)

Las funciones `withRetry` y `withTimeout` pueden usarse de forma independiente para añadir resiliencia a cualquier funcion asincrona.

#### `withRetry`

```typescript
import { withRetry } from 'smartfetch';

const resultado = await withRetry(
    () => algunaOperacionAsincrona(),
    {
        maxRetries: 3,       // Numero de reintentos
        retryDelay: 500,     // Ms entre reintentos
        shouldRetry: (error) => error instanceof TypeError, // Condicion personalizada
    }
);
```

#### `withTimeout`

```typescript
import { withTimeout } from 'smartfetch';

// La funcion recibe un AbortSignal para cancelacion real a nivel de red
const resultado = await withTimeout(
    (signal) => fetch('https://api.ejemplo.com/data', { signal }),
    5000 // Timeout en ms
);
```

---

### Aspectos AOP — Decoradores TypeScript

Los decoradores aplican el comportamiento de forma declarativa sobre cualquier metodo de clase.

> Asegurate de tener `"experimentalDecorators": true` en tu `tsconfig.json`.

#### `@WithRetry`

```typescript
import { WithRetry } from 'smartfetch';

class MiServicio {
    @WithRetry(3, 500) // maxRetries=3, retryDelay=500ms
    async obtenerDatos(): Promise<Data> {
        const response = await fetch('https://api.ejemplo.com/data');
        return response.json();
    }
}
```

#### `@WithTimeout`

```typescript
import { WithTimeout } from 'smartfetch';

class MiServicio {
    @WithTimeout(3000) // Timeout de 3 segundos
    async operacionLenta(): Promise<Result> {
        return realizarOperacion();
    }
}
```

#### Combinando ambos decoradores

```typescript
class MiServicio {
    @WithRetry(2)
    @WithTimeout(5000)
    async fetchConResiliencia(): Promise<Data> {
        const response = await fetch('https://api.ejemplo.com/data');
        return response.json();
    }
}
```

---

## API de Referencia

### `HttpClient`

```typescript
new HttpClient(config?: ClientConfig)
```

| Metodo | Firma | Descripcion |
|---|---|---|
| `request` | `<T>(endpoint, options?) -> Promise<T>` | Metodo base para todas las peticiones |
| `get` | `<T>(endpoint, options?) -> Promise<T>` | Peticion HTTP GET |
| `post` | `<T>(endpoint, body?, options?) -> Promise<T>` | Peticion HTTP POST |
| `put` | `<T>(endpoint, body?, options?) -> Promise<T>` | Peticion HTTP PUT |
| `patch` | `<T>(endpoint, body?, options?) -> Promise<T>` | Peticion HTTP PATCH |
| `delete` | `<T>(endpoint, options?) -> Promise<T>` | Peticion HTTP DELETE |

### `RequestOptions`

```typescript
interface RequestOptions {
    headers?: Record<string, string>;
    params?: Record<string, string | number | boolean>;
    timeout?: number;
    retries?: number;
    retryDelay?: number;
    // + todas las opciones nativas de RequestInit (method, body, mode, etc.)
}
```

### Funciones AOP

```typescript
// Higher-Order Functions
withRetry<T>(fn: () => Promise<T>, config: RetryConfig): Promise<T>
withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T>

// Decoradores de metodo
@WithRetry(maxRetries: number, retryDelay?: number)
@WithTimeout(timeoutMs: number)
```

---

## Pruebas

```bash
# Ejecutar todas las pruebas
npm test

# Ejecutar con reporte de cobertura
npm run test:coverage

# Ejecutar el archivo de ejemplo
npm run example
```

El proyecto cuenta con **62 pruebas** distribuidas entre pruebas unitarias y de integracion:

| Archivo | Tipo | Descripcion |
|---|---|---|
| `tests/errors.test.ts` | Unitarias | Clases de error (`HttpError`, `TimeoutError`, `NetworkError`) |
| `tests/retry.test.ts` | Unitarias | HOF `withRetry` y decorador `@WithRetry` |
| `tests/timeout.test.ts` | Unitarias | HOF `withTimeout` y decorador `@WithTimeout` |
| `tests/SmartFetch.test.ts` | Integracion | `HttpClient` con `fetch` mockeado |

---

## Arquitectura

El proyecto sigue una arquitectura en capas con Programacion Orientada a Aspectos (AOP):

```
src/
├── index.ts           <- Punto de entrada (re-exports publicos)
├── client.ts          <- HttpClient — patron Facade
├── types.ts           <- Interfaces y tipos compartidos
├── errors.ts          <- Clases de error personalizadas
└── aspects/
    ├── retry.ts       <- Aspecto de reintentos (withRetry + @WithRetry)
    └── timeout.ts     <- Aspecto de timeout (withTimeout + @WithTimeout)
```

**Flujo interno de composicion AOP:**

```
client.get('/endpoint')
    -> withRetry( () =>
        -> withTimeout( signal =>
            -> fetch(url, { signal })
        , timeout )
    , { maxRetries } )
```

---

## Licencia

MIT (c) 2026 — Diego Hernandez & Pedro Sabatino

---

> Desarrollado como proyecto final del curso de **Topicos Especiales de Programacion** — UCAB, 2026.
