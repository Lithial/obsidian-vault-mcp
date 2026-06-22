import fs from "node:fs/promises";
import path from "node:path";
import { getVaultPath } from "../vault.js";

export async function listProjects(): Promise<string[]> {
  const projectsDir = path.join(getVaultPath(), "Projects");
  try {
    const entries = await fs.readdir(projectsDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}
