import {
  createNativeRemoteSyncRequestTransport,
  createRemoteSyncProfileRequestTransport,
  remoteSyncConfiguredRawMirrorMetadataKeys,
  type RemoteSyncNativeRequestTransport,
  type RemoteSyncProfileSecretHeader,
  type RemoteSyncProviderConfiguration
} from "@typora-plus/platform";
import {
  runWorkbenchAction,
  type WorkbenchActionRunnerMessages,
  type WorkbenchOperationErrorSetter
} from "./workbenchActionRunner";

export interface WorkbenchRemoteSyncLarkAuthActions {
  readonly isAvailable: boolean;
  checkAuthorization(profile: RemoteSyncProviderConfiguration): Promise<WorkbenchRemoteSyncLarkAuthStatus | undefined>;
  startAuthorization(profile: RemoteSyncProviderConfiguration): Promise<WorkbenchRemoteSyncLarkAuthStart | undefined>;
  completeAuthorization(
    profile: RemoteSyncProviderConfiguration,
    deviceCode: string
  ): Promise<WorkbenchRemoteSyncLarkAuthStatus | undefined>;
  listFolders(
    profile: RemoteSyncProviderConfiguration,
    parentToken?: string
  ): Promise<readonly WorkbenchRemoteSyncLarkFolder[] | undefined>;
  createFolder(
    profile: RemoteSyncProviderConfiguration,
    request: WorkbenchRemoteSyncLarkCreateFolderRequest
  ): Promise<WorkbenchRemoteSyncLarkFolder | undefined>;
}

export interface WorkbenchRemoteSyncLarkAuthStatus {
  readonly authorized: boolean;
  readonly message?: string;
}

export interface WorkbenchRemoteSyncLarkAuthStart {
  readonly deviceCode: string;
  readonly userCode?: string;
  readonly verificationUrl?: string;
  readonly message?: string;
}

export interface WorkbenchRemoteSyncLarkFolder {
  readonly name: string;
  readonly token: string;
  readonly url?: string;
}

export interface WorkbenchRemoteSyncLarkCreateFolderRequest {
  readonly name: string;
  readonly parentToken?: string;
}

export interface WorkbenchRemoteSyncLarkAuthCallbacks {
  readonly actionRunnerMessages?: WorkbenchActionRunnerMessages;
  readonly messages?: WorkbenchRemoteSyncLarkAuthMessages;
  readonly setOperationError: WorkbenchOperationErrorSetter;
}

export interface WorkbenchRemoteSyncLarkAuthMessages {
  readonly deviceCodeMissing: string;
  readonly folderNameMissing: string;
  readonly folderTokenMissing: string;
  readonly requestUnavailable: string;
  readonly gatewayRequestFailed: (status: number, statusText: string) => string;
}

export const defaultWorkbenchRemoteSyncLarkAuthMessages: WorkbenchRemoteSyncLarkAuthMessages = {
  deviceCodeMissing: "Lark authorization device code is missing",
  folderNameMissing: "Lark folder name is missing",
  folderTokenMissing: "Lark folder token is missing",
  requestUnavailable: "Remote sync native request bridge is unavailable",
  gatewayRequestFailed: (status, statusText) => `Lark authorization gateway failed: ${status} ${statusText}`.trim()
};

export const workbenchRemoteSyncLarkAuthPaths = {
  complete: "auth/login/complete",
  createFolder: "folders/create",
  listFolders: "folders/list",
  start: "auth/login/start",
  status: "auth/status"
} as const;

export function createWorkbenchRemoteSyncLarkAuthActions(
  callbacks: WorkbenchRemoteSyncLarkAuthCallbacks,
  transport: RemoteSyncNativeRequestTransport | undefined = createNativeRemoteSyncRequestTransport()
): WorkbenchRemoteSyncLarkAuthActions {
  return {
    isAvailable: !!transport,
    checkAuthorization: (profile) => runWorkbenchAction(
      () => checkWorkbenchRemoteSyncLarkAuthorization(profile, {
        ...(callbacks.messages ? { messages: callbacks.messages } : {}),
        ...(transport ? { transport } : {})
      }),
      callbacks.setOperationError,
      undefined,
      callbacks.actionRunnerMessages
    ),
    startAuthorization: (profile) => runWorkbenchAction(
      () => startWorkbenchRemoteSyncLarkAuthorization(profile, {
        ...(callbacks.messages ? { messages: callbacks.messages } : {}),
        ...(transport ? { transport } : {})
      }),
      callbacks.setOperationError,
      undefined,
      callbacks.actionRunnerMessages
    ),
    completeAuthorization: (profile, deviceCode) => runWorkbenchAction(
      () => completeWorkbenchRemoteSyncLarkAuthorization(profile, deviceCode, {
        ...(callbacks.messages ? { messages: callbacks.messages } : {}),
        ...(transport ? { transport } : {})
      }),
      callbacks.setOperationError,
      undefined,
      callbacks.actionRunnerMessages
    ),
    listFolders: (profile, parentToken) => runWorkbenchAction(
      () => listWorkbenchRemoteSyncLarkFolders(profile, parentToken, {
        ...(callbacks.messages ? { messages: callbacks.messages } : {}),
        ...(transport ? { transport } : {})
      }),
      callbacks.setOperationError,
      undefined,
      callbacks.actionRunnerMessages
    ),
    createFolder: (profile, request) => runWorkbenchAction(
      () => createWorkbenchRemoteSyncLarkFolder(profile, request, {
        ...(callbacks.messages ? { messages: callbacks.messages } : {}),
        ...(transport ? { transport } : {})
      }),
      callbacks.setOperationError,
      undefined,
      callbacks.actionRunnerMessages
    )
  };
}

export async function checkWorkbenchRemoteSyncLarkAuthorization(
  profile: RemoteSyncProviderConfiguration,
  options: {
    readonly messages?: WorkbenchRemoteSyncLarkAuthMessages;
    readonly transport?: RemoteSyncNativeRequestTransport;
  } = {}
): Promise<WorkbenchRemoteSyncLarkAuthStatus> {
  const response = await requestWorkbenchRemoteSyncLarkAuth(profile, {
    method: "GET",
    path: workbenchRemoteSyncLarkAuthPaths.status,
    query: { verify: true },
    responseType: "json"
  }, options);
  const body = readLarkAuthResponseBody(response.body);

  return {
    authorized: true,
    ...readOptionalMessageProperty(body)
  };
}

export async function startWorkbenchRemoteSyncLarkAuthorization(
  profile: RemoteSyncProviderConfiguration,
  options: {
    readonly messages?: WorkbenchRemoteSyncLarkAuthMessages;
    readonly transport?: RemoteSyncNativeRequestTransport;
  } = {}
): Promise<WorkbenchRemoteSyncLarkAuthStart> {
  const messages = options.messages ?? defaultWorkbenchRemoteSyncLarkAuthMessages;
  const response = await requestWorkbenchRemoteSyncLarkAuth(profile, {
    method: "POST",
    path: workbenchRemoteSyncLarkAuthPaths.start,
    responseType: "json"
  }, options);
  const body = readLarkAuthResponseBody(response.body);
  const deviceCode = findStringByNormalizedKeys(body, ["deviceCode", "device_code"]);

  if (!deviceCode) {
    throw new Error(messages.deviceCodeMissing);
  }

  return {
    deviceCode,
    ...readOptionalStartProperties(body),
    ...readOptionalMessageProperty(body)
  };
}

export async function completeWorkbenchRemoteSyncLarkAuthorization(
  profile: RemoteSyncProviderConfiguration,
  deviceCode: string,
  options: {
    readonly messages?: WorkbenchRemoteSyncLarkAuthMessages;
    readonly transport?: RemoteSyncNativeRequestTransport;
  } = {}
): Promise<WorkbenchRemoteSyncLarkAuthStatus> {
  const messages = options.messages ?? defaultWorkbenchRemoteSyncLarkAuthMessages;
  const normalizedDeviceCode = deviceCode.trim();

  if (!normalizedDeviceCode) {
    throw new Error(messages.deviceCodeMissing);
  }

  const response = await requestWorkbenchRemoteSyncLarkAuth(profile, {
    body: JSON.stringify({ deviceCode: normalizedDeviceCode }),
    bodyEncoding: "utf8",
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST",
    path: workbenchRemoteSyncLarkAuthPaths.complete,
    responseType: "json"
  }, options);
  const body = readLarkAuthResponseBody(response.body);

  return {
    authorized: true,
    ...readOptionalMessageProperty(body)
  };
}

export async function listWorkbenchRemoteSyncLarkFolders(
  profile: RemoteSyncProviderConfiguration,
  parentToken: string | undefined,
  options: {
    readonly messages?: WorkbenchRemoteSyncLarkAuthMessages;
    readonly transport?: RemoteSyncNativeRequestTransport;
  } = {}
): Promise<readonly WorkbenchRemoteSyncLarkFolder[]> {
  const response = await requestWorkbenchRemoteSyncLarkAuth(profile, {
    method: "GET",
    path: workbenchRemoteSyncLarkAuthPaths.listFolders,
    query: { remoteScopeId: parentToken ?? profile.remoteScopeId ?? "" },
    responseType: "json"
  }, options);
  const body = readLarkAuthResponseBody(response.body);
  const folders = readFolderArray(body);

  return folders.flatMap((folder) => {
    const parsed = readLarkFolder(folder);
    return parsed ? [parsed] : [];
  });
}

export async function createWorkbenchRemoteSyncLarkFolder(
  profile: RemoteSyncProviderConfiguration,
  request: WorkbenchRemoteSyncLarkCreateFolderRequest,
  options: {
    readonly messages?: WorkbenchRemoteSyncLarkAuthMessages;
    readonly transport?: RemoteSyncNativeRequestTransport;
  } = {}
): Promise<WorkbenchRemoteSyncLarkFolder> {
  const messages = options.messages ?? defaultWorkbenchRemoteSyncLarkAuthMessages;
  const name = request.name.trim();

  if (!name) {
    throw new Error(messages.folderNameMissing);
  }

  const response = await requestWorkbenchRemoteSyncLarkAuth(profile, {
    body: JSON.stringify({
      name,
      parentToken: request.parentToken ?? profile.remoteScopeId ?? ""
    }),
    bodyEncoding: "utf8",
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST",
    path: workbenchRemoteSyncLarkAuthPaths.createFolder,
    responseType: "json"
  }, options);
  const body = readLarkAuthResponseBody(response.body);
  const folder = readLarkFolder(body) ?? readLarkFolder(readResponseData(body));

  if (!folder) {
    throw new Error(messages.folderTokenMissing);
  }

  return folder;
}

async function requestWorkbenchRemoteSyncLarkAuth(
  profile: RemoteSyncProviderConfiguration,
  request: Parameters<NonNullable<ReturnType<typeof createRemoteSyncProfileRequestTransport>>>[0],
  options: {
    readonly messages?: WorkbenchRemoteSyncLarkAuthMessages;
    readonly transport?: RemoteSyncNativeRequestTransport;
  }
) {
  const messages = options.messages ?? defaultWorkbenchRemoteSyncLarkAuthMessages;
  const profileRequest = createRemoteSyncProfileRequestTransport(profile, options.transport);

  if (!profileRequest) {
    throw new Error(messages.requestUnavailable);
  }

  const response = await profileRequest({
    ...request,
    ...createWorkbenchRemoteSyncLarkAuthSecretRequest(profile)
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(readLarkAuthGatewayErrorMessage(response, messages));
  }

  return response;
}

function createWorkbenchRemoteSyncLarkAuthSecretRequest(
  profile: RemoteSyncProviderConfiguration
): { readonly secretHeaders?: readonly RemoteSyncProfileSecretHeader[] } {
  const metadata = profile.metadata ?? {};
  const secretName = readMetadataValue(metadata[remoteSyncConfiguredRawMirrorMetadataKeys.headerBinding]);
  const headerName = readMetadataValue(metadata[remoteSyncConfiguredRawMirrorMetadataKeys.headerName]);

  if (!secretName || !headerName) {
    return {};
  }

  const headerScheme = readMetadataValue(metadata[remoteSyncConfiguredRawMirrorMetadataKeys.headerScheme]);

  return {
    secretHeaders: [{
      name: headerName,
      secretName,
      ...(headerScheme ? { prefix: `${headerScheme} ` } : {})
    }]
  };
}

function readLarkAuthResponseBody(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function readResponseData(value: unknown): unknown {
  return isRecord(value) && isRecord(value.data) ? value.data : value;
}

function readFolderArray(value: unknown): readonly unknown[] {
  const data = readResponseData(value);

  if (isRecord(data) && Array.isArray(data.folders)) {
    return data.folders;
  }

  if (Array.isArray(data)) {
    return data;
  }

  return [];
}

function readLarkFolder(value: unknown): WorkbenchRemoteSyncLarkFolder | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const data = readResponseData(value);

  if (data !== value) {
    return readLarkFolder(data);
  }

  const name = findStringByNormalizedKeys(value, ["name"]);
  const token = findStringByNormalizedKeys(value, ["token", "folderToken", "folder_token", "fileToken", "file_token"]);
  const url = findVerificationUrl({
    url: findStringByNormalizedKeys(value, ["url", "folderUrl", "folder_url"])
  });

  if (!name || !token) {
    return undefined;
  }

  return {
    name,
    token,
    ...(url ? { url } : {})
  };
}

function readOptionalStartProperties(value: unknown): {
  readonly userCode?: string;
  readonly verificationUrl?: string;
} {
  const userCode = findStringByNormalizedKeys(value, ["userCode", "user_code"]);
  const verificationUrl = findVerificationUrl(value);

  return {
    ...(userCode ? { userCode } : {}),
    ...(verificationUrl ? { verificationUrl } : {})
  };
}

function readOptionalMessageProperty(value: unknown): { readonly message?: string } {
  const message = findStringByNormalizedKeys(value, ["message", "output"]);
  return message ? { message } : {};
}

function findVerificationUrl(value: unknown): string | undefined {
  const candidate = findStringByNormalizedKeys(value, [
    "verificationUrl",
    "verification_url",
    "verificationUri",
    "verification_uri",
    "verificationUriComplete",
    "verification_uri_complete",
    "loginUrl",
    "login_url",
    "url"
  ]);

  if (!candidate) {
    return undefined;
  }

  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function findStringByNormalizedKeys(value: unknown, keys: readonly string[]): string | undefined {
  const normalizedKeys = new Set(keys.map(normalizeResponseKey));

  return findStringByKey(value, normalizedKeys, new Set());
}

function findStringByKey(
  value: unknown,
  keys: ReadonlySet<string>,
  seen: Set<unknown>
): string | undefined {
  if (typeof value !== "object" || value === null || seen.has(value)) {
    return undefined;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringByKey(item, keys, seen);

      if (found) {
        return found;
      }
    }

    return undefined;
  }

  for (const [key, rawValue] of Object.entries(value)) {
    if (keys.has(normalizeResponseKey(key)) && typeof rawValue === "string" && rawValue.trim()) {
      return rawValue.trim();
    }
  }

  for (const rawValue of Object.values(value)) {
    const found = findStringByKey(rawValue, keys, seen);

    if (found) {
      return found;
    }
  }

  return undefined;
}

function normalizeResponseKey(value: string): string {
  return value.replace(/[-_]/g, "").toLowerCase();
}

function readLarkAuthGatewayErrorMessage(
  response: { readonly status: number; readonly statusText: string; readonly body?: unknown },
  messages: WorkbenchRemoteSyncLarkAuthMessages
): string {
  const body = isRecord(response.body) ? response.body : undefined;
  const error = typeof body?.error === "string" && body.error.trim() ? body.error.trim() : undefined;
  const message = messages.gatewayRequestFailed(response.status, response.statusText);

  return error ? `${message}: ${error}` : message;
}

function readMetadataValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
