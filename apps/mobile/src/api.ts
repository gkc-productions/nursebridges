import type { Session } from "@supabase/supabase-js";
import type { ApiErrorResponse, ApiIssue } from "./types";

function createRequestId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `mobile-${Date.now().toString(36)}-${random}`;
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export class ApiRequestError extends Error {
  status: number;
  issues: ApiIssue[];
  requestId: string | null;

  constructor(status: number, response: ApiErrorResponse, fallbackRequestId: string) {
    super(response.error || "Request failed.");
    this.name = "ApiRequestError";
    this.status = status;
    this.issues = response.issues ?? [];
    this.requestId = response.requestId ?? fallbackRequestId;
  }
}

export function formatApiErrorMessage(fallback: string, err: unknown) {
  if (!(err instanceof ApiRequestError)) {
    return fallback;
  }

  const issueMessages = err.issues.map((issue) => {
    const path = issue.path?.trim();
    return path ? `${path}: ${issue.message}` : issue.message;
  });
  const reference = err.requestId ? `Reference: ${err.requestId}` : "";

  return [err.message, ...issueMessages, reference].filter(Boolean).join("\n") || fallback;
}

export async function apiFetch<T>(
  baseUrl: string,
  session: Session | null,
  path: string,
  init: RequestInit = {}
) {
  if (!session) throw new Error("Sign in required.");
  if (!baseUrl) throw new Error("API URL is not configured.");

  const requestId = createRequestId();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  headers.set("x-request-id", requestId);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const data = await readJson<T & ApiErrorResponse>(res);

  if (!res.ok) {
    const error = new ApiRequestError(res.status, data, requestId);
    console.warn("API request failed", {
      path,
      status: error.status,
      requestId: error.requestId,
      error: error.message,
      issues: error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message
      }))
    });
    throw error;
  }

  return data as T;
}
