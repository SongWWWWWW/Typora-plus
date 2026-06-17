export type RemoteSyncNativeRequestMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
export type RemoteSyncNativeResponseType = "base64" | "json" | "text";
export type RemoteSyncNativeRequestBodyEncoding = "base64" | "utf8";

export interface RemoteSyncNativeMultipartTextPart {
  readonly kind: "text";
  readonly name: string;
  readonly value: string;
}

export interface RemoteSyncNativeMultipartFilePart {
  readonly kind: "file";
  readonly name: string;
  readonly fileName: string;
  readonly value: string;
  readonly encoding: RemoteSyncNativeRequestBodyEncoding;
  readonly contentType?: string;
}

export type RemoteSyncNativeMultipartPart =
  | RemoteSyncNativeMultipartFilePart
  | RemoteSyncNativeMultipartTextPart;

export interface RemoteSyncNativeSecretHeader {
  readonly name: string;
  readonly secretRef: string;
  readonly prefix?: string;
}

export interface RemoteSyncNativeSecretJsonField {
  readonly name: string;
  readonly secretRef: string;
}

export interface RemoteSyncNativeRequest {
  readonly requestId: string;
  readonly url: string;
  readonly method: RemoteSyncNativeRequestMethod;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly bodyEncoding?: RemoteSyncNativeRequestBodyEncoding;
  readonly multipart?: readonly RemoteSyncNativeMultipartPart[];
  readonly responseType?: RemoteSyncNativeResponseType;
  readonly secretHeaders?: readonly RemoteSyncNativeSecretHeader[];
  readonly secretJsonFields?: readonly RemoteSyncNativeSecretJsonField[];
}

export type RemoteSyncNativeRequestInput =
  Omit<RemoteSyncNativeRequest, "requestId"> & {
    readonly signal?: AbortSignal;
  };

export interface RemoteSyncNativeResponse {
  readonly status: number;
  readonly statusText: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: unknown;
}

export interface NativeRemoteSyncRequestBridge {
  readonly isAvailable: boolean;
  request(request: RemoteSyncNativeRequest): Promise<RemoteSyncNativeResponse>;
  cancel?(requestId: string): void;
}

export type RemoteSyncNativeRequestTransport =
  (request: RemoteSyncNativeRequestInput) => Promise<RemoteSyncNativeResponse>;

let nextNativeRemoteSyncRequestId = 0;

export function createNativeRemoteSyncRequestTransport(
  bridge?: NativeRemoteSyncRequestBridge
): RemoteSyncNativeRequestTransport | undefined {
  const resolvedBridge = arguments.length === 0 ? createNativeRemoteSyncRequestBridge() : bridge;

  if (resolvedBridge?.isAvailable) {
    return (request) => requestNativeRemoteSyncWithBridge(resolvedBridge, request);
  }

  return arguments.length === 0 ? createBrowserRemoteSyncRequestTransport() : undefined;
}

function createBrowserRemoteSyncRequestTransport(): RemoteSyncNativeRequestTransport | undefined {
  if (typeof fetch !== "function") {
    return undefined;
  }

  return requestNativeRemoteSyncWithFetch;
}

async function requestNativeRemoteSyncWithFetch(
  request: RemoteSyncNativeRequestInput
): Promise<RemoteSyncNativeResponse> {
  if (request.signal?.aborted) {
    throw new Error("Remote sync native request was aborted");
  }

  if (request.secretHeaders || request.secretJsonFields) {
    throw new Error("Remote sync browser request cannot resolve secret bindings");
  }

  if (request.multipart) {
    throw new Error("Remote sync browser request cannot send multipart bodies");
  }

  const response = await fetch(request.url, {
    method: request.method,
    ...(request.headers !== undefined ? { headers: request.headers } : {}),
    ...(request.body !== undefined ? { body: createBrowserRequestBody(request.body, request.bodyEncoding) } : {}),
    ...(request.signal !== undefined ? { signal: request.signal } : {})
  });

  return {
    status: response.status,
    statusText: response.statusText,
    headers: readBrowserResponseHeaders(response.headers),
    body: await readBrowserResponseBody(response, request.responseType ?? "text")
  };
}

async function requestNativeRemoteSyncWithBridge(
  bridge: NativeRemoteSyncRequestBridge,
  request: RemoteSyncNativeRequestInput
): Promise<RemoteSyncNativeResponse> {
  if (request.signal?.aborted) {
    throw new Error("Remote sync native request was aborted");
  }

  const requestId = createNativeRemoteSyncRequestId();
  const abortListener = request.signal && bridge.cancel
    ? () => {
        try {
          bridge.cancel?.(requestId);
        } catch {
          // Cancellation is best-effort; the request promise remains authoritative.
        }
      }
    : undefined;

  if (abortListener) {
    request.signal?.addEventListener("abort", abortListener, { once: true });
  }

  try {
    return await bridge.request({
      requestId,
      url: request.url,
      method: request.method,
      ...(request.headers !== undefined ? { headers: request.headers } : {}),
      ...(request.body !== undefined ? { body: request.body } : {}),
      ...(request.bodyEncoding !== undefined ? { bodyEncoding: request.bodyEncoding } : {}),
      ...(request.multipart !== undefined ? { multipart: request.multipart } : {}),
      ...(request.responseType !== undefined ? { responseType: request.responseType } : {}),
      ...(request.secretHeaders !== undefined ? { secretHeaders: request.secretHeaders } : {}),
      ...(request.secretJsonFields !== undefined ? { secretJsonFields: request.secretJsonFields } : {})
    });
  } finally {
    if (abortListener) {
      request.signal?.removeEventListener("abort", abortListener);
    }
  }
}

function createNativeRemoteSyncRequestId(): string {
  nextNativeRemoteSyncRequestId += 1;
  return `remote-sync:${nextNativeRemoteSyncRequestId}`;
}

function createBrowserRequestBody(
  body: string,
  encoding: RemoteSyncNativeRequestBodyEncoding | undefined
): BodyInit {
  if (encoding === "base64") {
    return new Blob([copyBytesToArrayBuffer(decodeBase64Body(body))]);
  }

  return body;
}

function decodeBase64Body(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function copyBytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function readBrowserResponseBody(
  response: Response,
  responseType: RemoteSyncNativeResponseType
): Promise<unknown> {
  if (responseType === "json") {
    return response.json();
  }

  if (responseType === "base64") {
    return encodeBase64Body(new Uint8Array(await response.arrayBuffer()));
  }

  return response.text();
}

function encodeBase64Body(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function readBrowserResponseHeaders(headers: Headers): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function createNativeRemoteSyncRequestBridge(): NativeRemoteSyncRequestBridge | undefined {
  const candidate = globalThis as {
    readonly typoraPlus?: {
      readonly remoteSyncRequests?: NativeRemoteSyncRequestBridge;
    };
  };
  const bridge = candidate.typoraPlus?.remoteSyncRequests;

  return bridge?.isAvailable ? bridge : undefined;
}
