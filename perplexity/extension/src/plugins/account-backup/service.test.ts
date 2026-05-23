import { describe, it, expect, vi, beforeEach } from "vitest";

import { PplxApiService } from "@/entrypoints/services/externals/pplx-api";
import type {
  Space,
  ThreadMessageApiResponse,
  ThreadSearchResponseApi,
} from "@/entrypoints/services/externals/pplx-api/pplx-api.types";
import { AccountBackupService } from "@/plugins/account-backup/service";
import {
  AccountBackupDataSchema,
  ThreadMessageExportedSchema,
  type ExportOptions,
  type ImportOptions,
} from "@/plugins/account-backup/types";

vi.mock("@/entrypoints/services/externals/pplx-api", () => ({
  PplxApiService: {
    fetchSpaces: vi.fn(),
    fetchThreads: vi.fn(),
    fetchThread: vi.fn(),
    createSpace: vi.fn(),
  },
}));

const ALL_ENABLED: ExportOptions = {
  spaces: true,
  threads: true,
  artifacts: true,
  computerTasks: true,
};

const IMPORT_ALL_ENABLED: ImportOptions = {
  spaces: true,
  threads: true,
  artifacts: true,
  computerTasks: true,
};

function makeSpace(overrides: Partial<Space> = {}): Space {
  return {
    title: "Space 1",
    uuid: "uuid-1",
    instructions: "",
    slug: "space-1",
    emoji: null,
    description: "",
    access: 1,
    model_selection: null,
    enable_web_by_default: null,
    updated_datetime: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeThreadMeta(
  overrides: Partial<ThreadSearchResponseApi> = {},
): ThreadSearchResponseApi {
  return {
    thread_number: 1,
    last_query_datetime: "2025-01-02T00:00:00.000Z",
    mode: "default",
    context_uuid: "ctx-1",
    uuid: "thread-uuid-1",
    slug: "thread-1",
    expiry_time: null,
    title: "Thread 1",
    first_answer: "Hi",
    thread_access: 1,
    query_count: 1,
    search_focus: "internet",
    has_next_page: false,
    ...overrides,
  };
}

function makeMessage(
  overrides: Partial<ThreadMessageApiResponse> = {},
): ThreadMessageApiResponse {
  return {
    query_str: "Q",
    text: { answer: "A", web_results: [] },
    backend_uuid: "msg-1",
    author_image: null,
    author_username: null,
    thread_url_slug: "thread-1",
    display_model: "default",
    ...overrides,
  } as ThreadMessageApiResponse;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AccountBackupService.exportData", () => {
  it("exports all categories when fully enabled", async () => {
    const space = makeSpace();
    const meta = makeThreadMeta();
    const msg = makeMessage({
      text: { answer: "```ts\nconst x = 1;\n```", web_results: [] },
    });

    vi.mocked(PplxApiService.fetchSpaces).mockResolvedValue([space]);
    vi.mocked(PplxApiService.fetchThreads).mockResolvedValue([meta]);
    vi.mocked(PplxApiService.fetchThread).mockResolvedValue([msg]);

    const { data, summary } =
      await AccountBackupService.exportData(ALL_ENABLED);

    expect(data.version).toBe("2.0.0");
    expect(data.spaces).toEqual([space]);
    expect(data.threads).toHaveLength(1);
    expect(data.threads[0]?.meta).toEqual(meta);
    expect(data.artifacts).toHaveLength(1);
    expect(data.artifacts[0]?.language).toBe("ts");
    expect(data.artifacts[0]?.content).toBe("const x = 1;");
    expect(data.artifacts[0]?.timestamp).toBe(meta.last_query_datetime);
    expect(data.metadata.totalSpaces).toBe(1);
    expect(data.metadata.totalThreads).toBe(1);
    expect(data.metadata.totalArtifacts).toBe(1);
    expect(data.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(summary.failedThreads).toBe(0);
  });

  it("exports spaces only when threads disabled", async () => {
    const space = makeSpace();
    vi.mocked(PplxApiService.fetchSpaces).mockResolvedValue([space]);

    const { data } = await AccountBackupService.exportData({
      spaces: true,
      threads: false,
      artifacts: false,
      computerTasks: false,
    });

    expect(data.spaces).toEqual([space]);
    expect(data.threads).toEqual([]);
    expect(data.artifacts).toEqual([]);
    expect(PplxApiService.fetchThreads).not.toHaveBeenCalled();
    expect(PplxApiService.fetchThread).not.toHaveBeenCalled();
  });

  it("skips artifacts when threads enabled but artifacts disabled", async () => {
    const meta = makeThreadMeta();
    const msg = makeMessage({
      text: { answer: "```ts\nconst x = 1;\n```", web_results: [] },
    });

    vi.mocked(PplxApiService.fetchSpaces).mockResolvedValue([]);
    vi.mocked(PplxApiService.fetchThreads).mockResolvedValue([meta]);
    vi.mocked(PplxApiService.fetchThread).mockResolvedValue([msg]);

    const { data } = await AccountBackupService.exportData({
      spaces: false,
      threads: true,
      artifacts: false,
      computerTasks: false,
    });

    expect(data.threads).toHaveLength(1);
    expect(data.artifacts).toEqual([]);
  });

  it("throws when no category is selected", async () => {
    await expect(
      AccountBackupService.exportData({
        spaces: false,
        threads: false,
        artifacts: false,
        computerTasks: false,
      }),
    ).rejects.toThrow(/at least one category/i);
  });

  it("paginates thread metadata across multiple pages", async () => {
    const firstPage = Array.from({ length: 50 }, (_, i) =>
      makeThreadMeta({
        slug: `t-${i}`,
        uuid: `u-${i}`,
        has_next_page: i === 49,
      }),
    );
    const secondPage = [
      makeThreadMeta({ slug: "t-50", uuid: "u-50", has_next_page: false }),
    ];

    vi.mocked(PplxApiService.fetchSpaces).mockResolvedValue([]);
    vi.mocked(PplxApiService.fetchThreads)
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage);
    vi.mocked(PplxApiService.fetchThread).mockResolvedValue([]);

    const { data } = await AccountBackupService.exportData({
      spaces: false,
      threads: true,
      artifacts: false,
      computerTasks: false,
    });

    expect(PplxApiService.fetchThreads).toHaveBeenCalledTimes(2);
    expect(PplxApiService.fetchThreads).toHaveBeenNthCalledWith(1, {
      limit: 50,
      offset: 0,
    });
    expect(PplxApiService.fetchThreads).toHaveBeenNthCalledWith(2, {
      limit: 50,
      offset: 50,
    });
    expect(data.threads).toHaveLength(51);
  });

  it("counts failed threads without aborting", async () => {
    const meta1 = makeThreadMeta({ slug: "ok" });
    const meta2 = makeThreadMeta({ slug: "fail", uuid: "u-fail" });

    vi.mocked(PplxApiService.fetchSpaces).mockResolvedValue([]);
    vi.mocked(PplxApiService.fetchThreads).mockResolvedValue([meta1, meta2]);
    vi.mocked(PplxApiService.fetchThread).mockImplementation(
      async (slug: string) => {
        if (slug === "fail") throw new Error("network error");
        return [];
      },
    );

    const { data, summary } = await AccountBackupService.exportData({
      spaces: false,
      threads: true,
      artifacts: false,
      computerTasks: false,
    });

    expect(data.threads).toHaveLength(1);
    expect(summary.failedThreads).toBe(1);
  });

  it("produces a backup whose threads pass the exported message schema", async () => {
    const meta = makeThreadMeta();
    const msg = makeMessage();

    vi.mocked(PplxApiService.fetchSpaces).mockResolvedValue([]);
    vi.mocked(PplxApiService.fetchThreads).mockResolvedValue([meta]);
    vi.mocked(PplxApiService.fetchThread).mockResolvedValue([msg]);

    const { data } = await AccountBackupService.exportData(ALL_ENABLED);

    expect(() =>
      ThreadMessageExportedSchema.parse(data.threads[0]?.messages[0]),
    ).not.toThrow();
    expect(() => AccountBackupDataSchema.parse(data)).not.toThrow();
  });

  it("attaches a checksum and verifies it on re-parse", async () => {
    vi.mocked(PplxApiService.fetchSpaces).mockResolvedValue([makeSpace()]);

    const { data } = await AccountBackupService.exportData({
      spaces: true,
      threads: false,
      artifacts: false,
      computerTasks: false,
    });

    expect(data.checksum).toBeDefined();

    const status = await AccountBackupService.verifyChecksum(data);
    expect(status).toBe("valid");
  });

  it("detects checksum mismatch when data is tampered", async () => {
    vi.mocked(PplxApiService.fetchSpaces).mockResolvedValue([makeSpace()]);

    const { data } = await AccountBackupService.exportData({
      spaces: true,
      threads: false,
      artifacts: false,
      computerTasks: false,
    });

    const tampered = {
      ...data,
      spaces: [...data.spaces, makeSpace({ uuid: "tampered" })],
    };

    const status = await AccountBackupService.verifyChecksum(tampered);
    expect(status).toBe("mismatch");
  });

  it("reports missing checksum for legacy backups", async () => {
    vi.mocked(PplxApiService.fetchSpaces).mockResolvedValue([]);

    const { data } = await AccountBackupService.exportData({
      spaces: true,
      threads: false,
      artifacts: false,
      computerTasks: false,
    });

    const { checksum: _omit, ...rest } = data;
    const status = await AccountBackupService.verifyChecksum(rest);
    expect(status).toBe("missing");
  });
});

describe("AccountBackupService.fetchArtifactsFromThread", () => {
  it("extracts artifacts from code blocks", async () => {
    const messages = [
      makeMessage({
        text: {
          answer:
            "Here is a react component:\n```react\nconsole.log('hello')\n```",
          web_results: [],
        },
      }),
    ];

    const artifacts = await AccountBackupService.fetchArtifactsFromThread(
      messages,
      "slug",
    );

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]?.language).toBe("react");
    expect(artifacts[0]?.content).toBe("console.log('hello')");
  });

  it("skips messages where text is null", async () => {
    const messages = [
      makeMessage({
        text: null as unknown as ThreadMessageApiResponse["text"],
      }),
      makeMessage({ text: { answer: "no code", web_results: [] } }),
    ];

    const artifacts = await AccountBackupService.fetchArtifactsFromThread(
      messages,
      "slug",
    );

    expect(artifacts).toHaveLength(0);
  });

  it("falls back to 'text' when language is empty", async () => {
    const messages = [
      makeMessage({
        text: {
          answer: "```\nplain code\n```",
          web_results: [],
        },
      }),
    ];

    const artifacts = await AccountBackupService.fetchArtifactsFromThread(
      messages,
      "slug",
    );

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]?.language).toBe("text");
    expect(artifacts[0]?.content).toBe("plain code");
  });

  it("does not match code fences that span the language token across newlines", async () => {
    const messages = [
      makeMessage({
        text: {
          answer: "```\ntop-level fence\n```\n\n```python\nprint('hi')\n```",
          web_results: [],
        },
      }),
    ];

    const artifacts = await AccountBackupService.fetchArtifactsFromThread(
      messages,
      "slug",
    );

    expect(artifacts).toHaveLength(2);
    expect(artifacts[0]?.language).toBe("text");
    expect(artifacts[1]?.language).toBe("python");
  });

  it("uses the provided fallback timestamp", async () => {
    const messages = [
      makeMessage({
        text: { answer: "```js\n1\n```", web_results: [] },
      }),
    ];

    const artifacts = await AccountBackupService.fetchArtifactsFromThread(
      messages,
      "slug",
      "2024-12-25T00:00:00.000Z",
    );

    expect(artifacts[0]?.timestamp).toBe("2024-12-25T00:00:00.000Z");
  });
});

describe("AccountBackupService.importData", () => {
  it("counts successful and failed space creations", async () => {
    const spaces = [
      makeSpace({ title: "ok-1", uuid: "u-1" }),
      makeSpace({ title: "fail", uuid: "u-2" }),
      makeSpace({ title: "ok-2", uuid: "u-3" }),
    ];

    vi.mocked(PplxApiService.createSpace).mockImplementation(
      async (payload) => {
        if (payload.title === "fail") throw new Error("denied");
        return makeSpace({ title: payload.title });
      },
    );

    const data = AccountBackupDataSchema.parse({
      version: "2.0.0",
      exportDate: new Date().toISOString(),
      spaces,
      threads: [],
      artifacts: [],
      computerTasks: [],
      metadata: {
        totalSpaces: spaces.length,
        totalThreads: 0,
        totalArtifacts: 0,
        totalComputerTasks: 0,
      },
    });

    const result = await AccountBackupService.importData(
      data,
      IMPORT_ALL_ENABLED,
    );

    expect(result.spacesCreated).toBe(2);
    expect(result.spacesFailed).toBe(1);
  });

  it("does not call createSpace when spaces are unchecked", async () => {
    const data = AccountBackupDataSchema.parse({
      version: "2.0.0",
      exportDate: new Date().toISOString(),
      spaces: [makeSpace()],
      threads: [],
      artifacts: [],
      computerTasks: [],
      metadata: {
        totalSpaces: 1,
        totalThreads: 0,
        totalArtifacts: 0,
        totalComputerTasks: 0,
      },
    });

    await AccountBackupService.importData(data, {
      spaces: false,
      threads: true,
      artifacts: true,
      computerTasks: true,
    });

    expect(PplxApiService.createSpace).not.toHaveBeenCalled();
  });

  it("warns via onProgress when checksum is missing", async () => {
    const data = AccountBackupDataSchema.parse({
      version: "2.0.0",
      exportDate: new Date().toISOString(),
      spaces: [],
      threads: [],
      artifacts: [],
      computerTasks: [],
      metadata: {
        totalSpaces: 0,
        totalThreads: 0,
        totalArtifacts: 0,
        totalComputerTasks: 0,
      },
    });

    const messages: string[] = [];
    await AccountBackupService.importData(data, IMPORT_ALL_ENABLED, (m) =>
      messages.push(m),
    );

    expect(messages.some((m) => /no checksum/i.test(m))).toBe(true);
  });
});
