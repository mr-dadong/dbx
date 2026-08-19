<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Lock } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import PasswordInput from "@/components/ui/PasswordInput.vue";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { loadSavedExportPassphrase } from "@/lib/backend/exportPassphraseStorage";

const props = defineProps<{
  open: boolean;
  mode: "export" | "import";
  externalError?: string;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  confirm: [passphrase: string];
}>();

const { t } = useI18n();
const dialogOpen = computed({
  get: () => props.open,
  set: (v) => emit("update:open", v),
});

const passphrase = ref("");
const error = ref("");
// 密码输入框组件引用，用于打开对话框时手动聚焦
const passphraseInput = ref<InstanceType<typeof PasswordInput> | null>(null);

// 打开对话框时手动聚焦输入框，并把光标定位到末尾（不选中已回显的内容，避免误输入时覆盖已保存的密码）
onMounted(async () => {
  await nextTick();
  const inputEl = passphraseInput.value?.$el?.querySelector("input");
  inputEl?.focus();
  const length = String(inputEl?.value ?? "").length;
  inputEl?.setSelectionRange(length, length);
});

watch(
  dialogOpen,
  (open) => {
    if (open) {
      // 导出模式自动回显上次使用的密码短语（PasswordInput 默认掩码显示，可点眼睛图标查看明文）；导入模式始终从空开始
      passphrase.value = props.mode === "export" ? loadSavedExportPassphrase() : "";
      error.value = "";
    }
  },
  { immediate: true },
);

function confirm() {
  if (!passphrase.value) {
    error.value = t("configExport.passphraseRequired");
    return;
  }
  if (props.mode === "export" && passphrase.value.length < 4) {
    error.value = t("configExport.passphraseTooShort");
    return;
  }
  emit("confirm", passphrase.value);
}

const displayError = computed(() => error.value || props.externalError || "");
</script>

<template>
  <Dialog v-model:open="dialogOpen">
    <!-- initial-focus=false：禁用默认自动聚焦（自动聚焦会选中已回显的密码），改由 onMounted 手动聚焦且不选中 -->
    <DialogContent class="sm:max-w-[440px]" :initial-focus="false">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Lock class="h-5 w-5" />
          {{ mode === "export" ? t("configExport.passphraseTitle") : t("configExport.passphraseImportTitle") }}
        </DialogTitle>
      </DialogHeader>

      <div class="grid gap-4 py-4">
        <p class="text-sm text-muted-foreground">
          {{ mode === "export" ? t("configExport.passphraseExportHint") : t("configExport.passphraseImportHint") }}
        </p>

        <div class="grid gap-2">
          <Label>{{ t("configExport.passphrase") }}</Label>
          <PasswordInput ref="passphraseInput" v-model="passphrase" :placeholder="t('configExport.passphrasePlaceholder')" :toggle-tab-index="-1" @keydown.enter="confirm" />
        </div>

        <p v-if="displayError" class="text-sm text-destructive">{{ displayError }}</p>
      </div>

      <DialogFooter>
        <Button @click="confirm">
          {{ mode === "export" ? t("configExport.exportEncrypted") : t("configExport.decryptImport") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
