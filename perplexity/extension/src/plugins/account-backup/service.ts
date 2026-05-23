import { PplxApiService } from "@/entrypoints/services/externals/pplx-api";
import type {
  ThreadMessageApiResponse,
  ThreadSearchResponseApi,
} from "@/entrypoints/services/externals/pplx-api/pplx-api.types";
import type {
  AccountBackupData,
  ArtifactBackup,
  ExportOptions,
  ImportOptions,
  ThreadMessageExported,
} from "@/plugins/account-backup/types";

const BACKUP_VERSION = "2.0.0";
const THREAD_FETCH_PAGE_SIZE = 50;
const THREAD_FETCH_CONCURRENCY = 5;

export type ExportResultSummary = {
  totalSpaces: number;
  totalThreads: number;
  totalArtifacts: number;
  totalComputerTasks: number;
  failedThreads: number;
};

export type ImportResultSummary = {
  spacesCreated: number;
  spacesFailed: number;
};

export class AccountBackupService {
  static async exportData(
    options: ExportOptions,
    onProgress?: (message: string) => void,
  ): Promise<{ data: AccountBackupData; summary: ExportResultSummary }> {
    if (
      !options.spaces &&
      !options.threads &&
      !options.artifacts &&
      !options.computerTasks
    ) {
      throw new Error("At least one category must be selected for export.");
    }

    let spaces: AccountBackupData["spaces"] = [];
    if (options.spaces) {
      onProgress?.("Fetching spaces...");
      spaces = await PplxApiService.fetchSpaces();
    }

    const threadsWithMessages: AccountBackupData["threads"] = [];
    const allArtifacts: ArtifactBackup[] = [];
    let failedThreads = 0;

    if (options.threads) {
      onProgress?.("Fetching thread list...");
      const allThreadsMeta = await this.fetchAllThreadMeta(onProgress);

      onProgress?.(
        `Fetching messages for ${allThreadsMeta.length} thread(s)...`,
      );

      for (
        let i = 0;
        i < allThreadsMeta.length;
        i += THREAD_FETCH_CONCURRENCY
      ) {
        const batch = allThreadsMeta.slice(i, i + THREAD_FETCH_CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map(async (meta) => {
            const messages = await PplxApiService.fetchThread(meta.slug);
            const artifacts = options.artifacts
              ? await this.fetchArtifactsFromThread(
                  messages,
                  meta.slug,
                  meta.last_query_datetime,
                )
              : [];
            return { meta, messages, artifacts };
          }),
        );

        for (const result of results) {
          if (result.status === "fulfilled") {
            threadsWithMessages.push({
              meta: result.value.meta,
              messages: this.toExportedMessages(result.value.messages),
            });
            allArtifacts.push(...result.value.artifacts);
          } else {
            failedThreads += 1;
            console.error("Failed to fetch thread:", result.reason);
          }
        }

        onProgress?.(
          `Fetched ${Math.min(
            i + THREAD_FETCH_CONCURRENCY,
            allThreadsMeta.length,
          )}/${allThreadsMeta.length} threads...`,
        );
      }

      if (failedThreads > 0) {
        onProgress?.(`Warning: ${failedThreads} thread(s) failed to fetch.`);
      }
    }

    const summary: ExportResultSummary = {
      totalSpaces: spaces.length,
      totalThreads: threadsWithMessages.length,
      totalArtifacts: allArtifacts.length,
      totalComputerTasks: 0,
      failedThreads,
    };

    const dataWithoutChecksum: Omit<AccountBackupData, "checksum"> = {
      version: BACKUP_VERSION,
      exportDate: new Date().toISOString(),
      spaces,
      threads: threadsWithMessages,
      artifacts: allArtifacts,
      computerTasks: [],
      metadata: {
        totalSpaces: summary.totalSpaces,
        totalThreads: summary.totalThreads,
        totalArtifacts: summary.totalArtifacts,
        totalComputerTasks: summary.totalComputerTasks,
      },
    };

    const checksum = await computeChecksum(dataWithoutChecksum);

    return {
      data: { ...dataWithoutChecksum, checksum },
      summary,
    };
  }

  static async fetchAllThreadMeta(
    onProgress?: (message: string) => void,
  ): Promise<ThreadSearchResponseApi[]> {
    const all: ThreadSearchResponseApi[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const batch = await PplxApiService.fetchThreads({
        limit: THREAD_FETCH_PAGE_SIZE,
        offset,
      });

      all.push(...batch);

      const lastInBatch = batch[batch.length - 1];
      const apiSaysMore = lastInBatch?.has_next_page ?? false;
      hasMore = apiSaysMore && batch.length === THREAD_FETCH_PAGE_SIZE;
      offset += batch.length;

      onProgress?.(`Fetched ${all.length} thread metadata entries...`);

      if (batch.length < THREAD_FETCH_PAGE_SIZE) {
        hasMore = false;
      }
    }

    return all;
  }

  static toExportedMessages(
    messages: ThreadMessageApiResponse[],
  ): ThreadMessageExported[] {
    return messages.map((msg) => ({
      query_str: msg.query_str,
      text: msg.text,
      backend_uuid: msg.backend_uuid,
      author_image: msg.author_image,
      author_username: msg.author_username,
      thread_url_slug: msg.thread_url_slug,
      display_model: msg.display_model,
    }));
  }

  static async fetchArtifactsFromThread(
    messages: ThreadMessageApiResponse[],
    threadSlug: string,
    fallbackTimestamp?: string,
  ): Promise<ArtifactBackup[]> {
    const artifacts: ArtifactBackup[] = [];
    for (const msg of messages) {
      const text = msg.text as ThreadMessageApiResponse["text"] | null;
      if (text == null) continue;
      const answer = text.answer;
      if (!answer) continue;

      const codeBlockRegex = /```([^\n`]*)\n([\s\S]*?)```/g;
      let match: RegExpExecArray | null;
      while ((match = codeBlockRegex.exec(answer)) !== null) {
        const language = match[1]?.trim() || "text";
        const content = match[2]?.trim() ?? "";

        artifacts.push({
          language,
          content,
          threadSlug,
          timestamp: fallbackTimestamp ?? new Date().toISOString(),
        });
      }
    }
    return artifacts;
  }

  static async importData(
    data: AccountBackupData,
    options: ImportOptions,
    onProgress?: (message: string) => void,
  ): Promise<ImportResultSummary> {
    const checksumStatus = await this.verifyChecksum(data);
    if (checksumStatus === "mismatch") {
      onProgress?.(
        "Warning: backup checksum does not match its contents. Proceeding anyway.",
      );
    } else if (checksumStatus === "missing") {
      onProgress?.(
        "Warning: backup has no checksum (legacy file). Skipping integrity check.",
      );
    }

    if (data.version && !data.version.startsWith("2.")) {
      onProgress?.(
        `Warning: importing legacy backup format (v${data.version}). Some fields may be missing.`,
      );
    }

    let spacesCreated = 0;
    let spacesFailed = 0;

    if (options.spaces && data.spaces.length > 0) {
      onProgress?.(`Importing ${data.spaces.length} space(s)...`);
      for (const space of data.spaces) {
        onProgress?.(`Creating space: ${space.title}`);
        try {
          await PplxApiService.createSpace({
            title: space.title,
            description: space.description,
            emoji: space.emoji,
            instructions: space.instructions,
            model_selection: space.model_selection,
          });
          spacesCreated += 1;
        } catch (error) {
          spacesFailed += 1;
          console.error(`Failed to create space ${space.title}:`, error);
        }
      }
    }

    const messageParts: string[] = [];
    if (options.spaces) {
      messageParts.push(
        `Imported ${spacesCreated} space(s) successfully.${
          spacesFailed > 0 ? ` ${spacesFailed} failed.` : ""
        }`,
      );
    }
    if (options.threads || options.artifacts || options.computerTasks) {
      messageParts.push(
        "Note: Thread, artifact, and computer task restoration is not currently supported.",
      );
    }

    if (messageParts.length > 0) {
      onProgress?.(messageParts.join(" "));
    }

    return { spacesCreated, spacesFailed };
  }

  static async verifyChecksum(
    data: AccountBackupData,
  ): Promise<"valid" | "mismatch" | "missing"> {
    if (!data.checksum) return "missing";
    const { checksum: _omit, ...rest } = data;
    const expected = await computeChecksum(rest);
    return expected === data.checksum ? "valid" : "mismatch";
  }
}

async function computeChecksum(
  data: Omit<AccountBackupData, "checksum">,
): Promise<string> {
  const json = JSON.stringify(data);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(json);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
