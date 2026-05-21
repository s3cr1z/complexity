import type React from "react";
import { useState } from "react";

import AsyncButton from "@/components/AsyncButton";
import { Button } from "@/components/ui/button";
import { AccountBackupService } from "@/plugins/account-backup/service";
import { AccountBackupDataSchema } from "@/plugins/account-backup/types";
import downloadFile from "@/utils/misc/download-file";

import TablerAlertCircle from "~icons/tabler/alert-circle";
import TablerCheck from "~icons/tabler/check";
import TablerLoaderCircle from "~icons/tabler/loader-2";

export default function BackupRestoreUI() {
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<boolean>(false);

  const handleExport = async () => {
    try {
      setError("");
      setSuccess(false);
      const data = await AccountBackupService.exportData((msg) =>
        setStatus(msg),
      );
      await downloadFile({
        data: JSON.stringify(data, null, 2),
        filename: `pplx-backup-${new Date().toISOString().split("T")[0]}.json`,
      });
      setSuccess(true);
      setStatus("Export complete!");
    } catch (err) {
      console.error(err);
      setError("Export failed. See console for details.");
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setError("");
      setSuccess(false);
      setStatus("Reading file...");
      const text = await file.text();
      const rawData = JSON.parse(text);
      const validatedData = AccountBackupDataSchema.parse(rawData);

      await AccountBackupService.importData(validatedData, (msg) =>
        setStatus(msg),
      );
      setSuccess(true);
      setStatus("Import complete!");
    } catch (err) {
      console.error(err);
      setError("Import failed. Ensure file is a valid backup JSON.");
    }
  };

  return (
    <div className="x:flex x:flex-col x:gap-4 x:rounded-lg x:border x:bg-muted/50 x:p-4">
      <div className="x:flex x:gap-4">
        <AsyncButton
          loadingText={
            <div className="x:flex x:items-center x:gap-2">
              <TablerLoaderCircle className="x:animate-spin" />
              <span>Exporting...</span>
            </div>
          }
          onClick={handleExport}
        >
          Export Account Data
        </AsyncButton>

        <div className="x:relative">
          <input
            accept=".json"
            className="x:absolute x:inset-0 x:cursor-pointer x:opacity-0"
            type="file"
            onChange={handleImport}
          />
          <Button variant="outline">Import Backup File</Button>
        </div>
      </div>

      {status && (
        <div className="x:flex x:items-center x:gap-2 x:text-sm x:text-muted-foreground">
          {success ? (
            <TablerCheck className="x:text-green-500" />
          ) : (
            <TablerLoaderCircle className="x:animate-spin" />
          )}
          {status}
        </div>
      )}

      {error && (
        <div className="x:text-destructive x:flex x:items-center x:gap-2 x:text-sm">
          <TablerAlertCircle />
          {error}
        </div>
      )}
    </div>
  );
}
