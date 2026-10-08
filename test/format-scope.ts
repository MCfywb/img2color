// 格式范围验证：确认 Node 版实际能解码哪些图片格式。
// 背景：决策 D5 要求「不新增图片格式支持（不含 AVIF / GIF / TIFF / SVG）」，
// 但 sharp 会自动嗅探多种格式，因此需要确认是否无意扩大了能力范围。
//
// 用法：node test/format-scope.ts

import sharp from "sharp";
import { averageColorHex } from "../src/color/extract.ts";

interface FormatCase {
  name: string;
  /** 生成该格式样本的缓冲区；失败表示该格式无法编码（不代表无法解码） */
  build: () => Promise<Buffer>;
  /** 是否属于「允许」的对外格式（D5 + D13：JPG / PNG / WebP） */
  allowed: boolean;
}

const base = sharp({
  create: { width: 120, height: 80, channels: 3, background: { r: 40, g: 90, b: 160 } },
});

const SAMPLE_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80">' +
    '<rect width="120" height="80" fill="#285aa0"/></svg>',
);

const cases: FormatCase[] = [
  { name: "JPEG", allowed: true, build: () => base.clone().jpeg().toBuffer() },
  { name: "PNG", allowed: true, build: () => base.clone().png().toBuffer() },
  { name: "WebP", allowed: true, build: () => base.clone().webp().toBuffer() },
  { name: "GIF", allowed: false, build: () => base.clone().gif().toBuffer() },
  { name: "TIFF", allowed: false, build: () => base.clone().tiff().toBuffer() },
  { name: "AVIF", allowed: false, build: () => base.clone().avif().toBuffer() },
  { name: "JPEG2000 (jp2)", allowed: false, build: () => base.clone().jp2().toBuffer() },
  { name: "HEIF", allowed: false, build: () => base.clone().heif().toBuffer() },
  { name: "SVG", allowed: false, build: async () => SAMPLE_SVG },
  { name: "非图片（乱数据）", allowed: false, build: async () => Buffer.from("not an image at all") },
];

console.log("== 格式范围探测（本地合成 sample -> 走 averageColorHex）==\n");
console.log("| 格式 | 是否被解码 | 结果 | 与 D5/D13 是否一致 |");
console.log("|---|---|---|---|");

const unexpected: string[] = [];

for (const item of cases) {
  let buffer: Buffer;
  try {
    buffer = await item.build();
  } catch (err) {
    console.log(`| ${item.name} | — | 样本无法生成：${(err as Error).message.slice(0, 40)} | — |`);
    continue;
  }

  try {
    const hex = await averageColorHex(buffer);
    const consistent = item.allowed;
    if (!consistent) unexpected.push(item.name);
    console.log(`| ${item.name} | ✅ 能解码 | ${hex} | ${consistent ? "一致" : "**不一致（超出允许范围）**"} |`);
  } catch {
    const consistent = item.allowed;
    if (!consistent) {
      // 未被解码且本身不在允许范围内 -> 正常
    } else {
      unexpected.push(`${item.name}(本应支持却被拒)`);
    }
    console.log(`| ${item.name} | ❌ 拒绝 | ${"错误退出"} | ${item.allowed ? "**不一致（本该支持）**" : "一致"} |`);
  }
}

console.log(
  `\n超出「JPG / PNG / WebP」范围但仍被接受的格式：${unexpected.length > 0 ? unexpected.join("、") : "无"}`,
);
