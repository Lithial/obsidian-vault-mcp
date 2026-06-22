import fs from "node:fs/promises";
import path from "node:path";
import { getVaultPath, slugify, writeNote, readNote, globNotes } from "../vault.js";
import type { BugFrontmatter, BugNote, BugSummary } from "../types.js";

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

export async function getNextBug(
  project?: string
): Promise<{ found: true; bug: BugNote } | { found: false }> {
  const openBugs = await listBugs(project, "open");
  if (openBugs.length === 0) return { found: false };

  const topPriority = openBugs[0].priority;
  const topTier = openBugs.filter((b) => b.priority === topPriority);

  if (topTier.length === 1) {
    const { data, content } = await readNote(topTier[0].path);
    return {
      found: true,
      bug: {
        frontmatter: data as unknown as BugFrontmatter,
        content,
        path: topTier[0].path,
        title: topTier[0].title,
      },
    };
  }

  // Tie-break: read created dates and pick the oldest
  const withDates = await Promise.all(
    topTier.map(async (b) => {
      const { data, content } = await readNote(b.path);
      const raw = data["created"];
      const created = raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw);
      return { summary: b, data, content, created };
    })
  );
  withDates.sort((a, b) => a.created.localeCompare(b.created));
  const winner = withDates[0];

  return {
    found: true,
    bug: {
      frontmatter: winner.data as unknown as BugFrontmatter,
      content: winner.content,
      path: winner.summary.path,
      title: winner.summary.title,
    },
  };
}

export async function updateBugStatus(
  filePath: string,
  status: "open" | "in-progress" | "resolved"
): Promise<{ path: string; status: string }> {
  let data: Record<string, unknown>;
  let content: string;
  try {
    ({ data, content } = await readNote(filePath));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`File not found: ${filePath}`);
    throw e;
  }
  data["status"] = status;
  await writeNote(filePath, data, content);
  return { path: filePath, status };
}

export async function getBug(filePath: string): Promise<BugNote> {
  const { data, content } = await readNote(filePath);
  return {
    frontmatter: data as unknown as BugFrontmatter,
    content: content.trim(),
    path: filePath,
    title: path.basename(filePath, ".md"),
  };
}
