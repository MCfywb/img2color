// MongoDB 落库（决策 D8：保留能力，库集合与字段结构不变）。
// 实例化策略：模块级单例 + 连接复用（决策 D9）。

import { MongoClient, type Collection } from "mongodb";
import { getConfig } from "./config.ts";

export const COLORS_COLLECTION = "colors";

export interface ColorRecord {
  url: string;
  color: string;
}

let client: MongoClient | null = null;
let collection: Collection<ColorRecord> | null = null;
let connecting: Promise<Collection<ColorRecord> | null> | null = null;

/** 未启用或不可用时返回 null；失败只记录日志，不影响主流程。 */
export async function getColorsCollection(): Promise<Collection<ColorRecord> | null> {
  const config = getConfig();
  if (!config.mongoEnabled) return null;
  if (collection) return collection;
  if (connecting) return connecting;

  connecting = (async () => {
    try {
      const next = new MongoClient(config.mongoUri);
      await next.connect();
      client = next;
      collection = next.db(config.mongoDb).collection<ColorRecord>(COLORS_COLLECTION);
      return collection;
    } catch (err) {
      console.warn(`[database] MongoDB 不可用，本次不落库：${(err as Error).message}`);
      return null;
    } finally {
      connecting = null;
    }
  })();

  return connecting;
}

/** 写入 {url, color}。任何失败都只记录日志（与原 Go 版一致）。 */
export async function recordColor(url: string, color: string): Promise<void> {
  try {
    const colors = await getColorsCollection();
    if (!colors) return;
    await colors.insertOne({ url, color });
  } catch (err) {
    console.warn(`[database] 写入 MongoDB 失败：${(err as Error).message}`);
  }
}

export async function closeMongo(): Promise<void> {
  if (client) await client.close();
  client = null;
  collection = null;
}
