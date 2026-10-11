// `bun run gate`: tests → tree → skills → plugin → caps, stopping at the first red stage.
// `bun scripts/gate.ts --staged` (pre-commit): the same audits, read from the index being committed.
import { spawnSync } from "bun";
import { existsSync, lstatSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

/** Every root entry. A new one is a decision made in a diff, not a file that arrives. */
export const ROOT_ALLOWED = new Set(["README.md", "LICENSE", "AGENTS.md", "CLAUDE.md", "package.json", ".gitignore", ".githooks", ".claude", ".claude-plugin", "scripts", "skills"]);
/** Under skills/: a skill's SKILL.md, and optional reference pages. Nothing else. */
const SKILL_FILE = /^skills\/[^/]+\/(SKILL\.md|references\/[^/]+\.md)$/;

/** A file whose name says it's a working note, not the product. Notes, research and plans live outside the repo. */
export const PROCESS_ARTIFACTS: RegExp[] = [
  /^(.*-)?notes?\.(md|txt)$/i,
  /^notes?-.*\.(md|txt)$/i,
  /^(.*-)?summary\.(md|txt)$/i,
  /^(.*-)?plans?\.(md|txt)$/i,
  /^todos?(\..*)?$/i,
  /^scratch([-.].*)?$/i,
  /^(tmp|temp)([-.].*)?$/i,
  /\.(bak|orig|rej)$/i,
  /^\d{4}-\d{2}-\d{2}/, // dated: a snapshot of a session
  /^\.DS_Store$/,
];
/** Folders that are process by definition, anywhere in the tree. */
export const BANNED_DIRS = new Set(["docs", "research", "memory", "notes", "plans", "scratch", "tmp"]);

export function treeFaults(files: string[]): string[] {
  const out: string[] = [];
  for (const top of new Set(files.map((f) => f.split("/")[0]!))) if (!ROOT_ALLOWED.has(top)) out.push(`${top}: a root entry ROOT_ALLOWED (scripts/gate.ts) doesn't list`);
  for (const f of files) {
    const parts = f.split("/");
    const dir = parts.slice(0, -1).find((p) => BANNED_DIRS.has(p));
    if (dir) out.push(`${f}: under ${dir}/, which is process, not product; it lives outside the repo`);
    else if (PROCESS_ARTIFACTS.some((p) => p.test(parts.at(-1)!))) out.push(`${f}: a process artifact by its name; fold it into what owns the subject or delete it`);
    if (f.startsWith("skills/") && !SKILL_FILE.test(f)) out.push(`${f}: skills/ holds only <name>/SKILL.md and <name>/references/*.md`);
    if (f.startsWith(".github/workflows/")) out.push(`${f}: no hosted CI; the gate is local (.githooks)`);
  }
  return out;
}

const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const XML = /<\/?[A-Za-z][^>]*>/;

/** A SKILL.md's frontmatter against the Agent Skills spec: `folder` is its directory's name. */
// ponytail: single-line `key: value` frontmatter only; a YAML block scalar (`description: >`) reads as its marker and fails loud.
export function skillFaults(folder: string, text: string): string[] {
  const where = `skills/${folder}/SKILL.md`;
  const front = /^---\n([\s\S]*?)\n---(\n|$)/.exec(text)?.[1];
  if (front === undefined) return [`${where}: no frontmatter (--- name/description ---)`];
  const field = (k: string) => new RegExp(`^${k}:[ \\t]*(.*)$`, "m").exec(front)?.[1]?.trim().replace(/^(["'])(.*)\1$/, "$2") ?? "";
  const name = field("name");
  const description = field("description");
  const out: string[] = [];
  if (name !== folder) out.push(`${where}: name "${name}" isn't its folder's name "${folder}"`);
  if (!NAME.test(name) || name.length > 64) out.push(`${where}: name "${name}" must be lowercase words joined by single hyphens, ≤ 64 chars`);
  if (description.length < 1 || description.length > 1024) out.push(`${where}: description is ${description.length} chars; it must be 1–1024`);
  if (XML.test(name) || XML.test(description)) out.push(`${where}: name and description hold no XML tags`);
  return out;
}

/** .claude-plugin's two manifests parse, and every marketplace entry names this plugin. */
export function pluginFaults(read: (f: string) => string): string[] {
  const parse = (f: string) => {
    try {
      return JSON.parse(read(f));
    } catch (e) {
      return `${f}: missing or not JSON (${e instanceof Error ? e.message : e})`;
    }
  };
  const plugin = parse(".claude-plugin/plugin.json");
  const market = parse(".claude-plugin/marketplace.json");
  const bad = [plugin, market].filter((x) => typeof x === "string");
  if (bad.length) return bad;
  const names: unknown[] = Array.isArray(market.plugins) ? market.plugins.map((p: { name?: unknown }) => p?.name) : [];
  if (!names.length) return [".claude-plugin/marketplace.json: no plugins"];
  return names.filter((n) => n !== plugin.name).map((n) => `.claude-plugin/marketplace.json: plugin "${n}" isn't plugin.json's name "${plugin.name}"`);
}

export type Caps = Record<string, number>;
/** Lines per capped file (by cap key); a cap missing is a fault, and (against `was`, HEAD's caps) one raised is too. */
export function capFaults(caps: Caps, was: Caps | undefined, capped: Record<string, string[]>, read: (f: string) => string): string[] {
  return Object.entries(capped).flatMap(([key, files]) => {
    const cap = caps[key];
    if (typeof cap !== "number") return [`scripts/caps.json: "${key}" is missing; a cap only goes down, never away`];
    if (was && typeof was[key] === "number" && cap > was[key]) return [`scripts/caps.json: "${key}" raised ${was[key]} → ${cap}; caps only go down`];
    return files.flatMap((f) => {
      const n = read(f).trimEnd().split("\n").length;
      return n > cap ? [`${f}: ${n} lines, over its cap of ${cap} (scripts/caps.json "${key}")`] : [];
    });
  });
}

const git = (...args: string[]) => {
  const r = spawnSync(["git", ...args], { cwd: ROOT, stderr: "ignore" });
  return r.exitCode === 0 ? r.stdout.toString() : undefined;
};
const lines = (s = "") => s.split("\n").filter(Boolean);

/** The tree: the index (`staged`); else git's tracked and untracked files, ignored ones left out; with no repo, the disk minus what .gitignore drops. */
function files(staged: boolean): string[] {
  if (staged) return lines(git("ls-files", "--cached"));
  const tracked = git("ls-files", "--cached", "--others", "--exclude-standard");
  if (tracked !== undefined) return lines(tracked).filter((f) => existsSync(join(ROOT, f)));
  // ponytail: no repo yet, so .gitignore is mirrored by hand here; drop this branch once `git init` has run.
  return [...new Bun.Glob("**").scanSync({ cwd: ROOT, dot: true })].filter((f) => !/(^|\/)(node_modules|\.git)\/|(^|\/)\.DS_Store$/.test(f) && !f.startsWith(".claude/")).sort();
}

export function audit(staged: boolean): [string, string[]][] {
  const tree = files(staged);
  const read = (f: string) => (staged ? (git("show", `:${f}`) ?? "") : existsSync(join(ROOT, f)) ? readFileSync(join(ROOT, f), "utf8") : "");
  const skills = tree.filter((f) => /^skills\/[^/]+\/SKILL\.md$/.test(f));
  const treeOut = treeFaults(tree);
  if (existsSync(join(ROOT, ".github/workflows"))) treeOut.push(".github/workflows: no hosted CI; the gate is local (.githooks)");
  if (!staged && !(lstatSync(join(ROOT, "CLAUDE.md"), { throwIfNoEntry: false })?.isSymbolicLink() && readlinkSync(join(ROOT, "CLAUDE.md")) === "AGENTS.md")) treeOut.push("CLAUDE.md: must be a symlink to AGENTS.md");
  const parse = (s: string | undefined) => {
    try {
      return s ? (JSON.parse(s) as Caps) : undefined;
    } catch {}
  };
  const caps = parse(read("scripts/caps.json"));
  const capped = { "agents-md-lines": ["AGENTS.md"], "readme-lines": ["README.md"], "skill-md-lines": skills };
  return [
    ["tree", treeOut],
    ["skills", skills.length ? skills.flatMap((f) => skillFaults(f.split("/")[1]!, read(f))) : ["skills/: no <name>/SKILL.md"]],
    ["plugin", pluginFaults(read)],
    ["caps", caps ? capFaults(caps, parse(git("show", "HEAD:scripts/caps.json")), capped, read) : ["scripts/caps.json: missing or not JSON"]],
  ];
}

if (import.meta.main) {
  const staged = process.argv.includes("--staged");
  if (!staged) {
    const r = spawnSync(["bun", "test", "scripts/"], { cwd: ROOT, stdout: "inherit", stderr: "inherit" });
    console.log(`${r.exitCode === 0 ? "✓" : "✖"} tests`);
    if (r.exitCode !== 0) process.exit(1);
  }
  for (const [name, faults] of audit(staged)) {
    for (const f of faults) console.error(`  ${f}`);
    console.log(`${faults.length ? "✖" : "✓"} ${name}${staged ? " [staged]" : ""}${faults.length ? `: ${faults.length} fault(s)` : ""}`);
    if (faults.length) process.exit(1);
  }
}
