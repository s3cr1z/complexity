import { z } from "zod";

import type { LanguageModel } from "@/entrypoints/services/externals/cplx-api/remote-resources/pplx-language-models/types";
import {
  SpaceSchema,
  ThreadMessageTextSchema,
  ThreadSearchResponseApiSchema,
} from "@/entrypoints/services/externals/pplx-api/pplx-api.types";

export const ArtifactBackupSchema = z.object({
  language: z.string(),
  content: z.string(),
  threadSlug: z.string(),
  timestamp: z.string(),
});

export const ThreadMessageExportedSchema = z.object({
  query_str: z.string(),
  text: ThreadMessageTextSchema,
  backend_uuid: z.string(),
  author_image: z.string().nullable(),
  author_username: z.string().nullable(),
  thread_url_slug: z.string(),
  display_model: z.string() as z.ZodType<LanguageModel["code"]>,
});

export type ThreadMessageExported = z.infer<typeof ThreadMessageExportedSchema>;

export const AccountBackupDataSchema = z.object({
  version: z.string(),
  exportDate: z.string(),
  spaces: z.array(SpaceSchema).default([]),
  threads: z
    .array(
      z.object({
        meta: ThreadSearchResponseApiSchema,
        messages: z.array(ThreadMessageExportedSchema),
      }),
    )
    .default([]),
  artifacts: z.array(ArtifactBackupSchema).default([]),
  computerTasks: z.array(z.unknown()).default([]),
  metadata: z.object({
    totalSpaces: z.number(),
    totalThreads: z.number(),
    totalArtifacts: z.number(),
    totalComputerTasks: z.number(),
  }),
  checksum: z.string().optional(),
});

export type AccountBackupData = z.infer<typeof AccountBackupDataSchema>;
export type ArtifactBackup = z.infer<typeof ArtifactBackupSchema>;

export type ExportOptions = {
  spaces: boolean;
  threads: boolean;
  artifacts: boolean;
  computerTasks: boolean;
};

export type ImportOptions = {
  spaces: boolean;
  threads: boolean;
  artifacts: boolean;
  computerTasks: boolean;
};

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  spaces: true,
  threads: true,
  artifacts: true,
  computerTasks: true,
};

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  spaces: true,
  threads: true,
  artifacts: true,
  computerTasks: true,
};
