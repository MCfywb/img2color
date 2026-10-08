// Vercel Node.js Function 入口：GET /api?img=<url>
// 与原 Go 版一致：路径仍是 /api，方法仍是 GET（D1 / D5，不新增路由）。

import type { IncomingMessage, ServerResponse } from "node:http";
import { handleImageColor } from "../src/handler.ts";

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await handleImageColor(req, res);
}
