# obsidian-vault-mcp

A stdio MCP server for managing feature documentation and bug tracking inside an Obsidian vault, organised by project.

## Setup

```bash
npm install
npm run build
```

## Configuration

Set `VAULT_PATH` to the root of your Obsidian vault:

```bash
VAULT_PATH=/path/to/vault node dist/index.js
```

## omp Registration

Add to `~/.omp/agent/mcp.json`:

```json
"obsidian-vault": {
  "command": "node",
  "args": ["/absolute/path/to/obsidian-vault-mcp/dist/index.js"],
  "env": { "VAULT_PATH": "/path/to/your/obsidian/vault" }
}
```

## Tools

| Tool | Description |
|---|---|
| `list_projects` | List all projects in the vault |
| `write_feature_doc` | Write a feature doc under a project |
| `write_bug` | File a new bug under a project |
| `get_next_bug` | Get the highest-priority open bug |
| `update_bug_status` | Mark a bug open / in-progress / resolved |
| `list_bugs` | List bugs filtered by project and/or status |

## Vault Layout

```
<vault>/
  Projects/
    <ProjectName>/
      Features/<slug>.md
      Bugs/<slug>.md
```
