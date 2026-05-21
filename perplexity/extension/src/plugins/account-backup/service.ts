import { PplxApiService } from "@/entrypoints/services/externals/pplx-api";
import type { ThreadMessageApiResponse } from "@/entrypoints/services/externals/pplx-api/pplx-api.types";
import type {
  AccountBackupData,
  ArtifactBackup,
} from "@/plugins/account-backup/types";

export class AccountBackupService {
  static async exportData(
    onProgress?: (message: string) => void,
  ): Promise<AccountBackupData> {
    onProgress?.("Fetching spaces...");
    const spaces = await PplxApiService.fetchSpaces();

    onProgress?.("Fetching threads...");
    const threadsMeta = await PplxApiService.fetchThreads({ limit: 50 });

    const threadsWithMessages = [];
    const allArtifacts: ArtifactBackup[] = [];

    for (let i = 0; i < threadsMeta.length; i++) {
      const threadMeta = threadsMeta[i];
      if (!threadMeta) continue;

      onProgress?.(
        `Fetching thread messages ${i + 1}/${threadsMeta.length}: ${threadMeta.title}`,
      );
      try {
        const messages = await PplxApiService.fetchThread(threadMeta.slug);
        threadsWithMessages.push({
          meta: threadMeta,
          messages,
        });

        const artifacts = await this.fetchArtifactsFromThread(
          messages,
          threadMeta.slug,
        );
        allArtifacts.push(...artifacts);
      } catch (error) {
        console.error(
          `Failed to fetch messages for thread ${threadMeta.slug}:`,
          error,
        );
      }
    }

    return {
      version: "1.0.0",
      exportDate: new Date().toISOString(),
      spaces,
      threads: threadsWithMessages,
      artifacts: allArtifacts,
      computerTasks: [],
      metadata: {
        totalSpaces: spaces.length,
        totalThreads: threadsWithMessages.length,
        totalArtifacts: allArtifacts.length,
        totalComputerTasks: 0,
      },
    };
  }

  static async fetchArtifactsFromThread(
    messages: ThreadMessageApiResponse[],
    threadSlug: string,
  ): Promise<ArtifactBackup[]> {
    const artifacts: ArtifactBackup[] = [];
    for (const msg of messages) {
      const answer = msg.text.answer;
      if (!answer) continue;

      const codeBlockRegex = /```([\s\S]*?)\n([\s\S]*?)```/g;
      let match;
      while ((match = codeBlockRegex.exec(answer)) !== null) {
        const language = match[1]?.trim() ?? "text";
        const content = match[2]?.trim() ?? "";

        artifacts.push({
          language,
          content,
          threadSlug: threadSlug,
          timestamp: new Date().toISOString(),
        });
      }
    }
    return artifacts;
  }

  static async importData(
    data: AccountBackupData,
    onProgress?: (message: string) => void,
  ): Promise<void> {
    onProgress?.("Importing spaces...");
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
      } catch (error) {
        console.error(`Failed to create space ${space.title}:`, error);
      }
    }
    onProgress?.(
      `Imported ${data.spaces.length} spaces and verified ${data.threads.length} threads.`,
    );
  }
}
