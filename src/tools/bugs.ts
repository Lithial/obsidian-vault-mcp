import fs from "node:fs/promises";
import path from "node:path";
import { getVaultPath, slugify, writeNote, readNote, globNotes } from "../vault.js";
import type { BugFrontmatter, BugSummary } from "../types.js";

export async function writeBug(
  project: string,
  title: string,
  description: string,
  priority: number = 3,
  shortcut_card?: string,
  shortcut_branch?: string
): Promise<{ path: string; overwritten: boolean }> {
  const filePath = path.join(
    getVaultPath(),
    "Projects",
    project,
    "Bugs",
    `${slugify(title)}.md`
  );

  const overwritten = await fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);

  const frontmatter: BugFrontmatter = {
    type: "bug",
    project,
    status: "open",
    priority,
    created: new Date().toISOString().slice(0, 10),
    ...(shortcut_card ? { shortcut_card } : {}),
    ...(shortcut_branch ? { shortcut_branch } : {}),
  };

  await writeNote(filePath, frontmatter as unknown as Record<string, unknown>, description);
  return { path: filePath, overwritten };
}

export async function listBugs(
  project?: string,
  status?: string
): Promise<BugSummary[]> {
  const vaultPath = getVaultPath();
  const pattern = project
    ? path.join(vaultPath, "Projects", project, "Bugs", "*.md")
    : path.join(vaultPath, "Projects", "**", "Bugs", "*.md");

  const files = await globNotes(pattern);
  const summaries: BugSummary[] = [];

  for (const filePath of files) {
    const { data } = await readNote(filePath);
    if (data["type"] !== "bug") continue;
    if (status && data["status"] !== status) continue;

    summaries.push({
      title: path.basename(filePath, ".md"),
      path: filePath,
      priority: data["priority"] as number,
      status: data["status"] as BugFrontmatter["status"],
      ...(data["shortcut_card"] ? { shortcut_card: data["shortcut_card"] as string } : {}),
    });
  }

  return summaries.sort((a, b) => a.priority - b.priority);
}

// Placeholders — implemented in Task 6
export async function getNextBug(
  _project?: string
): Promise<{ found: false }> {
  return { found: false };
}

export async function updateBugStatus(
  _filePath: string,
  _status: "open" | "in-progress" | "resolved"
): Promise<{ path: string; status: string }> {
  throw new Error("Not yet implemented");
}
