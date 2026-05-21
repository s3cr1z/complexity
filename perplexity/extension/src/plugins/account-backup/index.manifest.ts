import {
  definePluginDashboardMeta,
  definePluginMeta,
} from "@/entrypoints/services/plugins/defines";
import type { PluginManifestExports } from "@/entrypoints/services/plugins/types";
import {
  settingsSchemas,
  settingsStorage,
} from "@/plugins/account-backup/settings";

declare module "@/entrypoints/services/plugins/types" {
  interface PluginsRegistry {
    [meta.id]: typeof manifest;
  }
}

const meta = definePluginMeta({
  id: "accountBackup",
  name: "Account Backup",
  description:
    "Export and import your Perplexity account data, including Spaces and Threads.",
});

const dashboardMeta = definePluginDashboardMeta({
  tags: ["ui"],
  categories: ["misc"],
  uiRouteSegment: "account-backup",
});

const manifest = {
  meta,
  dashboardMeta,
  settingsSchemas,
  settingsStorage,
} satisfies PluginManifestExports;

export default manifest;
