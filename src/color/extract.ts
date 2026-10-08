// 颜色提取核心。对齐原 Go 版 extractMainColor 的处理链（决策 D2：Sharp 替代 Go 图像处理）。
//
// Go 版链路：http 下载 -> imaging.Decode -> nfnt/resize(宽 50, Lanczos3)
//            -> 遍历像素求 RGBA 平均值 -> colorful -> Hex()
// Node 版链路：fetchImage -> sharp.decode -> resize({width:50}) [libvips 默认 Lanczos3]
//            -> flatten(黑底) -> removeAlpha -> raw -> 求平均 -> #RRGGBB
//
// Alpha 处理说明：Go 的 image.Image.RGBA() 返回的是**预乘 alpha** 的分量，
// 原实现直接把预乘值参与平均（没有做反预乘），效果等价于「把透明像素按黑色参与平均」。
// 因此这里用 flatten({background: 黑色}) 复刻同一行为，而不是按可见颜色平均。

import { createHash } from "node:crypto";
import sharp from "sharp";
import { fetchImage } from "../fetch-image.ts";
import { getRedis } from "../cache.ts";
import { recordColor } from "../database.ts";
import { rgbToHex } from "./hex.ts";

export const RESIZE_WIDTH = 50;

/** 缓存键：MD5(URL) 的原始 16 字节再做标准 Base64 —— 与原 Go 版完全一致（D8）。 */
export function buildCacheKey(imageUrl: string): string {
  return createHash("md5").update(imageUrl, "utf8").digest("base64");
}

export async function averageColorHex(imageBuffer: Buffer): Promise<string> {
  const { data, info } = await sharp(imageBuffer)
    .resize({ width: RESIZE_WIDTH })
    .flatten({ background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const totalPixels = info.width * info.height;
  if (totalPixels === 0) throw new Error("图片解码后没有像素");

  const channels = info.channels;
  let r = 0;
  let g = 0;
  let b = 0;

  for (let offset = 0; offset < data.length; offset += channels) {
    r += data[offset] as number;
    g += data[offset + 1] as number;
    b += data[offset + 2] as number;
  }

  // Go 版是 uint32 累加后做整数除法（截断），这里同样向下取整以贴近其结果。
  return rgbToHex(
    Math.floor(r / totalPixels),
    Math.floor(g / totalPixels),
    Math.floor(b / totalPixels),
  );
}

export async function extractMainColor(imageUrl: string): Promise<string> {
  const cacheKey = buildCacheKey(imageUrl);
  const redis = await getRedis();

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return cached;
    } catch (err) {
      console.warn(`[color] 读取缓存失败：${(err as Error).message}`);
    }
  }

  const imageBuffer = await fetchImage(imageUrl);
  const colorHex = await averageColorHex(imageBuffer);

  if (redis) {
    try {
      // 原 Go 版 TTL 传 0（永不过期），这里保持一致（风险登记见 RISKS R5）。
      await redis.set(cacheKey, colorHex);
    } catch (err) {
      console.warn(`[color] 写入缓存失败：${(err as Error).message}`);
    }
  }

  // Go 版在返回前写入 MongoDB，失败仅打日志；这里同样 await 但不让错误冒泡（Serverless 需要等待完成）。
  await recordColor(imageUrl, colorHex);

  return colorHex;
}
