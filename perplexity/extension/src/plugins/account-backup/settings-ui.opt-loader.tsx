import { registerSettingsUi } from "@/entrypoints/contexts/options-page/routes/dashboard/pages/plugins/components/plugin-settings-uis/registry";
import BackupRestoreUI from "@/plugins/account-backup/BackupRestoreUi";

function AccountBackupPluginSettingsUi() {
  return (
    <div className="x:flex x:max-w-lg x:flex-col x:gap-4">
      <p className="x:text-sm x:text-muted-foreground">
        Backup your Perplexity Spaces and Threads. Note that thread restoration
        is limited to metadata and basic recovery where supported by the API.
      </p>
      <BackupRestoreUI />
    </div>
  );
}

export default function Wrapper() {
  "use no memo";

  registerSettingsUi({
    pluginId: "accountBackup",
    ui: <AccountBackupPluginSettingsUi />,
  });
}
