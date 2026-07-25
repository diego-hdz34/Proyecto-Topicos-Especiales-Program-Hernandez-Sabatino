# Proyecto-Topicos-Especiales-Program-Hernandez-Sabatino

# Custom Fetch Wrapper 🚀

Un wrapper ligero, seguro y altamente configurable sobre la API nativa `fetch` de JavaScript/TypeScript, diseñado para reemplazar la dependencia de librerías de terceros manteniendo 0 dependencias externas.

## ✨ Características

- 🎯 **0 Dependencias externas**: Basado 100% en el estándar `fetch` nativo.
- ⚡ **Tipado estricto**: Soporte completo para TypeScript y genéricos en respuestas.
- 🌐 **BaseURL & Query Params**: Manejo simplificado de endpoints y parámetros de consulta.
- 🛑 **Manejo automático de errores HTTP**: Lanza excepciones (`HttpError`) en estados 4xx/5xx.
- ⏱️ **Timeouts integrados**: Cancelación automática de peticiones colgadas mediante `AbortController`.
- 🔌 **Interceptores**: Modifica peticiones o respuestas globalmente.

## 📦 Instalación

```bash
npm install
npm run build
