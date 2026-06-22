import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import matter from "gray-matter";
import { writeFeatureDoc, listFeatures, getFeatureDoc } from "../../src/tools/features.js";

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

describe("listFeatures", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vault-test-"));
    process.env.VAULT_PATH = tmpDir;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array when no features exist", async () => {
    const result = await listFeatures();
    expect(result).toEqual([]);
  });

  it("lists features across all projects when no project given", async () => {
    await writeFeatureDoc("Alpha", "Feature One", "body");
    await writeFeatureDoc("Beta", "Feature Two", "body");
    const result = await listFeatures();
    expect(result).toHaveLength(2);
    const titles = result.map((f) => f.title);
    expect(titles).toContain("feature-one");
    expect(titles).toContain("feature-two");
  });

  it("scopes to a single project", async () => {
    await writeFeatureDoc("Alpha", "Feature One", "body");
    await writeFeatureDoc("Beta", "Feature Two", "body");
    const result = await listFeatures("Alpha");
    expect(result).toHaveLength(1);
    expect(result[0].project).toBe("Alpha");
  });

  it("returns results sorted alphabetically by title", async () => {
    await writeFeatureDoc("Alpha", "Zebra Feature", "body");
    await writeFeatureDoc("Alpha", "Apple Feature", "body");
    const result = await listFeatures("Alpha");
    expect(result[0].title).toBe("apple-feature");
    expect(result[1].title).toBe("zebra-feature");
  });
});

describe("getFeatureDoc", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vault-test-"));
    process.env.VAULT_PATH = tmpDir;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns frontmatter, content, path, and title", async () => {
    const written = await writeFeatureDoc("MyProject", "My Feature", "## Body\nHello.");
    const result = await getFeatureDoc(written.path);
    expect(result.frontmatter.type).toBe("feature");
    expect(result.frontmatter.project).toBe("MyProject");
    expect(result.content).toContain("Hello.");
    expect(result.path).toBe(written.path);
    expect(result.title).toBe("my-feature");
  });

  it("throws on a nonexistent path", async () => {
    await expect(getFeatureDoc("/nonexistent/path.md")).rejects.toThrow();
  });
});
