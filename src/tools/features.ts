import fs from "node:fs/promises";
import path from "node:path";
import { getVaultPath, slugify, writeNote } from "../vault.js";
import type { FeatureFrontmatter } from "../types.js";

export async function writeFeatureDoc(
  project: string,
  title: string,
  content: string
): Promise<{ path: string; overwritten: boolean }> {
  const filePath = path.join(
    getVaultPath(),
    "Projects",
    project,
    "Features",
    `${slugify(title)}.md`
  );

  const overwritten = await fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);

  const frontmatter: FeatureFrontmatter = {
    type: "feature",
    project,
    created: new Date().toISOString().slice(0, 10),
  };

  await writeNote(filePath, frontmatter as unknown as Record<string, unknown>, content);
  return { path: filePath, overwritten };
}
