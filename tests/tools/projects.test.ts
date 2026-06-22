import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { listProjects } from "../../src/tools/projects.js";

describe("listProjects", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vault-test-"));
    process.env.VAULT_PATH = tmpDir;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array when Projects dir does not exist", async () => {
    expect(await listProjects()).toEqual([]);
  });

  it("returns project directory names", async () => {
    await fs.mkdir(path.join(tmpDir, "Projects", "AlphaProject"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "Projects", "BetaProject"), { recursive: true });
    const projects = await listProjects();
    expect(projects.sort()).toEqual(["AlphaProject", "BetaProject"]);
  });

  it("ignores files, only returns directories", async () => {
    await fs.mkdir(path.join(tmpDir, "Projects", "RealProject"), { recursive: true });
    await fs.writeFile(path.join(tmpDir, "Projects", "not-a-project.md"), "");
    const projects = await listProjects();
    expect(projects).toEqual(["RealProject"]);
  });
});
