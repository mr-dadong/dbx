import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/backend/safeStorage";

// 连接加密导出密码短语的本地存储 key
const EXPORT_PASSPHRASE_STORAGE_KEY = "dbx-config-export-passphrase";

// 读取上次加密导出时使用的密码短语，没有保存过则返回空字符串
export function loadSavedExportPassphrase(): string {
  return safeLocalStorageGet(EXPORT_PASSPHRASE_STORAGE_KEY) ?? "";
}

// 保存本次加密导出使用的密码短语，下次打开加密导出对话框时自动回显（掩码显示）
export function saveExportPassphrase(passphrase: string) {
  safeLocalStorageSet(EXPORT_PASSPHRASE_STORAGE_KEY, passphrase);
}
