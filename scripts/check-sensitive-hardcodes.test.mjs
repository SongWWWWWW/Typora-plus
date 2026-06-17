import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  findSensitiveHardcodesInText,
  formatSensitiveHardcodeFinding,
  getLineColumn,
  runSensitiveHardcodeScanCli,
  scanSensitiveHardcodes,
  shouldScanFile,
  sortSensitiveHardcodeFindings
} from "./check-sensitive-hardcodes.mjs";

const tempRoots = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("sensitive hardcode scanner", () => {
  it("finds provider endpoints, tokens, secret names, provider identifiers, and model defaults with locations", () => {
    const text = [
      'const endpoint = "https://api.openai.local/v1";',
      'const key = "sk-abcdefghijklmnopqrstuvwxyz";',
      'const token = "xoxb-abcdefghijklmnopqrstuvwx";',
      'const secretName = "folder_token";',
      'const provider = { appId: "cli_xxxxxxxxxxxxxxxxxxxx" };',
      'const request = { model: "gpt-live" };'
    ].join("\n");

    const findings = findSensitiveHardcodesInText("packages/platform/src/provider.ts", text);

    expect(findings.map(({ id }) => id)).toEqual([
      "provider-url",
      "openai-api-key",
      "slack-token",
      "provider-secret-name",
      "provider-identifier-literal",
      "model-literal"
    ]);
    expect(findings.at(-1)).toMatchObject({
      column: 19,
      file: "packages/platform/src/provider.ts",
      line: 6,
      match: 'model: "gpt-live"'
    });
  });

  it("allows test fixture models and localized UI model labels", () => {
    const localizedModelLabel = "\u6a21\u578b";
    const uiText = [
      'const englishLabel = { model: "Model" };',
      `const localizedLabel = { model: "${localizedModelLabel}" };`,
      'const englishDefaultLabel = { defaultModel: "Model" };',
      `const localizedDefaultLabel = { default_model: "${localizedModelLabel}" };`
    ].join("\n");

    expect(findSensitiveHardcodesInText("packages/workbench/src/settingsModel.ts", uiText)).toEqual([]);
    expect(
      findSensitiveHardcodesInText(
        "packages/platform/src/responsesAiProvider.smoke.test.ts",
        'const request = { model: "gpt-fixture" };'
      )
    ).toEqual([]);
  });

  it("finds model default literals across supported model field names", () => {
    const text = [
      'const responses = { model: "gpt-live" };',
      'const extension = { modelId: "gpt-extension" };',
      'const native = { model_id: "gpt-native" };',
      'const fallback = { defaultModel: "gpt-fallback" };',
      'const raw = { default_model: "gpt-raw" };'
    ].join("\n");

    const findings = findSensitiveHardcodesInText("packages/platform/src/provider.ts", text);

    expect(findings).toEqual([
      {
        column: 21,
        file: "packages/platform/src/provider.ts",
        id: "model-literal",
        line: 1,
        match: 'model: "gpt-live"'
      },
      {
        column: 21,
        file: "packages/platform/src/provider.ts",
        id: "model-literal",
        line: 2,
        match: 'modelId: "gpt-extension"'
      },
      {
        column: 18,
        file: "packages/platform/src/provider.ts",
        id: "model-literal",
        line: 3,
        match: 'model_id: "gpt-native"'
      },
      {
        column: 20,
        file: "packages/platform/src/provider.ts",
        id: "model-literal",
        line: 4,
        match: 'defaultModel: "gpt-fallback"'
      },
      {
        column: 15,
        file: "packages/platform/src/provider.ts",
        id: "model-literal",
        line: 5,
        match: 'default_model: "gpt-raw"'
      }
    ]);
  });

  it("finds OpenAI key literals with hyphenated or underscored key bodies", () => {
    const text = [
      'const projectKey = "sk-proj-abcdefghijklmnopqrstuvwxyz";',
      'const serviceKey = "sk-service_account_abcdefghijklmnopqrstuvwxyz";'
    ].join("\n");

    const findings = findSensitiveHardcodesInText("packages/platform/src/provider.ts", text);

    expect(findings).toEqual([
      {
        column: 21,
        file: "packages/platform/src/provider.ts",
        id: "openai-api-key",
        line: 1,
        match: "sk-proj-abcdefghijklmnopqrstuvwxyz"
      },
      {
        column: 21,
        file: "packages/platform/src/provider.ts",
        id: "openai-api-key",
        line: 2,
        match: "sk-service_account_abcdefghijklmnopqrstuvwxyz"
      }
    ]);
  });

  it("finds Google API key-shaped literals while allowing short placeholders", () => {
    const text = [
      'const placeholder = "AIza-example";',
      'const googleApiKey = "AIzaabcdefghijklmnopqrstuvwxyz1234567-_";'
    ].join("\n");

    const findings = findSensitiveHardcodesInText("packages/platform/src/google.ts", text);

    expect(findings).toEqual([
      {
        column: 23,
        file: "packages/platform/src/google.ts",
        id: "google-api-key",
        line: 2,
        match: "AIzaabcdefghijklmnopqrstuvwxyz1234567-_"
      }
    ]);
  });

  it("finds npm token-shaped literals while allowing short placeholders and commands", () => {
    const text = [
      'const placeholder = "npm_example";',
      'const command = "npm run build";',
      'const npmToken = "npm_abcdefghijklmnopqrstuvwxyz1234567890";'
    ].join("\n");

    const findings = findSensitiveHardcodesInText("packages/platform/src/npm.ts", text);

    expect(findings).toEqual([
      {
        column: 19,
        file: "packages/platform/src/npm.ts",
        id: "npm-token",
        line: 3,
        match: "npm_abcdefghijklmnopqrstuvwxyz1234567890"
      }
    ]);
  });

  it("finds Stripe secret key-shaped literals while allowing publishable keys and placeholders", () => {
    const stripePlaceholder = ["sk", "live", "example"].join("_");
    const stripeSecretKey = ["sk", "live", "abcdefghijklmnopqrstuvwxyz"].join("_");
    const stripeRestrictedKey = ["rk", "test", "abcdefghijklmnopqrstuvwxyz"].join("_");
    const text = [
      `const placeholder = "${stripePlaceholder}";`,
      'const publishableKey = "pk_live_abcdefghijklmnopqrstuvwxyz";',
      `const secretKey = "${stripeSecretKey}";`,
      `const restrictedKey = "${stripeRestrictedKey}";`
    ].join("\n");

    const findings = findSensitiveHardcodesInText("packages/platform/src/stripe.ts", text);

    expect(findings).toEqual([
      {
        column: 20,
        file: "packages/platform/src/stripe.ts",
        id: "stripe-secret-key",
        line: 3,
        match: stripeSecretKey
      },
      {
        column: 24,
        file: "packages/platform/src/stripe.ts",
        id: "stripe-secret-key",
        line: 4,
        match: stripeRestrictedKey
      }
    ]);
  });

  it("finds GitHub token-shaped literals while allowing short placeholders", () => {
    const text = [
      'const placeholder = "ghp_example";',
      'const classicPat = "ghp_abcdefghijklmnopqrstuvwxyz1234567890";',
      'const fineGrainedPat = "github_pat_11AAAAAAI0abcdefghijklmnopqrstuvwxyz_1234567890";',
      'const serverToken = "ghs_abcdefghijklmnopqrstuvwxyz1234567890";'
    ].join("\n");

    const findings = findSensitiveHardcodesInText("packages/platform/src/github.ts", text);

    expect(findings).toEqual([
      {
        column: 21,
        file: "packages/platform/src/github.ts",
        id: "github-token",
        line: 2,
        match: "ghp_abcdefghijklmnopqrstuvwxyz1234567890"
      },
      {
        column: 25,
        file: "packages/platform/src/github.ts",
        id: "github-token",
        line: 3,
        match: "github_pat_11AAAAAAI0abcdefghijklmnopqrstuvwxyz_1234567890"
      },
      {
        column: 22,
        file: "packages/platform/src/github.ts",
        id: "github-token",
        line: 4,
        match: "ghs_abcdefghijklmnopqrstuvwxyz1234567890"
      }
    ]);
  });

  it("finds AWS access key ids while allowing short placeholders", () => {
    const text = [
      'const placeholder = "AKIAEXAMPLE";',
      'const longLivedAccessKey = "AKIA1234567890ABCDEF";',
      'const temporaryAccessKey = "ASIAABCDEFGHIJKLMNOP";'
    ].join("\n");

    const findings = findSensitiveHardcodesInText("packages/platform/src/aws.ts", text);

    expect(findings).toEqual([
      {
        column: 29,
        file: "packages/platform/src/aws.ts",
        id: "aws-access-key-id",
        line: 2,
        match: "AKIA1234567890ABCDEF"
      },
      {
        column: 29,
        file: "packages/platform/src/aws.ts",
        id: "aws-access-key-id",
        line: 3,
        match: "ASIAABCDEFGHIJKLMNOP"
      }
    ]);
  });

  it("finds Azure storage account keys while allowing placeholders and dynamic values", () => {
    const accountKey = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/abcdefghijklmnopqr==";
    const text = [
      'const placeholder = "AccountKey=example";',
      "const dynamicConnectionString = `AccountKey=${accountKey}`;",
      `const connectionString = "AccountKey=${accountKey}";`
    ].join("\n");

    const findings = findSensitiveHardcodesInText("packages/platform/src/azure.ts", text);

    expect(findings).toEqual([
      {
        column: 27,
        file: "packages/platform/src/azure.ts",
        id: "azure-storage-account-key",
        line: 3,
        match: `AccountKey=${accountKey}`
      }
    ]);
  });

  it("finds Azure storage SAS tokens while allowing short placeholders and dynamic values", () => {
    const signature = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789%2B%2F%3D";
    const text = [
      'const placeholder = "?sv=2024-11-04&sig=example";',
      "const dynamicSas = `?sv=${version}&sig=${signature}`;",
      `const sasUrl = "https://storage.example/container/file.md?sv=2024-11-04&se=2026-01-01T00%3A00%3A00Z&sp=rw&sig=${signature}";`,
      `const connectionString = "SharedAccessSignature=sv=2024-11-04&ss=b&srt=o&sp=rw&se=2026-01-01T00%3A00%3A00Z&sig=${signature}";`
    ].join("\n");

    const findings = findSensitiveHardcodesInText("packages/platform/src/azure.ts", text);

    expect(findings).toEqual([
      {
        column: 58,
        file: "packages/platform/src/azure.ts",
        id: "azure-storage-sas-token",
        line: 3,
        match: `?sv=2024-11-04&se=2026-01-01T00%3A00%3A00Z&sp=rw&sig=${signature}`
      },
      {
        column: 27,
        file: "packages/platform/src/azure.ts",
        id: "azure-storage-sas-token",
        line: 4,
        match: `SharedAccessSignature=sv=2024-11-04&ss=b&srt=o&sp=rw&se=2026-01-01T00%3A00%3A00Z&sig=${signature}`
      }
    ]);
  });

  it("finds JWT-shaped literals while allowing short segmented placeholders", () => {
    const text = [
      'const placeholder = "eyJ.short.token";',
      'const accessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";'
    ].join("\n");

    const findings = findSensitiveHardcodesInText("packages/platform/src/jwt.ts", text);

    expect(findings).toEqual([
      {
        column: 22,
        file: "packages/platform/src/jwt.ts",
        id: "jwt-token",
        line: 2,
        match: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
      }
    ]);
  });

  it("finds long opaque Bearer tokens without rejecting short, dynamic, or JWT bearer values", () => {
    const text = [
      'const shortHeader = "Authorization: Bearer test-api-key";',
      "const dynamicHeader = `Authorization: Bearer ${apiKey}`;",
      'const jwtHeader = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";',
      'const opaqueHeader = "Authorization: Bearer abcdefghijklmnopqrstuvwxyz1234567890TOKEN";'
    ].join("\n");

    const findings = findSensitiveHardcodesInText("packages/platform/src/bearer.ts", text);

    expect(findings).toEqual([
      {
        column: 42,
        file: "packages/platform/src/bearer.ts",
        id: "jwt-token",
        line: 3,
        match: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
      },
      {
        column: 38,
        file: "packages/platform/src/bearer.ts",
        id: "bearer-token",
        line: 4,
        match: "Bearer abcdefghijklmnopqrstuvwxyz1234567890TOKEN"
      }
    ]);
  });

  it("finds long Basic Auth tokens without rejecting short or dynamic values", () => {
    const text = [
      'const shortHeader = "Authorization: Basic dXNlcjpwYXNz";',
      "const dynamicHeader = `Authorization: Basic ${basicToken}`;",
      'const basicHeader = "Authorization: Basic dXNlcjpzdXBlclNlY3JldFBhc3N3b3JkMTIz";'
    ].join("\n");

    const findings = findSensitiveHardcodesInText("packages/platform/src/basicAuth.ts", text);

    expect(findings).toEqual([
      {
        column: 37,
        file: "packages/platform/src/basicAuth.ts",
        id: "basic-auth-token",
        line: 3,
        match: "Basic dXNlcjpzdXBlclNlY3JldFBhc3N3b3JkMTIz"
      }
    ]);
  });

  it("finds embedded URL credentials while allowing short placeholders and dynamic values", () => {
    const text = [
      'const shortPlaceholder = "https://user:pass@example.com/api";',
      "const dynamicUrl = `https://user:${password}@example.com/api`;",
      'const webhook = "https://client:superSecretTokenValue@example.com/api";',
      'const databaseUrl = "postgres://writer:veryStrongPassword123@db.example:5432/notes";'
    ].join("\n");

    const findings = findSensitiveHardcodesInText("packages/platform/src/urls.ts", text);

    expect(findings).toEqual([
      {
        column: 18,
        file: "packages/platform/src/urls.ts",
        id: "url-embedded-credentials",
        line: 3,
        match: "https://client:superSecretTokenValue@example.com/api"
      },
      {
        column: 22,
        file: "packages/platform/src/urls.ts",
        id: "url-embedded-credentials",
        line: 4,
        match: "postgres://writer:veryStrongPassword123@db.example:5432/notes"
      }
    ]);
  });

  it("finds long generic secret field literals without duplicating specific credential findings", () => {
    const text = [
      'const placeholder = { password: "example" };',
      "const dynamicSecret = { token: tokenValue };",
      'const session = { token: "abcdefghijklmnopqrstuvwxyz1234567890TOKEN" };',
      'const knownJwt = { accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c" };',
      'const knownOpenAi = { apiKey: "sk-abcdefghijklmnopqrstuvwxyz123456" };'
    ].join("\n");

    const findings = findSensitiveHardcodesInText("packages/platform/src/secrets.ts", text);

    expect(findings).toEqual([
      {
        column: 32,
        file: "packages/platform/src/secrets.ts",
        id: "openai-api-key",
        line: 5,
        match: "sk-abcdefghijklmnopqrstuvwxyz123456"
      },
      {
        column: 34,
        file: "packages/platform/src/secrets.ts",
        id: "jwt-token",
        line: 4,
        match: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
      },
      {
        column: 19,
        file: "packages/platform/src/secrets.ts",
        id: "secret-field-literal",
        line: 3,
        match: 'token: "abcdefghijklmnopqrstuvwxyz1234567890TOKEN"'
      }
    ]);
  });

  it("finds PEM private key headers without rejecting public key headers", () => {
    const text = [
      'const publicKey = "-----BEGIN PUBLIC KEY-----";',
      'const privateKey = "-----BEGIN PRIVATE KEY-----";',
      'const rsaPrivateKey = "-----BEGIN RSA PRIVATE KEY-----";',
      'const sshPrivateKey = "-----BEGIN OPENSSH PRIVATE KEY-----";',
      'const encryptedPrivateKey = "-----BEGIN ENCRYPTED PRIVATE KEY-----";'
    ].join("\n");

    const findings = findSensitiveHardcodesInText("packages/platform/src/keys.ts", text);

    expect(findings).toEqual([
      {
        column: 21,
        file: "packages/platform/src/keys.ts",
        id: "pem-private-key",
        line: 2,
        match: "-----BEGIN PRIVATE KEY-----"
      },
      {
        column: 24,
        file: "packages/platform/src/keys.ts",
        id: "pem-private-key",
        line: 3,
        match: "-----BEGIN RSA PRIVATE KEY-----"
      },
      {
        column: 24,
        file: "packages/platform/src/keys.ts",
        id: "pem-private-key",
        line: 4,
        match: "-----BEGIN OPENSSH PRIVATE KEY-----"
      },
      {
        column: 30,
        file: "packages/platform/src/keys.ts",
        id: "pem-private-key",
        line: 5,
        match: "-----BEGIN ENCRYPTED PRIVATE KEY-----"
      }
    ]);
  });

  it("finds provider URLs regardless of provider-name casing", () => {
    const text = [
      'const openaiEndpoint = "https://API.OpenAI.example/v1";',
      'const larkEndpoint = "https://gateway.Lark.example/files";'
    ].join("\n");

    const findings = findSensitiveHardcodesInText("packages/platform/src/provider.ts", text);

    expect(findings).toEqual([
      {
        column: 25,
        file: "packages/platform/src/provider.ts",
        id: "provider-url",
        line: 1,
        match: "https://API.OpenAI.example/v1"
      },
      {
        column: 23,
        file: "packages/platform/src/provider.ts",
        id: "provider-url",
        line: 2,
        match: "https://gateway.Lark.example/files"
      }
    ]);
  });

  it("finds provider secret names regardless of casing", () => {
    const text = [
      'const tenantTokenName = "TENANT_ACCESS_TOKEN";',
      'const folderTokenName = "Folder_Token";',
      'const appSecretName = "App_Secret";'
    ].join("\n");

    const findings = findSensitiveHardcodesInText("packages/platform/src/provider.ts", text);

    expect(findings).toEqual([
      {
        column: 26,
        file: "packages/platform/src/provider.ts",
        id: "provider-secret-name",
        line: 1,
        match: "TENANT_ACCESS_TOKEN"
      },
      {
        column: 26,
        file: "packages/platform/src/provider.ts",
        id: "provider-secret-name",
        line: 2,
        match: "Folder_Token"
      },
      {
        column: 24,
        file: "packages/platform/src/provider.ts",
        id: "provider-secret-name",
        line: 3,
        match: "App_Secret"
      }
    ]);
  });

  it("finds provider identifier literals without rejecting protocol field names alone", () => {
    const text = [
      'const app = { app_id: "cli_xxxxxxxxxxxxxxxxxxxx" };',
      'const client = { clientId: "client-1234567890" };',
      'const folder = { folder_id: "fld_1234567890" };',
      'const tenant = { tenantKey: "tenant-1234567890" };',
      'const protocolFieldName = "client_id";'
    ].join("\n");

    const findings = findSensitiveHardcodesInText("packages/platform/src/provider.ts", text);

    expect(findings).toEqual([
      {
        column: 15,
        file: "packages/platform/src/provider.ts",
        id: "provider-identifier-literal",
        line: 1,
        match: 'app_id: "cli_xxxxxxxxxxxxxxxxxxxx"'
      },
      {
        column: 18,
        file: "packages/platform/src/provider.ts",
        id: "provider-identifier-literal",
        line: 2,
        match: 'clientId: "client-1234567890"'
      },
      {
        column: 18,
        file: "packages/platform/src/provider.ts",
        id: "provider-identifier-literal",
        line: 3,
        match: 'folder_id: "fld_1234567890"'
      },
      {
        column: 18,
        file: "packages/platform/src/provider.ts",
        id: "provider-identifier-literal",
        line: 4,
        match: 'tenantKey: "tenant-1234567890"'
      }
    ]);
  });

  it("scans source roots while skipping generated output directories", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "typora-plus-hardcode-scan-"));
    tempRoots.push(workspaceRoot);
    await mkdir(join(workspaceRoot, "apps/demo/src"), { recursive: true });
    await mkdir(join(workspaceRoot, "apps/demo/dist"), { recursive: true });
    await writeFile(join(workspaceRoot, "apps/demo/src/provider.ts"), 'const request = { model: "gpt-live" };\n');
    await writeFile(join(workspaceRoot, "apps/demo/dist/generated.ts"), 'const endpoint = "https://api.openai.local";\n');

    const findings = await scanSensitiveHardcodes({ scanRoots: ["apps"], workspaceRoot });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      file: "apps/demo/src/provider.ts",
      id: "model-literal"
    });
  });

  it("scans script sources while skipping scanner fixtures", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "typora-plus-hardcode-scan-"));
    tempRoots.push(workspaceRoot);
    await mkdir(join(workspaceRoot, "scripts"), { recursive: true });
    await writeFile(join(workspaceRoot, "scripts", "check-sensitive-hardcodes.test.mjs"), [
      'const endpoint = "https://api.openai.local";',
      'const request = { model: "fixture-model" };'
    ].join("\n"));
    await writeFile(join(workspaceRoot, "scripts", "local-provider.mjs"), 'const request = { model: "script-model" };\n');

    const findings = await scanSensitiveHardcodes({ scanRoots: ["scripts"], workspaceRoot });

    expect(findings).toEqual([
      {
        column: 19,
        file: "scripts/local-provider.mjs",
        id: "model-literal",
        line: 1,
        match: 'model: "script-model"'
      }
    ]);
  });

  it("sorts workspace findings deterministically by file and source position", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "typora-plus-hardcode-scan-"));
    tempRoots.push(workspaceRoot);
    await mkdir(join(workspaceRoot, "packages/demo/src"), { recursive: true });
    await writeFile(join(workspaceRoot, "packages/demo/src/zProvider.ts"), 'const request = { model: "z-live" };\n');
    await writeFile(join(workspaceRoot, "packages/demo/src/aProvider.ts"), [
      'const endpoint = "https://api.openai.local";',
      'const request = { model: "a-live" };'
    ].join("\n"));

    const findings = await scanSensitiveHardcodes({ scanRoots: ["packages"], workspaceRoot });

    expect(findings.map(({ file, id }) => `${file}:${id}`)).toEqual([
      "packages/demo/src/aProvider.ts:provider-url",
      "packages/demo/src/aProvider.ts:model-literal",
      "packages/demo/src/zProvider.ts:model-literal"
    ]);
  });

  it("keeps file filtering, positions, and CLI finding formatting stable", () => {
    expect(shouldScanFile("provider.ts")).toBe(true);
    expect(shouldScanFile("README.md")).toBe(false);
    expect(getLineColumn("first\nsecond", 6)).toEqual({ column: 1, line: 2 });
    expect(
      sortSensitiveHardcodeFindings([
        {
          column: 1,
          file: "packages/z.ts",
          id: "model-literal",
          line: 1,
          match: 'model: "z"'
        },
        {
          column: 2,
          file: "packages/a.ts",
          id: "provider-url",
          line: 2,
          match: "https://api.openai.local"
        },
        {
          column: 1,
          file: "packages/a.ts",
          id: "model-literal",
          line: 2,
          match: 'model: "a"'
        }
      ]).map(({ file, column }) => `${file}:${column}`)
    ).toEqual(["packages/a.ts:1", "packages/a.ts:2", "packages/z.ts:1"]);
    expect(
      formatSensitiveHardcodeFinding({
        column: 19,
        file: "apps/demo/src/provider.ts",
        id: "model-literal",
        line: 1,
        match: 'model: "gpt-live"'
      })
    ).toBe('apps/demo/src/provider.ts:1:19 [model-literal] model: "gpt-live"');
  });

  it("reports successful CLI scans through the injected output boundary", async () => {
    const output = [];
    const errors = [];

    const exitCode = await runSensitiveHardcodeScanCli({
      scan: async () => [],
      writeError: (message) => errors.push(message),
      writeOutput: (message) => output.push(message)
    });

    expect(exitCode).toBe(0);
    expect(output).toEqual(["Sensitive hardcode scan passed."]);
    expect(errors).toEqual([]);
  });

  it("reports failing CLI scans with sorted findings and nonzero exit code", async () => {
    const output = [];
    const errors = [];

    const exitCode = await runSensitiveHardcodeScanCli({
      scan: async () => [
        {
          column: 1,
          file: "packages/z.ts",
          id: "model-literal",
          line: 1,
          match: 'model: "z"'
        },
        {
          column: 1,
          file: "packages/a.ts",
          id: "provider-url",
          line: 1,
          match: "https://api.openai.local"
        }
      ],
      writeError: (message) => errors.push(message),
      writeOutput: (message) => output.push(message)
    });

    expect(exitCode).toBe(1);
    expect(output).toEqual([]);
    expect(errors).toEqual([
      "Sensitive hardcode scan failed:",
      "packages/a.ts:1:1 [provider-url] https://api.openai.local",
      'packages/z.ts:1:1 [model-literal] model: "z"'
    ]);
  });
});
