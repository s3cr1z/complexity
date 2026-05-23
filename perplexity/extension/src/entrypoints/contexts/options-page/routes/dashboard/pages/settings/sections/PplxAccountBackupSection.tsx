import SettingsItem from "@/entrypoints/contexts/options-page/routes/dashboard/pages/settings/SettingsItem";
import SettingsSection from "@/entrypoints/contexts/options-page/routes/dashboard/pages/settings/SettingsSection";
import BackupRestoreUI from "@/plugins/account-backup/BackupRestoreUi";

export default function PplxAccountBackupSection() {
  return (
    <SettingsSection title="Perplexity Account Backup">
      <SettingsItem
        title="Backup & Restore"
        description="Backup and restore your Perplexity data. Choose which items to export (Spaces, Threads, Artifacts, Computer Tasks). Currently only Space restoration is supported on import."
      >
        <BackupRestoreUI />
      </SettingsItem>
    </SettingsSection>
  );
}
