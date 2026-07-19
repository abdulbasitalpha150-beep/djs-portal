import { ZodError } from "zod";

export function jsonResponse(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify({ success: true, data, error: null }), {
    status: init.status ?? 200,
    headers,
  });
}

export function errorResponse(error: string | Error, status = 400, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  const message = error instanceof Error ? error.message : error;
  return new Response(JSON.stringify({ success: false, data: null, error: message }), {
    status,
    headers,
  });
}

export async function parseJson(request: Request) {
  try {
    return await request.json();
  } catch (error) {
    throw new Error("Request body must be valid JSON");
  }
}

export function parseZod<T>(schema: { parse: (input: unknown) => T }, value: unknown) {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(
        error.errors.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
      );
    }
    throw error;
  }
}
