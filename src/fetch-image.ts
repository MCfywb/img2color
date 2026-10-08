// 远程图片下载。保持 Go 版的 User-Agent（D1/D5 范围内，不改变请求行为）。
//
// 与 Go 版的一处有意差异：Go 版使用 http.DefaultClient，**没有超时**；
// 这里加了 15s 超时，避免 Serverless 下无限等待（Serverless 适配，非功能变更）。

export const IMAGE_FETCH_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 Edg/115.0.1901.253";

const FETCH_TIMEOUT_MS = 15_000;

export async function fetchImage(imageUrl: string): Promise<Buffer> {
  const response = await fetch(imageUrl, {
    method: "GET",
    headers: { "User-Agent": IMAGE_FETCH_USER_AGENT },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  return Buffer.from(await response.arrayBuffer());
}
