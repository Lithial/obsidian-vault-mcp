import fs from "node:fs/promises";
import path from "node:path";
import { getVaultPath, slugify, writeNote, readNote, globNotes } from "../vault.js";
import type { FeatureFrontmatter, FeatureNote, FeatureSummary } from "../types.js";

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

export async function listFeatures(project?: string): Promise<FeatureSummary[]> {
  const vaultPath = getVaultPath();
  const pattern = project
    ? path.join(vaultPath, "Projects", project, "Features", "*.md")
    : path.join(vaultPath, "Projects", "**", "Features", "*.md");

  const files = await globNotes(pattern);
  const summaries: FeatureSummary[] = [];

  for (const filePath of files) {
    try {
      const { data } = await readNote(filePath);
      summaries.push({
        title: path.basename(filePath, ".md"),
        path: filePath,
        project: String(data.project ?? ""),
        created: String(data.created ?? ""),
      });
    } catch {
      // skip unreadable files
    }
  }

  return summaries.sort((a, b) => a.title.localeCompare(b.title));
}

export async function getFeatureDoc(filePath: string): Promise<FeatureNote> {
  const { data, content } = await readNote(filePath);
  return {
    frontmatter: data as unknown as FeatureFrontmatter,
    content: content.trim(),
    path: filePath,
    title: path.basename(filePath, ".md"),
  };
}
