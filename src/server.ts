// 自托管 HTTP 服务（等价原 Go 版 main()，用于「服务器部署」方式）。
// 线上 Vercel 走 api/index.ts，不经过本文件。

import { createServer } from "node:http";
import { getConfig } from "./config.ts";
import { handleImageColor } from "./handler.ts";

const { port } = getConfig();

createServer((req, res) => {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  if (pathname !== "/api") {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 page not found\n");
    return;
  }
  void handleImageColor(req, res);
}).listen(port, () => {
  console.log(`服务器监听在：${port}...`);
});
