export interface StatementDelimiterDocument {
  readonly length: number;
  sliceString(from: number, to: number): string;
}

type StatementDelimiterSource = string | StatementDelimiterDocument;

export function trailingStatementDelimiterPosition(source: StatementDelimiterSource, rangeTo: number): number | null {
  let delimiterPos = rangeTo;
  let lineBreakCount = 0;
  while (delimiterPos < source.length) {
    const char = sliceSource(source, delimiterPos, delimiterPos + 1);
    if (!/\s/u.test(char)) break;
    if (char === "\n" && ++lineBreakCount > 1) return null;
    delimiterPos += 1;
  }
  return sliceSource(source, delimiterPos, delimiterPos + 1) === ";" ? delimiterPos : null;
}

export function cursorBelongsToTrailingStatementDelimiter(source: StatementDelimiterSource, rangeTo: number, cursorPos: number): boolean {
  if (cursorPos < rangeTo) return false;
  const delimiterPos = trailingStatementDelimiterPosition(source, rangeTo);
  if (delimiterPos === null) return false;
  if (cursorPos <= delimiterPos + 1) return true;

  const afterDelimiter = sliceSource(source, delimiterPos + 1, cursorPos);
  // 光标必须和分号保持在同一行，避免把跨行的光标误判给上一条语句
  if (afterDelimiter.includes("\n")) return false;
  // 分号到光标之间允许是空白或同一行的尾部注释（如 `SELECT 1; -- 备注`），
  // 否则行尾注释后的光标会被下一条语句的前置区域错误认领
  return trailingGapIsWhitespaceOrComment(afterDelimiter);
}

/**
 * 判断语句分号与光标之间的间隙是否只包含空白和注释。
 * 间隙中不允许出现换行（调用方已保证），因此行注释一旦开始就覆盖到间隙末尾。
 */
function trailingGapIsWhitespaceOrComment(gap: string): boolean {
  let i = 0;
  while (i < gap.length) {
    const ch = gap[i] ?? "";
    const next = gap[i + 1] ?? "";

    // 普通空白直接跳过
    if (ch === " " || ch === "\t" || ch === "\r") {
      i += 1;
      continue;
    }

    // 行注释：`--`（SQL 标准）或 `//`（MongoDB shell），其后内容直到行尾都是注释
    if ((ch === "-" && next === "-") || (ch === "/" && next === "/")) return true;

    // `#` 行注释（MySQL 等），但 `#{` 是 MyBatis 参数语法，不是注释
    if (ch === "#" && next !== "{") return true;

    // 块注释 /* ... */：跳过整段后继续检查剩余间隙
    if (ch === "/" && next === "*") {
      const close = gap.indexOf("*/", i + 2);
      // 未闭合的块注释：剩余部分全部视为注释
      if (close === -1) return true;
      i = close + 2;
      continue;
    }

    // 出现其他实际内容，说明光标后面还有语句文本，不能归属上一条语句
    return false;
  }
  return true;
}

function sliceSource(source: StatementDelimiterSource, from: number, to: number): string {
  return typeof source === "string" ? source.slice(from, to) : source.sliceString(from, to);
}
