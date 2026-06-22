import fs from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getVaultPath } from "./vault.js";
import { listProjects } from "./tools/projects.js";
import { writeFeatureDoc } from "./tools/features.js";
import { writeBug, listBugs, getNextBug, updateBugStatus } from "./tools/bugs.js";

// Validate vault at startup
const vaultPath = getVaultPath();
try {
  await fs.access(vaultPath);
} catch {
  console.error(`[obsidian-vault-mcp] VAULT_PATH "${vaultPath}" does not exist or is inaccessible`);
  process.exit(1);
}

const server = new McpServer({ name: "obsidian-vault", version: "1.0.0" });

server.tool(
  "list_projects",
  "List all project names in the Obsidian vault",
  {},
  async () => {
    const projects = await listProjects();
    return { content: [{ type: "text" as const, text: JSON.stringify(projects) }] };
  }
);

server.tool(
  "write_feature_doc",
  "Write a feature document to the vault under a specific project",
  {
    project: z.string().describe("Project name"),
    title: z.string().describe("Feature title"),
    content: z.string().describe("Feature description in markdown"),
  },
  async ({ project, title, content }) => {
    const result = await writeFeatureDoc(project, title, content);
    const msg = result.overwritten
      ? `Overwrote existing feature doc: ${result.path}`
      : `Created feature doc: ${result.path}`;
    return { content: [{ type: "text" as const, text: msg }] };
  }
);

server.tool(
  "write_bug",
  "File a new bug in the vault under a specific project",
  {
    project: z.string().describe("Project name"),
    title: z.string().describe("Bug title"),
    description: z.string().describe("Bug description in markdown"),
    priority: z.number().int().min(1).optional().describe("Priority 1–N where 1 is highest (default 3)"),
    shortcut_card: z.string().optional().describe("Shortcut card URL (optional)"),
    shortcut_branch: z.string().optional().describe("Shortcut helper branch name (optional)"),
  },
  async ({ project, title, description, priority, shortcut_card, shortcut_branch }) => {
    const result = await writeBug(project, title, description, priority, shortcut_card, shortcut_branch);
    const msg = result.overwritten
      ? `Overwrote existing bug: ${result.path}`
      : `Created bug: ${result.path}`;
    return { content: [{ type: "text" as const, text: msg }] };
  }
);

server.tool(
  "get_next_bug",
  "Get the highest-priority open bug, optionally scoped to one project",
  {
    project: z.string().optional().describe("Project name — omit to search all projects"),
  },
  async ({ project }) => {
    const result = await getNextBug(project);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  }
);

server.tool(
  "update_bug_status",
  "Update the status of a bug note by its file path",
  {
    path: z.string().describe("Absolute path to the bug note file"),
    status: z.enum(["open", "in-progress", "resolved"]).describe("New status"),
  },
  async ({ path: filePath, status }) => {
    const result = await updateBugStatus(filePath, status);
    return { content: [{ type: "text" as const, text: `Updated ${result.path} → ${result.status}` }] };
  }
);

server.tool(
  "list_bugs",
  "List bugs in the vault, optionally filtered by project and/or status",
  {
    project: z.string().optional().describe("Project name — omit for all projects"),
    status: z.enum(["open", "in-progress", "resolved"]).optional().describe("Filter by status"),
  },
  async ({ project, status }) => {
    const bugs = await listBugs(project, status);
    return { content: [{ type: "text" as const, text: JSON.stringify(bugs) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
