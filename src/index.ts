import http from "node:http";
import fs from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { getVaultPath, detectDefaultProject } from "./vault.js";
import { listProjects } from "./tools/projects.js";
import { writeFeatureDoc, listFeatures, getFeatureDoc } from "./tools/features.js";
import { writeBug, listBugs, getNextBug, updateBugStatus } from "./tools/bugs.js";

// Validate vault at startup
const vaultPath = getVaultPath();
try {
  await fs.access(vaultPath);
} catch {
  console.error(`[obsidian-vault-mcp] VAULT_PATH "${vaultPath}" does not exist or is inaccessible`);
  process.exit(1);
}

const defaultProject = await detectDefaultProject();
if (defaultProject) {
  console.error(`[obsidian-vault-mcp] Default project: ${defaultProject}`);
}

function buildServer(): McpServer {
  const server = new McpServer({ name: "obsidian-vault", version: "1.0.0" });

  const projectDesc = defaultProject
    ? `Project name — defaults to "${defaultProject}"`
    : "Project name";

  // Resolves project for write tools: explicit arg > env/git default > error
  function requireProject(arg: string | undefined): string {
    const resolved = arg || defaultProject;
    if (!resolved) throw new Error("No project specified and no default project detected (set PROJECT_NAME or run from a git repo)");
    return resolved;
  }

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
      project: z.string().optional().describe(projectDesc),
      title: z.string().describe("Feature title"),
      content: z.string().describe("Feature description in markdown"),
    },
    async ({ project, title, content }) => {
      const result = await writeFeatureDoc(requireProject(project), title, content);
      const msg = result.overwritten
        ? `Overwrote existing feature doc: ${result.path}`
        : `Created feature doc: ${result.path}`;
      return { content: [{ type: "text" as const, text: msg }] };
    }
  );

  server.tool(
    "list_features",
    "List feature documents in the vault, optionally scoped to one project",
    {
      project: z.string().optional().describe(`Project name — defaults to "${defaultProject ?? "all projects"}"`),
    },
    async ({ project }) => {
      const features = await listFeatures(project ?? defaultProject);
      return { content: [{ type: "text" as const, text: JSON.stringify(features) }] };
    }
  );

  server.tool(
    "get_feature_doc",
    "Read the full content and metadata of a feature document by its file path",
    {
      path: z.string().describe("Absolute path to the feature doc file"),
    },
    async ({ path: filePath }) => {
      const feature = await getFeatureDoc(filePath);
      return { content: [{ type: "text" as const, text: JSON.stringify(feature) }] };
    }
  );

  server.tool(
    "write_bug",
    "File a new bug in the vault under a specific project",
    {
      project: z.string().optional().describe(projectDesc),
      title: z.string().describe("Bug title"),
      description: z.string().describe("Bug description in markdown"),
      priority: z.number().int().min(1).optional().describe("Priority 1–N where 1 is highest (default 3)"),
      shortcut_card: z.string().optional().describe("Shortcut card URL (optional)"),
      shortcut_branch: z.string().optional().describe("Shortcut helper branch name (optional)"),
    },
    async ({ project, title, description, priority, shortcut_card, shortcut_branch }) => {
      const result = await writeBug(requireProject(project), title, description, priority, shortcut_card, shortcut_branch);
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
      project: z.string().optional().describe(`Project name — defaults to "${defaultProject ?? "all projects"}"`),
    },
    async ({ project }) => {
      const result = await getNextBug(project ?? defaultProject);
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
      project: z.string().optional().describe(`Project name — defaults to "${defaultProject ?? "all projects"}"`),
      status: z.enum(["open", "in-progress", "resolved"]).optional().describe("Filter by status"),
    },
    async ({ project, status }) => {
      const bugs = await listBugs(project ?? defaultProject, status);
      return { content: [{ type: "text" as const, text: JSON.stringify(bugs) }] };
    }
  );


  return server;
}

if (process.env.MCP_TRANSPORT === "http") {
  const port = Number(process.env.PORT ?? 3940);

  const httpServer = http.createServer(async (req, res) => {
    console.log(`[obsidian-vault-mcp] ${req.method} ${req.url}`);

    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (req.method === "POST" && req.url === "/mcp") {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body: unknown = JSON.parse(Buffer.concat(chunks).toString());

        // Defensive header tolerance — ensures SDK 406/415 checks pass for lenient clients
        req.rawHeaders.push("Accept", "application/json, text/event-stream");
        req.rawHeaders.push("Content-Type", "application/json");

        const server = buildServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        });
        res.on("close", () => { void transport.close(); void server.close(); });
        await server.connect(transport);
        await transport.handleRequest(req, res, body);
      } catch (err) {
        console.error("[obsidian-vault-mcp] Request error:", err);
        if (!res.headersSent) {
          res.writeHead(500);
          res.end("Internal Server Error");
        }
      }
      return;
    }

    res.writeHead(404);
    res.end();
  });

  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`[obsidian-vault-mcp] HTTP transport listening on port ${port}`);
  });
} else {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
