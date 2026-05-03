import { requiredEnv, optionalEnv } from "./env.mjs";

const DEFAULT_BASE_URL = "https://open.feishu.cn";
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

let tenantTokenCache = null;

export class FeishuClient {
  constructor() {
    this.appId = requiredEnv("FEISHU_APP_ID");
    this.appSecret = requiredEnv("FEISHU_APP_SECRET");
    this.baseUrl = optionalEnv("FEISHU_BASE_URL", DEFAULT_BASE_URL);
  }

  async getTenantAccessToken(forceRefresh = false) {
    if (
      !forceRefresh &&
      tenantTokenCache &&
      tenantTokenCache.expiresAt > Date.now() + 60_000
    ) {
      return tenantTokenCache.value;
    }

    const url = new URL("/open-apis/auth/v3/tenant_access_token/internal", this.baseUrl);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": JSON_CONTENT_TYPE
      },
      body: JSON.stringify({
        app_id: this.appId,
        app_secret: this.appSecret
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.code !== 0) {
      const message = data.msg || data.message || response.statusText;
      throw new Error(`Failed to get tenant_access_token: ${data.code ?? response.status} ${message}`);
    }

    const expiresIn = Number(data.expire ?? 7200);
    tenantTokenCache = {
      value: data.tenant_access_token,
      expiresAt: Date.now() + expiresIn * 1000
    };
    return tenantTokenCache.value;
  }

  async apiRequest({ method, path, query, body, useTenantToken = true }) {
    const url = new URL(normalizeOpenApiPath(path), this.baseUrl);
    if (query && typeof query === "object") {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers = {
      "Content-Type": JSON_CONTENT_TYPE
    };

    if (useTenantToken) {
      headers.Authorization = `Bearer ${await this.getTenantAccessToken()}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || (data && data.code !== undefined && data.code !== 0)) {
      const message = data.msg || data.message || response.statusText;
      throw new Error(`Feishu API failed: ${data.code ?? response.status} ${message}`);
    }

    return data;
  }

  async sendText(chatId, text) {
    const chunks = splitMessage(text);
    const results = [];
    for (const chunk of chunks) {
      results.push(await this.apiRequest({
        method: "POST",
        path: "/im/v1/messages",
        query: {
          receive_id_type: "chat_id"
        },
        body: {
          receive_id: chatId,
          msg_type: "text",
          content: JSON.stringify({ text: chunk })
        }
      }));
    }
    return results;
  }
}

function normalizeOpenApiPath(path) {
  let normalized = path.trim();
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  if (!normalized.startsWith("/open-apis/")) {
    normalized = `/open-apis${normalized}`;
  }
  return normalized;
}

function splitMessage(text, maxLength = 3500) {
  const value = String(text || "").trim() || "(empty)";
  const chunks = [];
  for (let index = 0; index < value.length; index += maxLength) {
    chunks.push(value.slice(index, index + maxLength));
  }
  return chunks;
}
