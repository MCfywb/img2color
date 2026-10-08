// 环境变量配置。变量名与原 Go 版保持一致（决策 D8），不改名、不新增必填项。
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseReferers } from "./referer.ts";

/**
 * 极简 .env 加载（等价于 Go 版 godotenv 从 cwd 读 .env 的行为）。
 * 与 Go 版的差异是刻意的：Go 版在加载失败时直接 return，导致后续环境变量一行都不读（见 RISKS R1）；
 * 这里加载失败只告警，仍然继续读取进程环境变量（AGENTS.md 明确禁止复制该缺陷）。
 */
function loadEnvFile(): void {
  const file = resolve(process.cwd(), ".env");
  if (!existsSync(file)) return;
  try {
    for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const idx = line.indexOf("=");
      if (idx <= 0) continue;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch (err) {
    console.warn(`[config] 加载 .env 失败，继续读取环境变量：${(err as Error).message}`);
  }
}

loadEnvFile();

export interface Config {
  redisEnabled: boolean;
  redisAddress: string;
  redisPassword: string;
  redisDb: number;
  mongoEnabled: boolean;
  mongoUri: string;
  mongoDb: string;
  port: number;
  allowedReferers: string[];
}

/** 每次调用都实时读取，便于测试与 Serverless 环境下的变量更新。 */
export function getConfig(): Config {
  const port = Number.parseInt(process.env.PORT ?? "", 10);
  const redisDb = Number.parseInt(process.env.REDIS_DB ?? "", 10);

  return {
    redisEnabled: (process.env.USE_REDIS_CACHE ?? "") === "true",
    redisAddress: process.env.REDIS_ADDRESS ?? "",
    redisPassword: process.env.REDIS_PASSWORD ?? "",
    redisDb: Number.isNaN(redisDb) ? 0 : redisDb,
    mongoEnabled: (process.env.USE_MONGODB ?? "") === "true",
    mongoUri: process.env.MONGO_URI ?? "",
    mongoDb: process.env.MONGO_DB ?? "",
    port: Number.isNaN(port) ? 3000 : port,
    allowedReferers: parseReferers(process.env.ALLOWED_REFERERS ?? ""),
  };
}
