import { z } from "zod";

import {
  SpaceSchema,
  ThreadMessageApiResponseSchema,
  ThreadSearchResponseApiSchema,
} from "@/entrypoints/services/externals/pplx-api/pplx-api.types";

export const ArtifactBackupSchema = z.object({
  language: z.string(),
  content: z.string(),
  threadSlug: z.string(),
  timestamp: z.string(),
});

export const AccountBackupDataSchema = z.object({
  version: z.string(),
  exportDate: z.string(),
  spaces: z.array(SpaceSchema),
  threads: z.array(
    z.object({
      meta: ThreadSearchResponseApiSchema,
      messages: z.array(ThreadMessageApiResponseSchema),
    }),
  ),
  artifacts: z.array(ArtifactBackupSchema),
  computerTasks: z.array(z.any()),
  metadata: z.object({
    totalSpaces: z.number(),
    totalThreads: z.number(),
    totalArtifacts: z.number(),
    totalComputerTasks: z.number(),
  }),
});

export type AccountBackupData = z.infer<typeof AccountBackupDataSchema>;
export type ArtifactBackup = z.infer<typeof ArtifactBackupSchema>;
