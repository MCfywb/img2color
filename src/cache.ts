// Redis 缓存（决策 D8：保留能力，变量名与键算法不变）。
// 实例化策略：模块级单例 + 连接复用（决策 D9），不是每请求新建连接。

import { createClient, type RedisClientType } from "redis";
import { getConfig } from "./config.ts";

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType | null> | null = null;

function parseAddress(address: string): { host: string; port: number } {
  const idx = address.lastIndexOf(":");
  if (idx === -1) return { host: address, port: 6379 };
  const port = Number.parseInt(address.slice(idx + 1), 10);
  return { host: address.slice(0, idx), port: Number.isNaN(port) ? 6379 : port };
}

/** 未启用或不可用时返回 null，调用方降级为「无缓存」，不得抛错中断请求。 */
export async function getRedis(): Promise<RedisClientType | null> {
  const config = getConfig();
  if (!config.redisEnabled) return null;
  if (client?.isReady) return client;
  if (connecting) return connecting;

  connecting = (async () => {
    try {
      const { host, port } = parseAddress(config.redisAddress);
      const next = createClient({
        socket: { host, port },
        password: config.redisPassword || undefined,
        database: config.redisDb,
      }) as RedisClientType;

      next.on("error", (err: Error) => {
        console.warn(`[cache] Redis 连接错误：${err.message}`);
      });

      await next.connect();
      client = next;
      return next;
    } catch (err) {
      console.warn(`[cache] Redis 不可用，本次请求不使用缓存：${(err as Error).message}`);
      return null;
    } finally {
      connecting = null;
    }
  })();

  return connecting;
}

/** 关闭连接（供自托管场景退出时使用；Serverless 不需要调用）。 */
export async function closeRedis(): Promise<void> {
  if (client?.isOpen) await client.quit();
  client = null;
}
