import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { slugify, getVaultPath, writeNote, readNote, globNotes } from "../src/vault.js";

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("replaces non-alphanumeric with hyphens", () => {
    expect(slugify("Bug: Fix the (thing)!")).toBe("bug-fix-the-thing");
  });

  it("collapses multiple hyphens", () => {
    expect(slugify("hello   world")).toBe("hello-world");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("  hello world  ")).toBe("hello-world");
  });

  it("truncates to 60 chars", () => {
    expect(slugify("a".repeat(70))).toHaveLength(60);
  });

  it('strips trailing hyphen introduced by truncation', () => {
    // 'a'.repeat(59) + '!extra' → after replace: 'aaa...a-extra', slice(0,60) = 'aaa...a-', strip → 'aaa...a'
    expect(slugify('a'.repeat(59) + '!extra')).toMatch(/[a-z0-9]$/);
  });
});

describe("getVaultPath", () => {
  it("throws when VAULT_PATH is not set", () => {
    const orig = process.env.VAULT_PATH;
    delete process.env.VAULT_PATH;
    expect(() => getVaultPath()).toThrow("VAULT_PATH");
    process.env.VAULT_PATH = orig;
  });

  it("returns VAULT_PATH when set", () => {
    process.env.VAULT_PATH = "/tmp/test-vault";
    expect(getVaultPath()).toBe("/tmp/test-vault");
  });
});

describe("writeNote / readNote / globNotes", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vault-test-"));
    process.env.VAULT_PATH = tmpDir;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("writes and reads a note with frontmatter", async () => {
    const filePath = path.join(tmpDir, "test.md");
    await writeNote(filePath, { type: "feature", project: "X" }, "body content");
    const { data, content } = await readNote(filePath);
    expect(data.type).toBe("feature");
    expect(data.project).toBe("X");
    expect(content.trim()).toBe("body content");
  });

  it("creates parent directories automatically", async () => {
    const filePath = path.join(tmpDir, "a", "b", "c.md");
    await writeNote(filePath, { type: "bug" }, "hello");
    const { data } = await readNote(filePath);
    expect(data.type).toBe("bug");
  });

  it("globs files matching a pattern", async () => {
    await writeNote(path.join(tmpDir, "a.md"), { type: "bug" }, "");
    await writeNote(path.join(tmpDir, "sub", "b.md"), { type: "bug" }, "");
    const files = await globNotes(path.join(tmpDir, "**", "*.md"));
    expect(files).toHaveLength(2);
  });

  it('returns date-like frontmatter values as strings, not Date objects', async () => {
    const filePath = path.join(tmpDir, 'dated.md');
    await writeNote(filePath, { created: '2026-06-22' }, 'body');
    const { data } = await readNote(filePath);
    expect(typeof data.created).toBe('string');
    expect(data.created).toBe('2026-06-22');
  });
});
