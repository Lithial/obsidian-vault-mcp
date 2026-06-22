import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import matter from "gray-matter";
import { writeBug, listBugs } from "../../src/tools/bugs.js";

describe("writeBug", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vault-test-"));
    process.env.VAULT_PATH = tmpDir;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates bug with correct frontmatter", async () => {
    const result = await writeBug("MyProject", "Player falls through floor", "Steps to repro...", 1);
    const raw = await fs.readFile(result.path, "utf-8");
    const { data, content } = matter(raw);
    expect(data.type).toBe("bug");
    expect(data.project).toBe("MyProject");
    expect(data.status).toBe("open");
    expect(data.priority).toBe(1);
    expect(content.trim()).toContain("Steps to repro");
    expect(result.overwritten).toBe(false);
  });

  it("defaults priority to 3", async () => {
    const result = await writeBug("MyProject", "Some bug", "desc");
    const raw = await fs.readFile(result.path, "utf-8");
    const { data } = matter(raw);
    expect(data.priority).toBe(3);
  });

  it("includes shortcut fields when provided", async () => {
    const result = await writeBug(
      "MyProject", "Bug with card", "desc", 2,
      "https://app.shortcut.com/org/story/123",
      "sc-123/fix-bug"
    );
    const raw = await fs.readFile(result.path, "utf-8");
    const { data } = matter(raw);
    expect(data.shortcut_card).toBe("https://app.shortcut.com/org/story/123");
    expect(data.shortcut_branch).toBe("sc-123/fix-bug");
  });

  it("omits shortcut fields when not provided", async () => {
    const result = await writeBug("MyProject", "Plain bug", "desc");
    const raw = await fs.readFile(result.path, "utf-8");
    const { data } = matter(raw);
    expect(data.shortcut_card).toBeUndefined();
    expect(data.shortcut_branch).toBeUndefined();
  });

  it("reports overwritten on duplicate", async () => {
    await writeBug("MyProject", "Same bug", "v1");
    const result = await writeBug("MyProject", "Same bug", "v2");
    expect(result.overwritten).toBe(true);
  });
});

describe("listBugs", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vault-test-"));
    process.env.VAULT_PATH = tmpDir;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array when no bugs exist", async () => {
    expect(await listBugs()).toEqual([]);
  });

  it("returns all open bugs sorted by priority", async () => {
    await writeBug("P1", "Low priority bug", "d", 5);
    await writeBug("P1", "High priority bug", "d", 1);
    await writeBug("P1", "Mid priority bug", "d", 3);
    const bugs = await listBugs();
    expect(bugs.map((b) => b.priority)).toEqual([1, 3, 5]);
  });

  it("filters by project", async () => {
    await writeBug("ProjectA", "Bug in A", "d");
    await writeBug("ProjectB", "Bug in B", "d");
    const bugs = await listBugs("ProjectA");
    expect(bugs).toHaveLength(1);
    expect(bugs[0].title).toBe("bug-in-a");
  });

  it("filters by status", async () => {
    await writeBug("P1", "Open bug", "d");
    await writeBug("P1", "Another bug", "d");
    // Manually write a resolved bug
    const resolvedPath = path.join(tmpDir, "Projects", "P1", "Bugs", "resolved-bug.md");
    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fs.writeFile(resolvedPath, "---\ntype: bug\nproject: P1\nstatus: resolved\npriority: 1\ncreated: 2026-01-01\n---\nbody");
    const open = await listBugs(undefined, "open");
    expect(open).toHaveLength(2);
    const resolved = await listBugs(undefined, "resolved");
    expect(resolved).toHaveLength(1);
  });
});
