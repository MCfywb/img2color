// Referer 校验：复刻原 Go 版的匹配语义（决策 D1 / D6，不重构匹配规则）。
//
// Go 版行为：
//   1) strings.Split(value, ",") 后 TrimSpace
//   2) 把 "." 替换为 "\."、"*" 替换为 ".*"
//   3) regexp.MatchString（未锚定，等价于子串匹配）
//   4) 空列表直接放行（注意：ALLOWED_REFERERS 为空串时 split 结果是 [""]，
//      其正则为空串，任何 referer 都能匹配，因此实际效果同为放行）
// Node 版逐条复刻，仅补充对非法正则的 try/catch（Go 的 MatchString 会返回 error + false）。

export function parseReferers(referers: string): string[] {
  return referers.split(",").map((item) => item.trim());
}

export function isRefererAllowed(referer: string, allowedReferers: string[]): boolean {
  if (allowedReferers.length === 0) return true;

  for (const allowed of allowedReferers) {
    const pattern = allowed.replaceAll(".", "\\.").replaceAll("*", ".*");
    try {
      if (new RegExp(pattern).test(referer)) return true;
    } catch {
      // 非法正则按 Go 的 err != nil 处理：视为不匹配
      continue;
    }
  }

  return false;
}
