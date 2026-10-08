// 兼容性对比：线上 Go 版（https://color.mcfywb.top/api） vs 本地 Node.js 版（直接调用 extractMainColor）。
// 验收口径依据决策 D3：允许小幅 RGB 误差，用 RGB 欧氏距离 + Delta E(CIE76) 衡量。
//
// 用法：node test/compare-live.ts [图片URL ...]

import { extractMainColor } from "../src/color/extract.ts";

const LIVE_BASE = "https://color.mcfywb.top/api";

// 样本覆盖：普通 JPG / 灰度 JPG / 超大图 / 极小图 / 含透明通道 PNG / WebP。
// 说明：其中的 WebP 样本用于暴露「Go 版实际不支持 WebP」的差异，见 RISKS R3。
const DEFAULT_URLS = [
  "https://picsum.photos/id/1015/400/300",
  "https://picsum.photos/id/237/400/300",
  "https://picsum.photos/id/1074/400/300",
  "https://picsum.photos/id/1015/400/300?grayscale",
  "https://picsum.photos/id/10/2500/1600",
  "https://picsum.photos/id/1/10/10",
  "https://www.gstatic.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png",
  "https://img.shields.io/badge/test-blue.png?style=flat-square",
  "https://www.gstatic.com/webp/gallery/1.webp",
  "https://www.gstatic.com/webp/gallery3/1_webp_ll.webp",
  "https://npm.elemecdn.com/anzhiyu-blog@1.1.6/img/post/banner/神里.webp",
];

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function srgbToLab([r, g, b]: [number, number, number]): [number, number, number] {
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [rr, gg, bb] = [channel(r), channel(g), channel(b)];
  const x = (rr * 0.4124 + gg * 0.3576 + bb * 0.1805) / 0.95047;
  const y = rr * 0.2126 + gg * 0.7152 + bb * 0.0722;
  const z = (rr * 0.0193 + gg * 0.1192 + bb * 0.9505) / 1.08883;
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE(hexA: string, hexB: string): number {
  const a = srgbToLab(parseHex(hexA));
  const b = srgbToLab(parseHex(hexB));
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function rgbDistance(hexA: string, hexB: string): number {
  const a = parseHex(hexA);
  const b = parseHex(hexB);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

async function callLive(imageUrl: string): Promise<{ status: number; body: string }> {
  const target = `${LIVE_BASE}?img=${encodeURIComponent(imageUrl)}`;
  const res = await fetch(target, { signal: AbortSignal.timeout(30_000) });
  return { status: res.status, body: (await res.text()).trim() };
}

const urls = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_URLS;

console.log(`对比对象：线上 Go 版 ${LIVE_BASE} × Node.js ${process.version}`);
console.log(`样本数：${urls.length}\n`);

const rows: string[] = [];
let compared = 0;
let maxDeltaE = 0;

for (const url of urls) {
  const short = url.length > 52 ? `${url.slice(0, 49)}...` : url;
  let goResult: string;
  try {
    const live = await callLive(url);
    goResult = live.status === 200 ? (JSON.parse(live.body) as { RGB: string }).RGB : `HTTP ${live.status}`;
  } catch (err) {
    goResult = `请求失败：${(err as Error).message}`;
  }

  let nodeResult: string;
  try {
    nodeResult = await extractMainColor(url);
  } catch (err) {
    nodeResult = `失败：${(err as Error).message}`;
  }

  const isHex = (value: string): boolean => /^#[0-9a-f]{6}$/i.test(value);
  let metric = "n/a";
  if (isHex(goResult) && isHex(nodeResult)) {
    const de = deltaE(goResult, nodeResult);
    const dist = rgbDistance(goResult, nodeResult);
    maxDeltaE = Math.max(maxDeltaE, de);
    compared += 1;
    metric = `ΔE=${de.toFixed(2)} / dist=${dist.toFixed(2)}`;
  }

  rows.push(`| ${short} | ${goResult} | ${nodeResult} | ${metric} |`);
}

console.log("| 图片 URL | Go（线上） | Node（本地） | 色差 |");
console.log("|---|---|---|---|");
console.log(rows.join("\n"));
console.log(`\n可比样本：${compared}/${urls.length}，最大 ΔE = ${maxDeltaE.toFixed(2)}`);
console.log("参考口径（D3）：ΔE < 2 基本看不出差异，ΔE < 5 可接受，用于博客主题色场景足够。");
