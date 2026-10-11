import { expect, test } from "bun:test";
import { pluginFaults, skillFaults, treeFaults } from "./gate";

const skill = (front: string) => `---\n${front}\n---\n\nBody.\n`;

test("frontmatter: a valid skill passes", () => {
  expect(skillFaults("read-back", skill("name: read-back\ndescription: Read my prompt back to me.\ndisable-model-invocation: true"))).toEqual([]);
  expect(skillFaults("a1", skill('name: "a1"\ndescription: "Quoted."'))).toEqual([]);
});

test("frontmatter: each rule fails on its own", () => {
  const one = (folder: string, front: string, says: string) => expect(skillFaults(folder, skill(front)).join("\n")).toContain(says);
  one("x", "name: y\ndescription: d", "isn't its folder's name");
  one("Bad_Name", "name: Bad_Name\ndescription: d", "lowercase words");
  one("a--b", "name: a--b\ndescription: d", "lowercase words");
  one("a".repeat(65), `name: ${"a".repeat(65)}\ndescription: d`, "≤ 64");
  one("x", "name: x", "description is 0 chars");
  one("x", `name: x\ndescription: ${"d".repeat(1025)}`, "1–1024");
  one("x", "name: x\ndescription: use <tool> here", "no XML tags");
  expect(skillFaults("x", "no frontmatter")[0]).toContain("no frontmatter");
});

test("tree: skills/ holds only SKILL.md and references; artifacts and unlisted roots fail", () => {
  expect(treeFaults(["skills/a/SKILL.md", "skills/a/references/b.md", "README.md"])).toEqual([]);
  const f = treeFaults(["skills/a/run.sh", "skills/a/NOTES.md", "docs/x.md", "stray.txt"]).join("\n");
  for (const bad of ["skills/a/run.sh", "skills/a/NOTES.md", "docs/x.md: under docs/", "stray.txt: a root entry"]) expect(f).toContain(bad);
});

test("plugin: remote entries need no plugin.json; local ones must match it", () => {
  const files = (market: unknown, plugin?: unknown) => (f: string) => {
    const v = f.endsWith("marketplace.json") ? market : plugin;
    if (v === undefined) throw new Error("ENOENT");
    return JSON.stringify(v);
  };
  const github = { name: "read-back", source: { source: "github", repo: "Omnixenon/read-back" } };
  expect(pluginFaults(files({ plugins: [github] }))).toEqual([]);
  expect(pluginFaults(files({ plugins: [{ name: "a", source: "./" }] }, { name: "a" }))).toEqual([]);
  const one = (market: unknown, says: string, plugin?: unknown) => expect(pluginFaults(files(market, plugin)).join("\n")).toContain(says);
  one({ plugins: [] }, "no plugins");
  one({ plugins: [{ name: "a", source: "./" }] }, "plugin.json: missing");
  one({ plugins: [{ name: "a", source: "./" }] }, "isn't plugin.json's name", { name: "b" });
  one({ plugins: [{ name: "a", source: "../a" }] }, 'starts with "./"');
  one({ plugins: [{ ...github, source: { source: "github", repo: "read-back" } }] }, "owner/name");
  one({ plugins: [{ ...github, source: { source: "npm" } }] }, "neither");
  one({ plugins: [{ ...github, name: "Bad Name" }] }, "lowercase words");
});
