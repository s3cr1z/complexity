import { APP_CONFIG } from "@/app.config";

const MIME_TYPE_TO_EXTENSION: Record<string, string> = {
  "application/json": ".json",
  "text/markdown": ".md",
  "text/plain": ".txt",
};

const EXTENSION_TO_MIME_TYPE: Record<string, string> = Object.entries(
  MIME_TYPE_TO_EXTENSION,
).reduce(
  (acc, [mimeType, ext]) => {
    acc[ext] = mimeType;
    return acc;
  },
  {} as Record<string, string>,
);

export type DownloadFileResult = "saved" | "cancelled";

export default async function downloadFile({
  data,
  filename,
  mimeType,
  skipFilePicker = false,
}: {
  data: string;
  filename: string;
  mimeType?: string;
  /**
   * When true, always use the anchor-based download instead of the
   * `showSaveFilePicker` API. Useful for flows where a long-running async
   * operation has consumed the transient user activation that
   * `showSaveFilePicker` requires.
   */
  skipFilePicker?: boolean;
}): Promise<DownloadFileResult> {
  const resolvedMimeType =
    mimeType || inferMimeTypeFromFilename(filename) || "application/json";

  if (
    !skipFilePicker &&
    APP_CONFIG.BROWSER === "chrome" &&
    "showSaveFilePicker" in window
  ) {
    return await downloadFileChrome(data, filename, resolvedMimeType);
  }
  downloadFileGeneric(data, filename, resolvedMimeType);
  return "saved";
}

function inferMimeTypeFromFilename(filename: string): string | null {
  const ext = filename.substring(filename.lastIndexOf("."));
  return EXTENSION_TO_MIME_TYPE[ext] || null;
}

async function downloadFileChrome(
  data: string,
  filename: string,
  mimeType: string,
): Promise<DownloadFileResult> {
  const extension = MIME_TYPE_TO_EXTENSION[mimeType] || ".bin";
  let handle: FileSystemFileHandle;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handle = await (window as any).showSaveFilePicker({
      suggestedName: filename,
      types: [
        {
          description: "File",
          accept: {
            [mimeType]: [extension],
          },
        },
      ],
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      return "cancelled";
    }
    throw error;
  }

  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
  return "saved";
}

function downloadFileGeneric(data: string, filename: string, mimeType: string) {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
}
