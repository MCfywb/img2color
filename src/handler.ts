// HTTP 处理层：与原 Go 版 handleImageColor 保持逐条一致（D1）。
//   - 所有响应先写三个 CORS 头
//   - OPTIONS -> 200 空响应
//   - Referer 不允许 -> 403 "禁止访问"
//   - 缺少 img -> 400 "缺少img参数"
//   - 处理失败 -> 500 "提取主色调失败：<message>"
//   - 成功 -> 200 {"RGB":"#xxxxxx"}

import type { IncomingMessage, ServerResponse } from "node:http";
import { getConfig } from "./config.ts";
import { isRefererAllowed } from "./referer.ts";
import { extractMainColor } from "./color/extract.ts";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Referer",
};

export async function handleImageColor(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const referer = req.headers.referer ?? "";
  if (!isRefererAllowed(referer, getConfig().allowedReferers)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    // 原 Go 版用 http.Error，响应体带换行结尾；这里补齐以保证逐字节一致。
    res.end("禁止访问\n");
    return;
  }

  const imageUrl = new URL(req.url ?? "/", "http://localhost").searchParams.get("img") ?? "";
  if (imageUrl === "") {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("缺少img参数\n");
    return;
  }

  try {
    const color = await extractMainColor(imageUrl);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(`${JSON.stringify({ RGB: color })}\n`);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`提取主色调失败：${(err as Error).message}\n`);
  }
}
