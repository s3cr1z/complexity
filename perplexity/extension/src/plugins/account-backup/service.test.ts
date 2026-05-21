import { describe, it, expect, vi } from "vitest";

import { PplxApiService } from "@/entrypoints/services/externals/pplx-api";
import { AccountBackupService } from "@/plugins/account-backup/service";

vi.mock("@/entrypoints/services/externals/pplx-api", () => ({
  PplxApiService: {
    fetchSpaces: vi.fn(),
    fetchThreads: vi.fn(),
    fetchThread: vi.fn(),
    createSpace: vi.fn(),
  },
}));

describe("AccountBackupService", () => {
  describe("exportData", () => {
    it("should export account data correctly", async () => {
      const mockSpaces = [
        {
          title: "Space 1",
          uuid: "1",
          instructions: "",
          slug: "s1",
          description: "",
          access: 1,
          updated_datetime: "",
        },
      ];
      const mockThreadsMeta = [{ title: "Thread 1", slug: "t1" }];
      const mockThreadMessages = [
        {
          query_str: "Q1",
          text: { answer: "A1", web_results: [] },
          thread_url_slug: "t1",
        },
      ];

      vi.mocked(PplxApiService.fetchSpaces).mockResolvedValue(
        mockSpaces as unknown as any,
      );
      vi.mocked(PplxApiService.fetchThreads).mockResolvedValue(
        mockThreadsMeta as unknown as any,
      );
      vi.mocked(PplxApiService.fetchThread).mockResolvedValue(
        mockThreadMessages as unknown as any,
      );

      const result = await AccountBackupService.exportData();

      expect(result.spaces).toEqual(mockSpaces);
      expect(result.threads).toHaveLength(1);
      if (result.threads[0]) {
        expect(result.threads[0].meta).toEqual(mockThreadsMeta[0]);
        expect(result.threads[0].messages).toEqual(mockThreadMessages);
      }
      expect(result.metadata.totalSpaces).toBe(1);
      expect(result.metadata.totalThreads).toBe(1);
    });
  });

  describe("fetchArtifactsFromThread", () => {
    it("should extract artifacts from code blocks", async () => {
      const mockMessages = [
        {
          text: {
            answer:
              "Here is a react component:\n```react\nconsole.log('hello')\n```",
          },
        },
      ] as unknown as any;

      const artifacts = await AccountBackupService.fetchArtifactsFromThread(
        mockMessages,
        "slug",
      );

      expect(artifacts).toHaveLength(1);
      if (artifacts[0]) {
        expect(artifacts[0].language).toBe("react");
        expect(artifacts[0].content).toBe("console.log('hello')");
      }
    });
  });
});
