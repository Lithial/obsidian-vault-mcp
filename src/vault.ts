import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import fg from "fast-glob";
import yaml from "js-yaml";
const { glob } = fg;

export function getVaultPath(): string {
  const vaultPath = process.env.VAULT_PATH;
  if (!vaultPath) {
    throw new Error("VAULT_PATH environment variable is required");
  }
  return vaultPath;
}

export function detectDefaultProject(): string | undefined {
  return process.env.PROJECT_NAME || undefined;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function writeNote(
  filePath: string,
  frontmatter: Record<string, unknown>,
  content: string
): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const fileContent = matter.stringify(content, frontmatter);
  await fs.writeFile(filePath, fileContent, "utf-8");
}

export async function readNote(
  filePath: string
): Promise<{ data: Record<string, unknown>; content: string }> {
  const raw = await fs.readFile(filePath, "utf-8");
  const { data, content } = matter(raw, {
    engines: { yaml: { parse: (str: string) => yaml.load(str, { schema: yaml.JSON_SCHEMA }) as Record<string, unknown> } },
  });
  return { data, content };
}

export async function globNotes(pattern: string): Promise<string[]> {
  return glob(pattern.replace(/\\/g, "/"), { absolute: true });
}
