export interface FeatureFrontmatter {
  type: "feature";
  project: string;
  created: string;
}

export interface FeatureSummary {
  title: string;
  path: string;
  project: string;
  created: string;
}

export interface FeatureNote {
  frontmatter: FeatureFrontmatter;
  content: string;
  path: string;
  title: string;
}

export interface BugFrontmatter {
  type: "bug";
  project: string;
  status: "open" | "in-progress" | "resolved";
  priority: number;
  created: string;
  shortcut_card?: string;
  shortcut_branch?: string;
}

export interface BugNote {
  frontmatter: BugFrontmatter;
  content: string;
  path: string;
  title: string;
}

export interface BugSummary {
  title: string;
  path: string;
  priority: number;
  status: BugFrontmatter['status'];
  shortcut_card?: string;
}
