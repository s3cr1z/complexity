import SettingsItem from "@/entrypoints/contexts/options-page/routes/dashboard/pages/settings/SettingsItem";
import SettingsSection from "@/entrypoints/contexts/options-page/routes/dashboard/pages/settings/SettingsSection";
import BackupRestoreUI from "@/plugins/account-backup/BackupRestoreUi";

export default function PplxAccountBackupSection() {
  return (
    <SettingsSection title="Perplexity Account Backup">
      <SettingsItem
        title="Backup & Restore"
        description="Export and import your Perplexity Spaces and Threads. Note that thread restoration is limited."
      >
        <BackupRestoreUI />
      </SettingsItem>
    </SettingsSection>
  );
}
