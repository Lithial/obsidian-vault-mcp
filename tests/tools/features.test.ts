import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import matter from "gray-matter";
import { writeFeatureDoc } from "../../src/tools/features.js";

describe("writeFeatureDoc", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vault-test-"));
    process.env.VAULT_PATH = tmpDir;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates the file with correct frontmatter and content", async () => {
    const result = await writeFeatureDoc("MyProject", "Player Movement", "## Details\nFast movement.");
    expect(result.overwritten).toBe(false);
    const raw = await fs.readFile(result.path, "utf-8");
    const { data, content } = matter(raw);
    expect(data.type).toBe("feature");
    expect(data.project).toBe("MyProject");
    expect(typeof data.created).toBe("string");
    expect(content.trim()).toContain("Fast movement.");
  });

  it("slugifies the title for the filename", async () => {
    const result = await writeFeatureDoc("MyProject", "Weapon: Rocket Launcher", "content");
    expect(path.basename(result.path)).toBe("weapon-rocket-launcher.md");
  });

  it("creates missing directories", async () => {
    const result = await writeFeatureDoc("NewProject", "Some Feature", "body");
    const exists = await fs.access(result.path).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it("reports overwritten when file already exists", async () => {
    await writeFeatureDoc("MyProject", "Existing Feature", "v1");
    const result = await writeFeatureDoc("MyProject", "Existing Feature", "v2");
    expect(result.overwritten).toBe(true);
  });
});
