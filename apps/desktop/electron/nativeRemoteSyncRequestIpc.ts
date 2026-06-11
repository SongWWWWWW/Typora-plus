import { ipcMain } from "electron";
import {
  normalizeNativeSecretRef,
  readNativeSecret,
  type NativeSecretStoreConfig
} from "./nativeSecretStore.js";

export const nativeRemoteSyncRequestIpcChannels = {
  cancel: "typora-plus:remote-sync:request:cancel",
  request: "typora-plus:remote-sync:request"
} as const;

export type NativeRemoteSyncRequestMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
export type NativeRemoteSyncResponseType = "base64" | "json" | "text";
export type NativeRemoteSyncRequestBodyEncoding = "base64" | "utf8";

type SerializedNativeRemoteSyncMultipartPart =
  | SerializedNativeRemoteSyncMultipartFilePart
  | SerializedNativeRemoteSyncMultipartTextPart;

interface SerializedNativeRemoteSyncMultipartTextPart {
  readonly kind: "text";
  readonly name: string;
  readonly value: string;
}

interface SerializedNativeRemoteSyncMultipartFilePart {
  readonly kind: "file";
  readonly name: string;
  readonly fileName: string;
  readonly value: string;
  readonly encoding: NativeRemoteSyncRequestBodyEncoding;
  readonly contentType?: string;
}

export interface NativeRemoteSyncRequestConfig extends NativeSecretStoreConfig {
  readonly maxHeaderCount: number;
  readonly maxHeaderValueBytes: number;
  readonly maxRequestBytes: number;
  readonly maxResponseBytes: number;
  readonly maxSecretBindings: number;
  readonly requestTimeoutMs: number;
}

interface SerializedNativeRemoteSyncRequest {
  readonly requestId: string;
  readonly url: string;
  readonly method: NativeRemoteSyncRequestMethod;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly bodyEncoding?: NativeRemoteSyncRequestBodyEncoding;
  readonly multipart?: readonly SerializedNativeRemoteSyncMultipartPart[];
  readonly responseType?: NativeRemoteSyncResponseType;
  readonly secretHeaders?: readonly SerializedNativeRemoteSyncSecretHeader[];
  readonly secretJsonFields?: readonly SerializedNativeRemoteSyncSecretJsonField[];
}

interface SerializedNativeRemoteSyncSecretHeader {
  readonly name: string;
  readonly secretRef: string;
  readonly prefix?: string;
}

interface SerializedNativeRemoteSyncSecretJsonField {
  readonly name: string;
  readonly secretRef: string;
}

interface NativeRemoteSyncFetchRequest {
  readonly requestId: string;
  readonly url: string;
  readonly method: NativeRemoteSyncRequestMethod;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: BodyInit;
  readonly responseType: NativeRemoteSyncResponseType;
}

interface NativeRemoteSyncResponsePayload {
  readonly status: number;
  readonly statusText: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: unknown;
}

const activeRemoteSyncRequests = new Map<string, AbortController>();
const nativeRemoteSyncRequestSecretLabel = "Remote sync";
const nativeRemoteSyncMultipartLimits = {
  maxParts: 64,
  maxPartNameLength: 128,
  maxFileNameLength: 255,
  maxContentTypeLength: 128
} as const;

export function registerNativeRemoteSyncRequestIpc(config: NativeRemoteSyncRequestConfig): void {
  ipcMain.handle(nativeRemoteSyncRequestIpcChannels.request, async (event, request: SerializedNativeRemoteSyncRequest) =>
    requestNativeRemoteSync(config, event.sender.id, request)
  );

  ipcMain.on(nativeRemoteSyncRequestIpcChannels.cancel, (event, requestId: unknown) => {
    cancelNativeRemoteSyncRequest(event.sender.id, requestId);
  });
}

async function requestNativeRemoteSync(
  config: NativeRemoteSyncRequestConfig,
  webContentsId: number,
  request: unknown
): Promise<NativeRemoteSyncResponsePayload> {
  const normalizedRequest = normalizeRemoteSyncRequest(config, request);
  const controller = new AbortController();
  const requestKey = createRemoteSyncRequestKey(webContentsId, normalizedRequest.requestId);

  if (activeRemoteSyncRequests.has(requestKey)) {
    throw new Error("Remote sync request id is already active");
  }

  activeRemoteSyncRequests.set(requestKey, controller);
  const timeout = config.requestTimeoutMs > 0
    ? setTimeout(() => controller.abort(), config.requestTimeoutMs)
    : undefined;

  try {
    const response = await fetch(normalizedRequest.url, {
      method: normalizedRequest.method,
      headers: normalizedRequest.headers,
      ...(normalizedRequest.body !== undefined ? { body: normalizedRequest.body } : {}),
      signal: controller.signal
    });

    return readRemoteSyncResponse(config, normalizedRequest.responseType, response);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
    activeRemoteSyncRequests.delete(requestKey);
  }
}

function cancelNativeRemoteSyncRequest(webContentsId: number, requestId: unknown): void {
  const normalizedRequestId = readOptionalRequestId(requestId);

  if (!normalizedRequestId) {
    return;
  }

  activeRemoteSyncRequests.get(createRemoteSyncRequestKey(webContentsId, normalizedRequestId))?.abort();
}

function createRemoteSyncRequestKey(webContentsId: number, requestId: string): string {
  return `${webContentsId}:${requestId}`;
}

function normalizeRemoteSyncRequest(
  config: NativeRemoteSyncRequestConfig,
  value: unknown
): NativeRemoteSyncFetchRequest {
  if (!isRecord(value)) {
    throw new Error("Remote sync request must be an object");
  }

  const responseType = normalizeResponseType(value.responseType);
  const secretHeaders = normalizeSecretHeaders(config, value.secretHeaders);
  const secretJsonFields = normalizeSecretJsonFields(config, value.secretJsonFields);

  if (secretHeaders.length + secretJsonFields.length > config.maxSecretBindings) {
    throw new Error("Remote sync request has too many secret bindings");
  }

  const multipart = normalizeMultipartParts(config, value.multipart);

  if (multipart !== undefined && value.bodyEncoding !== undefined) {
    throw new Error("Remote sync multipart requests must not set bodyEncoding");
  }

  const bodyEncoding = normalizeBodyEncoding(value.bodyEncoding);
  const body = normalizeRequestBody(config, value.body, bodyEncoding, secretJsonFields, multipart);
  const headers = createRequestHeaders(config, value.headers, secretHeaders, multipart !== undefined);

  return {
    requestId: readRequiredRequestId(value.requestId),
    url: normalizeUrl(value.url),
    method: normalizeRequestMethod(value.method),
    headers,
    ...(body !== undefined ? { body } : {}),
    responseType
  };
}

function createRequestHeaders(
  config: NativeRemoteSyncRequestConfig,
  headers: unknown,
  secretHeaders: readonly NormalizedSecretHeader[],
  isMultipart: boolean
): Readonly<Record<string, string>> {
  const normalizedHeaders = normalizeHeaders(config, headers);
  const seenHeaderNames = new Set(Object.keys(normalizedHeaders).map((name) => name.toLowerCase()));

  if (Object.keys(normalizedHeaders).length + secretHeaders.length > config.maxHeaderCount) {
    throw new Error("Remote sync request has too many headers");
  }

  for (const secretHeader of secretHeaders) {
    const normalizedName = secretHeader.name.toLowerCase();

    if (seenHeaderNames.has(normalizedName)) {
      throw new Error("Remote sync secret header duplicates a request header");
    }

    const secret = readRequiredRemoteSyncSecret(config, secretHeader.secretRef);
    const headerValue = normalizeSecretHeaderValue(config, `${secretHeader.prefix ?? ""}${secret}`);
    normalizedHeaders[secretHeader.name] = headerValue;
    seenHeaderNames.add(normalizedName);
  }

  if (isMultipart && seenHeaderNames.has("content-type")) {
    throw new Error("Remote sync multipart requests must not set Content-Type");
  }

  return normalizedHeaders;
}

function normalizeHeaders(
  config: NativeRemoteSyncRequestConfig,
  value: unknown
): Record<string, string> {
  if (value === undefined) {
    return {};
  }

  if (!isRecord(value)) {
    throw new Error("Remote sync request headers must be an object");
  }

  const entries = Object.entries(value);

  if (entries.length > config.maxHeaderCount) {
    throw new Error("Remote sync request has too many headers");
  }

  const headers: Record<string, string> = {};
  const seenHeaderNames = new Set<string>();

  for (const [name, rawValue] of entries) {
    const normalizedName = normalizeHeaderName(name);
    const lowerName = normalizedName.toLowerCase();

    if (isForbiddenPlainHeader(lowerName)) {
      throw new Error("Remote sync request header must be provided through a secret binding");
    }

    if (seenHeaderNames.has(lowerName)) {
      throw new Error("Remote sync request headers must not contain duplicates");
    }

    headers[normalizedName] = normalizeHeaderValue(config, rawValue);
    seenHeaderNames.add(lowerName);
  }

  return headers;
}

function normalizeRequestBody(
  config: NativeRemoteSyncRequestConfig,
  value: unknown,
  encoding: NativeRemoteSyncRequestBodyEncoding,
  secretJsonFields: readonly NormalizedSecretJsonField[],
  multipart: readonly NormalizedMultipartPart[] | undefined
): BodyInit | undefined {
  if (multipart !== undefined) {
    if (value !== undefined) {
      throw new Error("Remote sync multipart requests must not include a raw request body");
    }

    if (secretJsonFields.length > 0) {
      throw new Error("Remote sync multipart requests cannot use secret JSON fields");
    }

    return createMultipartRequestBody(multipart);
  }

  if (value === undefined && secretJsonFields.length === 0) {
    return undefined;
  }

  if (secretJsonFields.length > 0) {
    if (encoding !== "utf8") {
      throw new Error("Remote sync JSON secret fields require a UTF-8 request body");
    }

    return normalizeJsonBodyWithSecrets(config, value, secretJsonFields);
  }

  if (typeof value !== "string") {
    throw new Error("Remote sync request body must be a string");
  }

  if (encoding === "base64") {
    return normalizeBase64RequestBody(config, value);
  }

  if (Buffer.byteLength(value, "utf8") > config.maxRequestBytes) {
    throw new Error("Remote sync request body is too large");
  }

  return value;
}

function normalizeJsonBodyWithSecrets(
  config: NativeRemoteSyncRequestConfig,
  value: unknown,
  secretJsonFields: readonly NormalizedSecretJsonField[]
): string {
  let body: Record<string, unknown> = {};

  if (value !== undefined) {
    if (typeof value !== "string") {
      throw new Error("Remote sync request body must be a string");
    }

    if (Buffer.byteLength(value, "utf8") > config.maxRequestBytes) {
      throw new Error("Remote sync request body is too large");
    }

    try {
      const parsed = JSON.parse(value);

      if (!isRecord(parsed)) {
        throw new Error("Remote sync JSON request body must be an object");
      }

      body = { ...parsed };
    } catch {
      throw new Error("Remote sync JSON request body is invalid");
    }
  }

  for (const secretJsonField of secretJsonFields) {
    if (Object.prototype.hasOwnProperty.call(body, secretJsonField.name)) {
      throw new Error("Remote sync secret JSON field duplicates a request body field");
    }

    body[secretJsonField.name] = readRequiredRemoteSyncSecret(config, secretJsonField.secretRef);
  }

  const serialized = JSON.stringify(body);

  if (Buffer.byteLength(serialized, "utf8") > config.maxRequestBytes) {
    throw new Error("Remote sync request body is too large");
  }

  return serialized;
}

function normalizeBase64RequestBody(config: NativeRemoteSyncRequestConfig, value: string): ArrayBuffer {
  if (!isBase64Value(value)) {
    throw new Error("Remote sync base64 request body is invalid");
  }

  const body = Buffer.from(value, "base64");

  if (body.byteLength > config.maxRequestBytes) {
    throw new Error("Remote sync request body is too large");
  }

  return new Uint8Array(body).buffer;
}

function normalizeMultipartParts(
  config: NativeRemoteSyncRequestConfig,
  value: unknown
): readonly NormalizedMultipartPart[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error("Remote sync multipart parts must be an array");
  }

  if (value.length === 0 || value.length > nativeRemoteSyncMultipartLimits.maxParts) {
    throw new Error("Remote sync multipart request has an invalid part count");
  }

  const parts: NormalizedMultipartPart[] = [];
  let totalBytes = 0;

  for (const item of value) {
    const part = normalizeMultipartPart(item);
    totalBytes += part.byteLength;

    if (totalBytes > config.maxRequestBytes) {
      throw new Error("Remote sync request body is too large");
    }

    parts.push(part);
  }

  return parts;
}

function normalizeMultipartPart(value: unknown): NormalizedMultipartPart {
  const record = expectRecord(value, "Remote sync multipart part");
  const name = normalizeMultipartPartName(record.name);

  if (record.kind === "text") {
    const textValue = normalizeMultipartTextValue(record.value);

    return {
      kind: "text",
      name,
      value: textValue,
      byteLength: Buffer.byteLength(textValue, "utf8")
    };
  }

  if (record.kind !== "file") {
    throw new Error("Remote sync multipart part kind is invalid");
  }

  const content = normalizeMultipartFileContent(record.value, normalizeMultipartFileEncoding(record.encoding));

  return {
    kind: "file",
    name,
    fileName: normalizeMultipartFileName(record.fileName),
    value: content,
    byteLength: content.byteLength,
    ...normalizeMultipartContentType(record.contentType)
  };
}

function normalizeMultipartPartName(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Remote sync multipart part name is invalid");
  }

  const normalized = value.trim();

  if (
    !normalized ||
    normalized.length > nativeRemoteSyncMultipartLimits.maxPartNameLength ||
    !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(normalized)
  ) {
    throw new Error("Remote sync multipart part name is invalid");
  }

  return normalized;
}

function normalizeMultipartTextValue(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Remote sync multipart text part value must be a string");
  }

  return value;
}

function normalizeMultipartFileName(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Remote sync multipart file name is invalid");
  }

  const normalized = value.trim();

  if (
    !normalized ||
    normalized === "." ||
    normalized === ".." ||
    normalized.length > nativeRemoteSyncMultipartLimits.maxFileNameLength ||
    /[\\/\0-\x1f\x7f]/.test(normalized)
  ) {
    throw new Error("Remote sync multipart file name is invalid");
  }

  return normalized;
}

function normalizeMultipartFileContent(
  value: unknown,
  encoding: NativeRemoteSyncRequestBodyEncoding
): Uint8Array {
  if (typeof value !== "string") {
    throw new Error("Remote sync multipart file part value must be a string");
  }

  if (encoding === "base64") {
    if (!isBase64Value(value)) {
      throw new Error("Remote sync multipart base64 file part is invalid");
    }

    return new Uint8Array(Buffer.from(value, "base64"));
  }

  return new Uint8Array(Buffer.from(value, "utf8"));
}

function normalizeMultipartFileEncoding(value: unknown): NativeRemoteSyncRequestBodyEncoding {
  if (value !== "base64" && value !== "utf8") {
    throw new Error("Remote sync multipart file encoding is invalid");
  }

  return value;
}

function normalizeMultipartContentType(value: unknown): { readonly contentType?: string } {
  if (value === undefined) {
    return {};
  }

  if (typeof value !== "string") {
    throw new Error("Remote sync multipart content type is invalid");
  }

  const normalized = value.trim();

  if (
    !normalized ||
    normalized.length > nativeRemoteSyncMultipartLimits.maxContentTypeLength ||
    hasUnsafeHeaderText(normalized) ||
    !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+\/[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(normalized)
  ) {
    throw new Error("Remote sync multipart content type is invalid");
  }

  return { contentType: normalized };
}

function createMultipartRequestBody(parts: readonly NormalizedMultipartPart[]): FormData {
  const formData = new FormData();

  for (const part of parts) {
    if (part.kind === "text") {
      formData.append(part.name, part.value);
      continue;
    }

    const blobPart = createMultipartBlobPart(part.value);
    const blob = part.contentType
      ? new Blob([blobPart], { type: part.contentType })
      : new Blob([blobPart]);
    formData.append(part.name, blob, part.fileName);
  }

  return formData;
}

function createMultipartBlobPart(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

async function readRemoteSyncResponse(
  config: NativeRemoteSyncRequestConfig,
  responseType: NativeRemoteSyncResponseType,
  response: Response
): Promise<NativeRemoteSyncResponsePayload> {
  const payload = {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeadersToRecord(response.headers)
  };

  if (responseType === "base64") {
    const body = Buffer.from(await response.arrayBuffer());

    if (body.byteLength > config.maxResponseBytes) {
      throw new Error("Remote sync response is too large");
    }

    return {
      ...payload,
      body: body.toString("base64")
    };
  }

  const body = await response.text();

  if (Buffer.byteLength(body, "utf8") > config.maxResponseBytes) {
    throw new Error("Remote sync response is too large");
  }

  if (responseType === "text") {
    return {
      ...payload,
      body
    };
  }

  try {
    return {
      ...payload,
      body: body ? JSON.parse(body) : null
    };
  } catch {
    throw new Error("Remote sync JSON response is invalid");
  }
}

function responseHeadersToRecord(headers: Headers): Readonly<Record<string, string>> {
  const record: Record<string, string> = {};

  headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") {
      record[key] = value;
    }
  });

  return record;
}

function normalizeSecretHeaders(
  config: NativeRemoteSyncRequestConfig,
  value: unknown
): readonly NormalizedSecretHeader[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("Remote sync secret headers must be an array");
  }

  if (value.length > config.maxSecretBindings) {
    throw new Error("Remote sync request has too many secret bindings");
  }

  const headers: NormalizedSecretHeader[] = [];
  const seenHeaderNames = new Set<string>();

  for (const item of value) {
    const record = expectRecord(item, "Remote sync secret header");
    const name = normalizeHeaderName(record.name);
    const normalizedName = name.toLowerCase();

    if (seenHeaderNames.has(normalizedName)) {
      throw new Error("Remote sync secret headers must not contain duplicates");
    }

    headers.push({
      name,
      secretRef: normalizeRemoteSyncSecretRef(record.secretRef),
      ...normalizeSecretPrefix(record.prefix)
    });
    seenHeaderNames.add(normalizedName);
  }

  return headers;
}

function normalizeSecretJsonFields(
  config: NativeRemoteSyncRequestConfig,
  value: unknown
): readonly NormalizedSecretJsonField[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("Remote sync secret JSON fields must be an array");
  }

  if (value.length > config.maxSecretBindings) {
    throw new Error("Remote sync request has too many secret bindings");
  }

  const fields: NormalizedSecretJsonField[] = [];
  const seenFieldNames = new Set<string>();

  for (const item of value) {
    const record = expectRecord(item, "Remote sync secret JSON field");
    const name = normalizeJsonFieldName(record.name);

    if (seenFieldNames.has(name)) {
      throw new Error("Remote sync secret JSON fields must not contain duplicates");
    }

    fields.push({
      name,
      secretRef: normalizeRemoteSyncSecretRef(record.secretRef)
    });
    seenFieldNames.add(name);
  }

  return fields;
}

function readRequiredRemoteSyncSecret(config: NativeRemoteSyncRequestConfig, secretRef: string): string {
  const secret = readNativeSecret(config, nativeRemoteSyncRequestSecretLabel, secretRef);

  if (!secret) {
    throw new Error("Missing remote sync secret");
  }

  return secret;
}

function normalizeRemoteSyncSecretRef(value: unknown): string {
  return normalizeNativeSecretRef(nativeRemoteSyncRequestSecretLabel, value);
}

function normalizeUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 2000) {
    throw new Error("Remote sync request URL is invalid");
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && !isLoopbackHttpUrl(url)) {
      throw new Error("Remote sync request URL protocol is not allowed");
    }

    return url.toString();
  } catch {
    throw new Error("Remote sync request URL is invalid");
  }
}

function normalizeRequestMethod(value: unknown): NativeRemoteSyncRequestMethod {
  if (typeof value !== "string") {
    throw new Error("Remote sync request method is invalid");
  }

  const method = value.toUpperCase();

  if (method !== "DELETE" && method !== "GET" && method !== "PATCH" && method !== "POST" && method !== "PUT") {
    throw new Error("Remote sync request method is invalid");
  }

  return method;
}

function normalizeResponseType(value: unknown): NativeRemoteSyncResponseType {
  if (value === undefined) {
    return "json";
  }

  if (value !== "base64" && value !== "json" && value !== "text") {
    throw new Error("Remote sync response type is invalid");
  }

  return value;
}

function normalizeBodyEncoding(value: unknown): NativeRemoteSyncRequestBodyEncoding {
  if (value === undefined) {
    return "utf8";
  }

  if (value !== "base64" && value !== "utf8") {
    throw new Error("Remote sync request body encoding is invalid");
  }

  return value;
}

function normalizeHeaderName(value: unknown): string {
  if (typeof value !== "string" || !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(value)) {
    throw new Error("Remote sync request header name is invalid");
  }

  return value;
}

function normalizeHeaderValue(config: NativeRemoteSyncRequestConfig, value: unknown): string {
  if (typeof value !== "string" || hasUnsafeHeaderText(value)) {
    throw new Error("Remote sync request header value is invalid");
  }

  if (Buffer.byteLength(value, "utf8") > config.maxHeaderValueBytes) {
    throw new Error("Remote sync request header value is too large");
  }

  return value;
}

function normalizeSecretPrefix(value: unknown): { readonly prefix?: string } {
  if (value === undefined) {
    return {};
  }

  if (typeof value !== "string" || hasUnsafeHeaderText(value) || Buffer.byteLength(value, "utf8") > 128) {
    throw new Error("Remote sync secret header prefix is invalid");
  }

  return { prefix: value };
}

function normalizeSecretHeaderValue(config: NativeRemoteSyncRequestConfig, value: string): string {
  if (hasUnsafeHeaderText(value)) {
    throw new Error("Remote sync secret header value is invalid");
  }

  if (Buffer.byteLength(value, "utf8") > config.maxHeaderValueBytes) {
    throw new Error("Remote sync secret header value is too large");
  }

  return value;
}

function normalizeJsonFieldName(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value) ||
    value === "__proto__" ||
    value === "constructor" ||
    value === "prototype"
  ) {
    throw new Error("Remote sync secret JSON field name is invalid");
  }

  return value;
}

function readRequiredRequestId(value: unknown): string {
  const normalized = readOptionalRequestId(value);

  if (!normalized) {
    throw new Error("Remote sync request id is invalid");
  }

  return normalized;
}

function readOptionalRequestId(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 128) {
    return undefined;
  }

  return /^[A-Za-z0-9_.:-]+$/.test(value) ? value : undefined;
}

function isForbiddenPlainHeader(value: string): boolean {
  return value === "authorization" || value === "cookie" || value === "proxy-authorization" || value === "set-cookie";
}

function hasUnsafeHeaderText(value: string): boolean {
  return value.includes("\r") || value.includes("\n");
}

function isBase64Value(value: string): boolean {
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

function isLoopbackHttpUrl(url: URL): boolean {
  return url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface NormalizedSecretHeader {
  readonly name: string;
  readonly secretRef: string;
  readonly prefix?: string;
}

interface NormalizedSecretJsonField {
  readonly name: string;
  readonly secretRef: string;
}

type NormalizedMultipartPart =
  | NormalizedMultipartFilePart
  | NormalizedMultipartTextPart;

interface NormalizedMultipartTextPart {
  readonly kind: "text";
  readonly name: string;
  readonly value: string;
  readonly byteLength: number;
}

interface NormalizedMultipartFilePart {
  readonly kind: "file";
  readonly name: string;
  readonly fileName: string;
  readonly value: Uint8Array;
  readonly byteLength: number;
  readonly contentType?: string;
}
