import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";

test("data grid selection colors stay on the classic blue palette", () => {
  const source = readFileSync("apps/desktop/src/components/grid/DataGrid.vue", "utf8");
  assert.match(source, /--data-grid-cell-selected-bg:\s*rgb\(239,\s*246,\s*255\)/);
  assert.match(source, /--data-grid-cell-selected-border:\s*rgb\(59,\s*130,\s*246\)/);
  assert.match(source, /"--data-grid-cell-selected-bg":\s*dark \? "rgb\(20, 40, 60\)" : "rgb\(239, 246, 255\)"/);
  assert.doesNotMatch(source, /--data-grid-cell-selected-border:\s*color-mix\(in srgb, var\(--ring\)/);
  assert.doesNotMatch(source, /--data-grid-cell-selected-bg:\s*color-mix\(in srgb, var\(--primary\)/);
});

test("whole-row selection keeps its own deeper tokens in both render modes", () => {
  const source = readFileSync("apps/desktop/src/components/grid/DataGrid.vue", "utf8");
  // DOM 模式：整行选中使用专属深色 token（亮色 blue-300 / 暗色加深蓝）
  assert.match(source, /--data-grid-row-selected-bg:\s*rgb\(147,\s*197,\s*253\)/);
  assert.match(source, /--data-grid-row-selected-bg:\s*rgb\(37,\s*78,\s*116\)/);
  assert.match(source, /"--data-grid-row-selected-bg":\s*dark \? "rgb\(37, 78, 116\)" : "rgb\(147, 197, 253\)"/);
  assert.match(source, /--data-grid-row-selected-dirty-bg:\s*rgb\(216,\s*213,\s*158\)/);
  assert.match(source, /\.row-cell-selected\s*\{\s*background-color:\s*var\(--data-grid-row-selected-bg\) !important;/);
  assert.match(source, /\.row-cell-selected-dirty\s*\{\s*background-color:\s*var\(--data-grid-row-selected-dirty-bg\) !important;/);
  // 选区覆盖淡色指示保持原浅色，不随整行选中加深
  assert.match(source, /\.data-grid-row-number--in-selection\s*\{\s*background-color:\s*var\(--data-grid-cell-selected-bg\);/);
});
