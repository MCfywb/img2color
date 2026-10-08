// WebP 支持验证（决策 D13：Node 版**保留** WebP 支持）。
//
// 两部分：
//   A) 本地合成样本：用 sharp 现场编码出 lossy / lossless / 带 alpha 的 WebP，
//      验证 averageColorHex 能正确解码并给出预期色值（不依赖网络）。
//   B) 远程样本：从公开 WebP 链接取色（这些链接在线上 Go 版均返回 500）。
//
// 用法：node test/webp-support.ts

import sharp from "sharp";
import { averageColorHex, extractMainColor } from "../src/color/extract.ts";

interface RemoteCase {
  name: string;
  url: string;
}

const REMOTE_CASES: RemoteCase[] = [
  { name: "lossy-1", url: "https://www.gstatic.com/webp/gallery/1.webp" },
  { name: "lossy-2", url: "https://www.gstatic.com/webp/gallery/2.webp" },
  { name: "lossy-3", url: "https://www.gstatic.com/webp/gallery/3.webp" },
  { name: "lossy-4", url: "https://www.gstatic.com/webp/gallery/4.webp" },
  { name: "lossy-5", url: "https://www.gstatic.com/webp/gallery/5.webp" },
  { name: "lossless", url: "https://www.gstatic.com/webp/gallery3/1_webp_ll.webp" },
  { name: "elemecdn.webp", url: "https://npm.elemecdn.com/anzhiyu-blog@1.1.6/img/post/banner/神里.webp" },
];

function hexDistance(a: string, b: string): number {
  const parse = (hex: string): [number, number, number] => [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  return Math.max(Math.abs(ar - br), Math.abs(ag - bg), Math.abs(ab - bb));
}

console.log("== A) 本地合成 WebP 样本 ==\n");

// 纯色：期望返回接近该颜色本身；带 alpha 的样本按「合成到黑底」口径（与 Go 版一致）。
const solid = Buffer.from(
  await sharp({
    create: { width: 120, height: 80, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .webp({ quality: 90 })
    .toBuffer(),
);
const lossless = Buffer.from(
  await sharp({
    create: { width: 120, height: 80, channels: 3, background: { r: 20, g: 160, b: 220 } },
  })
    .webp({ lossless: true })
    .toBuffer(),
);
// 半透明红色覆盖在透明背景上 -> 平均后应接近 rgba(255,0,0,0.5) 合成到黑的结果 #800000
const withAlpha = Buffer.from(
  await sharp({
    create: {
      width: 120,
      height: 80,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 0.5 },
    },
  })
    .webp({ lossless: true })
    .toBuffer(),
);

const localCases: Array<{ name: string; buffer: Buffer; expected: string }> = [
  { name: "纯色 lossy(q90)", buffer: solid, expected: "#c86432" },
  { name: "纯色 lossless", buffer: lossless, expected: "#14a0dc" },
  { name: "半透明红 → 黑底合成", buffer: withAlpha, expected: "#800000" },
];

let localPassed = 0;
for (const item of localCases) {
  try {
    const actual = await averageColorHex(item.buffer);
    const drift = hexDistance(actual, item.expected);
    const ok = drift <= 4;
    if (ok) localPassed += 1;
    console.log(
      `${ok ? "✅" : "❌"} ${item.name}: 期望≈${item.expected}，实际=${actual}，最大通道偏差=${drift}`,
    );
  } catch (err) {
    console.log(`❌ ${item.name}: 失败 ${(err as Error).message}`);
  }
}
console.log(`\n本地样本：${localPassed}/${localCases.length} 通过\n`);

console.log("== B) 远程 WebP 链接（Go 版对这些链接均返回 500）==\n");
let remotePassed = 0;
for (const item of REMOTE_CASES) {
  const started = Date.now();
  try {
    const hex = await extractMainColor(item.url);
    const ok = /^#[0-9a-f]{6}$/i.test(hex);
    if (ok) remotePassed += 1;
    console.log(`${ok ? "✅" : "❌"} ${item.name} -> ${hex}（${Date.now() - started}ms）`);
  } catch (err) {
    console.log(`❌ ${item.name} -> 失败：${(err as Error).message}`);
  }
}
console.log(`\n远程样本：${remotePassed}/${REMOTE_CASES.length} 通过`);
