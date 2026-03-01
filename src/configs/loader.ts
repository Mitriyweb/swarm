import { join } from "node:path";
import type { AgentSkillConfig, ToolConfig } from "@/types/config";

interface Frontmatter {
  [key: string]: string;
}

export class ConfigLoader {
  private skillsDir: string;
  private toolsDir: string;

  constructor(baseDir = join(import.meta.dir, "agents")) {
    this.skillsDir = join(baseDir, "skills");
    this.toolsDir = join(baseDir, "tools");
  }

  private parse(content: string): { frontmatter: Frontmatter; body: string } {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match || match[1] === undefined || match[2] === undefined) {
      return { frontmatter: {}, body: content.trim() };
    }
    const rawFrontmatter = match[1];
    const body = match[2].trim();

    const frontmatter: Frontmatter = {};
    for (const line of rawFrontmatter.split(/\r?\n/)) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      if (key) frontmatter[key] = value;
    }

    return { frontmatter, body };
  }

  async loadSkill(name: string): Promise<AgentSkillConfig> {
    const filePath = join(this.skillsDir, `${name}.md`);
    const file = Bun.file(filePath);
    const content = await file.text();
    const { frontmatter, body } = this.parse(content);

    return {
      name: frontmatter.name ?? name,
      role: frontmatter.role ?? "",
      instructions: body,
      description: frontmatter.description,
      color: frontmatter.color,
      structured: frontmatter.structured === "true",
    };
  }

  async loadAllSkills(): Promise<AgentSkillConfig[]> {
    const glob = new Bun.Glob("*.md");
    const skills: AgentSkillConfig[] = [];
    for await (const file of glob.scan(this.skillsDir)) {
      const name = file.replace(/\.md$/, "");
      skills.push(await this.loadSkill(name));
    }
    return skills;
  }

  async loadTool(name: string): Promise<ToolConfig> {
    const filePath = join(this.toolsDir, `${name}.md`);
    const file = Bun.file(filePath);
    const content = await file.text();
    const { frontmatter, body } = this.parse(content);

    const argsRaw = frontmatter.args;
    const args = argsRaw
      ? argsRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

    const timeoutRaw = frontmatter.timeout;
    const timeout = timeoutRaw ? Number.parseInt(timeoutRaw, 10) : undefined;

    return {
      name: frontmatter.name ?? name,
      description: (body || frontmatter.description) ?? "",
      timeout,
      requiresPathValidation: frontmatter.requiresPathValidation === "true",
      args,
    };
  }

  async loadAllTools(): Promise<ToolConfig[]> {
    const glob = new Bun.Glob("*.md");
    const tools: ToolConfig[] = [];
    for await (const file of glob.scan(this.toolsDir)) {
      const name = file.replace(/\.md$/, "");
      tools.push(await this.loadTool(name));
    }
    return tools;
  }
}
