export class HttpError extends Error {
    public status: number;
    public statusText: string;
    public data: any;
    public response: Response;

    constructor(response: Response, data: any) {
        super(`HTTP Error ${response.status}: ${response.statusText}`);
        this.name = 'HttpError';
        this.status = response.status;
        this.statusText = response.statusText;
        this.data = data;
        this.response = response;
    }
}

export class TimeoutError extends Error {
    constructor(timeoutMs: number) {
        super(`La petición excedió el tiempo límite de ${timeoutMs}ms`);
        this.name = 'TimeoutError';
    }
}