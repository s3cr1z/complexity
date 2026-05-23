import type React from "react";

import AsyncButton from "@/components/AsyncButton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AccountBackupService } from "@/plugins/account-backup/service";
import {
  AccountBackupDataSchema,
  DEFAULT_EXPORT_OPTIONS,
  DEFAULT_IMPORT_OPTIONS,
  type AccountBackupData,
  type ExportOptions,
  type ImportOptions,
} from "@/plugins/account-backup/types";
import downloadFile from "@/utils/misc/download-file";

import TablerAlertCircle from "~icons/tabler/alert-circle";
import TablerCheck from "~icons/tabler/check";
import TablerLoaderCircle from "~icons/tabler/loader-2";

type ChecksumStatus = "valid" | "mismatch" | "missing" | "unknown";

type ImportPreview = {
  data: AccountBackupData;
  checksumStatus: ChecksumStatus;
};

const CATEGORY_LABELS: Record<keyof ExportOptions, string> = {
  spaces: "Spaces",
  threads: "Threads",
  artifacts: "Artifacts (code blocks from threads)",
  computerTasks: "Computer Tasks",
};

export default function BackupRestoreUI() {
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<boolean>(false);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  const [exportOptions, setExportOptions] = useState<ExportOptions>(
    DEFAULT_EXPORT_OPTIONS,
  );

  const [importOptions, setImportOptions] = useState<ImportOptions>(
    DEFAULT_IMPORT_OPTIONS,
  );
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(
    null,
  );

  const exportNoneSelected =
    !exportOptions.spaces &&
    !exportOptions.threads &&
    !exportOptions.artifacts &&
    !exportOptions.computerTasks;

  const importNoneSelected =
    !importOptions.spaces &&
    !importOptions.threads &&
    !importOptions.artifacts &&
    !importOptions.computerTasks;

  const resetMessages = () => {
    setError("");
    setSuccess(false);
    setStatus("");
  };

  const handleExport = async () => {
    if (exportNoneSelected) {
      setError("Select at least one category to export.");
      return;
    }

    try {
      resetMessages();
      setIsBusy(true);

      const effectiveOptions: ExportOptions = {
        ...exportOptions,
        artifacts: exportOptions.threads ? exportOptions.artifacts : false,
      };

      const { data } = await AccountBackupService.exportData(
        effectiveOptions,
        (msg) => setStatus(msg),
      );

      setStatus("Saving file...");
      // Bypass `showSaveFilePicker` because the long-running fetch above
      // consumes the transient user activation it requires. The anchor-based
      // download writes straight to the browser's default Downloads folder.
      const result = await downloadFile({
        data: JSON.stringify(data, null, 2),
        filename: `pplx-backup-${new Date().toISOString().split("T")[0]}.json`,
        skipFilePicker: true,
      });

      if (result === "cancelled") {
        setStatus("");
        setError("Export cancelled: no file was saved.");
        return;
      }

      setSuccess(true);
      setStatus("Export complete! Check your Downloads folder.");
    } catch (err) {
      console.error(err);
      setStatus("");
      setError(
        err instanceof Error
          ? `Export failed: ${err.message}`
          : "Export failed. See console for details.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleFileSelected = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      resetMessages();
      setStatus("Reading file...");
      const text = await file.text();
      const rawData = JSON.parse(text);
      const parsed = AccountBackupDataSchema.parse(rawData);
      const checksumStatus = await AccountBackupService.verifyChecksum(parsed);

      setImportPreview({ data: parsed, checksumStatus });
      setImportOptions({
        spaces: parsed.spaces.length > 0,
        threads: parsed.threads.length > 0,
        artifacts: parsed.artifacts.length > 0,
        computerTasks: parsed.computerTasks.length > 0,
      });
      setStatus("");
    } catch (err) {
      console.error(err);
      setStatus("");
      setError(
        err instanceof Error
          ? `Failed to read backup: ${err.message}`
          : "Import failed. Ensure the file is a valid backup JSON.",
      );
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    if (importNoneSelected) {
      setError("Select at least one category to import.");
      return;
    }

    try {
      resetMessages();
      setIsBusy(true);

      await AccountBackupService.importData(
        importPreview.data,
        importOptions,
        (msg) => setStatus(msg),
      );

      setSuccess(true);
      setStatus("Import complete!");
      setImportPreview(null);
    } catch (err) {
      console.error(err);
      setStatus("");
      setError(
        err instanceof Error
          ? `Import failed: ${err.message}`
          : "Import failed. See console for details.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const cancelImport = () => {
    setImportPreview(null);
    resetMessages();
  };

  return (
    <div className="x:flex x:flex-col x:gap-4 x:rounded-lg x:border x:bg-muted/50 x:p-4">
      <section className="x:flex x:flex-col x:gap-3">
        <h3 className="x:text-sm x:font-semibold">Export</h3>
        <div className="x:flex x:flex-col x:gap-2">
          <Checkbox
            checked={exportOptions.spaces}
            label={CATEGORY_LABELS.spaces}
            onCheckedChange={({ checked }) =>
              setExportOptions((prev) => ({
                ...prev,
                spaces: Boolean(checked),
              }))
            }
          />
          <Checkbox
            checked={exportOptions.threads}
            label={CATEGORY_LABELS.threads}
            onCheckedChange={({ checked }) => {
              const next = Boolean(checked);
              setExportOptions((prev) => ({
                ...prev,
                threads: next,
                artifacts: next ? prev.artifacts : false,
              }));
            }}
          />
          <Checkbox
            checked={exportOptions.artifacts && exportOptions.threads}
            disabled={!exportOptions.threads}
            label={CATEGORY_LABELS.artifacts}
            onCheckedChange={({ checked }) =>
              setExportOptions((prev) => ({
                ...prev,
                artifacts: Boolean(checked),
              }))
            }
          />
          <Checkbox
            checked={exportOptions.computerTasks}
            label={CATEGORY_LABELS.computerTasks}
            onCheckedChange={({ checked }) =>
              setExportOptions((prev) => ({
                ...prev,
                computerTasks: Boolean(checked),
              }))
            }
          />
        </div>

        <div>
          <AsyncButton
            disabled={exportNoneSelected || isBusy}
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
        </div>
      </section>

      <section className="x:flex x:flex-col x:gap-3 x:border-t x:pt-4">
        <h3 className="x:text-sm x:font-semibold">Import</h3>

        {!importPreview && (
          <div className="x:relative x:w-fit">
            <input
              accept=".json"
              className="x:absolute x:inset-0 x:cursor-pointer x:opacity-0"
              disabled={isBusy}
              type="file"
              onChange={handleFileSelected}
            />
            <Button disabled={isBusy} variant="outline">
              Select Backup File
            </Button>
          </div>
        )}

        {importPreview && (
          <div className="x:flex x:flex-col x:gap-3">
            <div className="x:text-sm x:text-muted-foreground">
              <p>
                This backup contains{" "}
                <strong>{importPreview.data.spaces.length}</strong> space(s),{" "}
                <strong>{importPreview.data.threads.length}</strong> thread(s),{" "}
                <strong>{importPreview.data.artifacts.length}</strong>{" "}
                artifact(s), and{" "}
                <strong>{importPreview.data.computerTasks.length}</strong>{" "}
                computer task(s).
              </p>
              <p className="x:mt-1">
                Version: <code>{importPreview.data.version || "unknown"}</code>{" "}
                — Integrity:{" "}
                <ChecksumIndicator status={importPreview.checksumStatus} />
              </p>
            </div>

            <div className="x:flex x:flex-col x:gap-2">
              <Checkbox
                checked={importOptions.spaces}
                disabled={importPreview.data.spaces.length === 0}
                label={`${CATEGORY_LABELS.spaces} (${importPreview.data.spaces.length})`}
                onCheckedChange={({ checked }) =>
                  setImportOptions((prev) => ({
                    ...prev,
                    spaces: Boolean(checked),
                  }))
                }
              />
              <Checkbox
                checked={importOptions.threads}
                disabled={importPreview.data.threads.length === 0}
                label={`${CATEGORY_LABELS.threads} (${importPreview.data.threads.length}) — restore not yet supported`}
                onCheckedChange={({ checked }) =>
                  setImportOptions((prev) => ({
                    ...prev,
                    threads: Boolean(checked),
                  }))
                }
              />
              <Checkbox
                checked={importOptions.artifacts}
                disabled={importPreview.data.artifacts.length === 0}
                label={`${CATEGORY_LABELS.artifacts} (${importPreview.data.artifacts.length}) — restore not yet supported`}
                onCheckedChange={({ checked }) =>
                  setImportOptions((prev) => ({
                    ...prev,
                    artifacts: Boolean(checked),
                  }))
                }
              />
              <Checkbox
                checked={importOptions.computerTasks}
                disabled={importPreview.data.computerTasks.length === 0}
                label={`${CATEGORY_LABELS.computerTasks} (${importPreview.data.computerTasks.length}) — restore not yet supported`}
                onCheckedChange={({ checked }) =>
                  setImportOptions((prev) => ({
                    ...prev,
                    computerTasks: Boolean(checked),
                  }))
                }
              />
            </div>

            <div className="x:flex x:gap-2">
              <AsyncButton
                disabled={importNoneSelected || isBusy}
                loadingText={
                  <div className="x:flex x:items-center x:gap-2">
                    <TablerLoaderCircle className="x:animate-spin" />
                    <span>Importing...</span>
                  </div>
                }
                onClick={handleConfirmImport}
              >
                Confirm Import
              </AsyncButton>
              <Button
                disabled={isBusy}
                variant="outline"
                onClick={cancelImport}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </section>

      {status && (
        <div className="x:flex x:items-center x:gap-2 x:text-sm x:text-muted-foreground">
          {success ? (
            <TablerCheck className="x:text-green-500" />
          ) : error ? null : (
            <TablerLoaderCircle className="x:animate-spin" />
          )}
          <span>{status}</span>
        </div>
      )}

      {error && (
        <div className="x:text-destructive x:flex x:items-center x:gap-2 x:text-sm">
          <TablerAlertCircle />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function ChecksumIndicator({ status }: { status: ChecksumStatus }) {
  switch (status) {
    case "valid":
      return <span className="x:text-green-500">verified</span>;
    case "mismatch":
      return (
        <span className="x:text-destructive">
          checksum mismatch (file may be corrupted)
        </span>
      );
    case "missing":
      return (
        <span className="x:text-amber-500">no checksum (legacy file)</span>
      );
    default:
      return <span>unknown</span>;
  }
}
