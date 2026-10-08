// RGB -> #RRGGBB。与原 Go 版 go-colorful 的 Hex() 输出保持一致（小写十六进制、6 位）。

function componentToHex(value: number): string {
  const clamped = Math.min(255, Math.max(0, value));
  return Math.trunc(clamped).toString(16).padStart(2, "0");
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}
