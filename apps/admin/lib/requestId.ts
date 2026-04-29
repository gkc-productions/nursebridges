import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export function getRequestId(request: NextRequest) {
  return request.headers.get("x-request-id") || randomUUID();
}

export function adminJson(request: NextRequest, body: unknown, init: ResponseInit = {}) {
  const requestId = getRequestId(request);
  const headers = new Headers(init.headers);
  headers.set("x-request-id", requestId);

  const responseBody =
    body && typeof body === "object" && "error" in body && !("requestId" in body)
      ? { ...(body as Record<string, unknown>), requestId }
      : body;

  return NextResponse.json(responseBody, { ...init, headers });
}
