export type RemoteSyncNativeRequestMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
export type RemoteSyncNativeResponseType = "base64" | "json" | "text";
export type RemoteSyncNativeRequestBodyEncoding = "base64" | "utf8";

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
  bridge: NativeRemoteSyncRequestBridge | undefined = createNativeRemoteSyncRequestBridge()
): RemoteSyncNativeRequestTransport | undefined {
  if (!bridge?.isAvailable) {
    return undefined;
  }

  return (request) => requestNativeRemoteSyncWithBridge(bridge, request);
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

function createNativeRemoteSyncRequestBridge(): NativeRemoteSyncRequestBridge | undefined {
  const candidate = globalThis as {
    readonly typoraPlus?: {
      readonly remoteSyncRequests?: NativeRemoteSyncRequestBridge;
    };
  };
  const bridge = candidate.typoraPlus?.remoteSyncRequests;

  return bridge?.isAvailable ? bridge : undefined;
}
