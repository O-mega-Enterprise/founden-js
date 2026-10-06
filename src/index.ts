/**
 * Founden TypeScript SDK.
 *
 * Usage:
 *   import { Founden } from "founden";
 *
 *   const client = new Founden("omk_your_key_here");
 *
 *   const build = await client.build("Build a booking site for my dental clinic");
 *   const id = build.data!.execution_id as string;
 *   for await (const ev of client.stream(id)) console.log(ev.data);
 *   const status = await client.status(id);
 *   await client.message(id, "Add a contact form on the homepage");
 *
 * All convenience methods (build, status, message, stop) are auto-generated from
 * founden-capabilities.json.
 */

import { bindGeneratedMethods, type GeneratedMethods } from "./generated.js";

export interface FoundenResult {
  success: boolean;
  data: Record<string, unknown> | null;
  error: { type?: string; title?: string; detail?: string; is_retriable?: boolean } | null;
  metadata: { request_id?: string } | null;
  credits_used: number;
}

export class Founden {
  private apiKey: string;
  private baseUrl: string;

  // Generated convenience methods are bound in the constructor
  [key: string]: any;

  constructor(apiKey: string, baseUrl = "https://founden.ai") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");

    // Bind all auto-generated convenience methods
    const generated = bindGeneratedMethods(this);
    for (const [name, fn] of Object.entries(generated)) {
      if (!(name in this)) {
        (this as any)[name] = fn;
      }
    }
  }

  /**
   * Stream real-time build events via SSE.
   * Yields objects like: { event: "build_step", data: { type: "build_step", ... } }.
   * The cloud build sends data-only SSE frames; the event name is also on data.type.
   * Event types: build_step, build_complete, build_done, orphaned_build, build_error.
   */
  async *stream(executionId: string): AsyncGenerator<{ event: string; data: unknown }> {
    const url = `${this.baseUrl}/v1/builds/${executionId}/stream`;
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "text/event-stream",
      },
    });

    if (!resp.ok || !resp.body) {
      throw new Error(`Stream failed: HTTP ${resp.status}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentEvent = "";
    let currentData = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7);
        } else if (line.startsWith("data: ")) {
          currentData = line.slice(6);
        } else if (line === "" && currentData) {
          try {
            const parsed = JSON.parse(currentData) as Record<string, unknown>;
            const evName = currentEvent || (typeof parsed.type === "string" ? parsed.type : "message");
            yield { event: evName, data: parsed };
          } catch {
            yield { event: currentEvent || "message", data: currentData };
          }
          currentEvent = "";
          currentData = "";
        }
      }
    }
  }

  /** Make an HTTP request to the Founden API. */
  async request(
    method: string,
    path: string,
    params: Record<string, unknown> = {},
  ): Promise<FoundenResult> {
    // Substitute path parameters (e.g. /v1/builds/{execution_id})
    let resolvedPath = path;
    const remainingParams = { ...params };
    const pathParams = path.match(/\{(\w+)\}/g) || [];
    for (const pp of pathParams) {
      const paramName = pp.slice(1, -1);
      resolvedPath = resolvedPath.replace(pp, String(remainingParams[paramName] || ""));
      delete remainingParams[paramName];
    }

    let url = `${this.baseUrl}${resolvedPath}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };

    const fetchOpts: RequestInit = { method: method.toUpperCase(), headers };

    if (method === "GET" || method === "DELETE") {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(remainingParams)) {
        if (v !== undefined && v !== null) qs.set(k, String(v));
      }
      const qsStr = qs.toString();
      if (qsStr) url += `?${qsStr}`;
    } else {
      fetchOpts.body = JSON.stringify(remainingParams);
    }

    const resp = await fetch(url, fetchOpts);
    const body = await resp.json() as any;

    // Handle non-envelope responses (401, 429, etc.)
    if (body.detail && body.success === undefined) {
      const detail = typeof body.detail === "object"
        ? body.detail
        : { title: String(body.detail), status: resp.status };
      return { success: false, data: null, error: detail, metadata: null, credits_used: 0 };
    }

    return {
      success: body.success ?? true,
      data: body.data ?? null,
      error: body.error ?? null,
      metadata: body.metadata ?? null,
      credits_used: body.credits_used ?? 0,
    };
  }
}
