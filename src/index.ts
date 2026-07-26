/**
 * @fileoverview Punto de entrada principal de la librería SmartFetch.
 *
 * Re-exporta todos los módulos públicos de la librería para que el consumidor
 * pueda importar cualquier elemento desde un único punto: `smartfetch`.
 *
 * @module smartfetch
 *
 * @example
 * // Importar el cliente y los tipos
 * import { HttpClient, HttpError, TimeoutError } from 'smartfetch';
 *
 * // Importar los aspectos para uso standalone
 * import { withRetry, withTimeout, WithRetry, WithTimeout } from 'smartfetch';
 */

// Cliente HTTP principal
export { HttpClient } from './client';

// Clases de error
export { HttpError, TimeoutError, NetworkError } from './errors';

// Aspectos funcionales y decoradores (AOP)
export { withRetry, WithRetry } from './aspects/retry';
export { withTimeout, WithTimeout } from './aspects/timeout';
export type { RetryConfig } from './aspects/retry';

// Tipos e interfaces
export * from './types';