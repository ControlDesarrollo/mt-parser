import { join } from "node:path";
import { beforeAll, describe, expect, test } from "bun:test";
import { parse } from "../src/parse";

function tree(source: string): any {
  const r = parse(source);
  if (!r.ok) throw new Error(r.error.message);
  return r.tree;
}

describe("parse", () => {
  test("flow component keeps text attributes as strings", () => {
    const node = tree('<Read minSeconds="20">\n\nHello\n\n</Read>\n').children[0];
    expect(node.type).toBe("mdxJsxFlowElement");
    expect(node.name).toBe("Read");
    expect(node.attributes[0]).toMatchObject({ type: "mdxJsxAttribute", name: "minSeconds", value: "20" });
    expect(node.position.start.line).toBe(1);
  });

  test("frontmatter becomes a yaml node", () => {
    const first = tree("---\ntitle: Hi\n---\n\n# H\n").children[0];
    expect(first).toMatchObject({ type: "yaml", value: "title: Hi" });
  });

  test("gfm table", () => {
    const node = tree("| a | b |\n| - | - |\n| 1 | 2 |\n").children[0];
    expect(node.type).toBe("table");
    expect(node.children).toHaveLength(2);
  });

  test("comment is an mdxFlowExpression with estree that survives JSON", () => {
    const node = tree("{/* note */}\n").children[0];
    expect(node.type).toBe("mdxFlowExpression");
    expect(node.data.estree.type).toBe("Program");
    const roundTrip = JSON.parse(JSON.stringify(node));
    expect(roundTrip.data.estree).toEqual(node.data.estree);
    expect(roundTrip.data.estree.comments?.[0]?.value).toBe(" note ");
  });

  test("stray brace reports line and column", () => {
    const r = parse("ok\n\ntext {\n");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatchObject({ line: 3, column: 7 });
  });

  test("unclosed tag reports line and column", () => {
    const r = parse("x\n\n<A>\n");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatchObject({ line: 3, column: 1 });
  });
});

describe("edge cases", () => {
  test("empty input gives an empty root", () => {
    expect(tree("").children).toEqual([]);
  });

  test("BOM is stripped", () => {
    expect(tree("﻿# Hi\n").children[0].type).toBe("heading");
  });

  test("CRLF line endings parse and report positions", () => {
    expect(tree("# Hi\r\n\r\ntext\r\n").children).toHaveLength(2);
    const r = parse("x\r\n\r\n<A>\r\n");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatchObject({ line: 3, column: 1 });
  });

  test("multibyte UTF-8 is preserved", () => {
    expect(tree("# Áéí 日本 🎉\n").children[0].children[0].value).toBe("Áéí 日本 🎉");
  });

  test("import/export is mdxjsEsm with estree", () => {
    const node = tree('import A from "./a"\n\n# Hi\n').children[0];
    expect(node.type).toBe("mdxjsEsm");
    expect(node.data.estree.type).toBe("Program");
  });

  test("mismatched closing tag is a syntax error with location", () => {
    const r = parse("<A b={1}>x</B>\n");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.line).toBe(1);
  });
});

const { version } = await Bun.file(join(import.meta.dir, "../package.json")).json();

describe("cli from source", () => {
  const cli = join(import.meta.dir, "../src/cli.ts");
  const run = async (args: string[]) => {
    const p = Bun.spawn(["bun", cli, ...args], { stdin: new Blob([""]), stdout: "pipe", stderr: "pipe" });
    const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
    return { out, err, code };
  };

  test("--version prints the package.json version and exits 0", async () => {
    const { out, code } = await run(["--version"]);
    expect(code).toBe(0);
    expect(out).toBe(`${version}\n`);
  });

  test("unknown argument exits 2", async () => {
    const { out, err, code } = await run(["--nope"]);
    expect(code).toBe(2);
    expect(out).toBe("");
    expect(err).toContain("unknown argument: --nope");
  });
});

describe("compiled binary", () => {
  const root = join(import.meta.dir, "..");
  const bin = join(root, "dist/mt-parser");
  const run = async (input: string | Uint8Array, args: string[] = []) => {
    const p = Bun.spawn([bin, ...args], { stdin: new Blob([input]), stdout: "pipe", stderr: "pipe" });
    const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
    return { out, err, code };
  };

  beforeAll(async () => {
    const build = Bun.spawn(["bun", "run", "build"], { cwd: root, stdout: "pipe", stderr: "pipe" });
    expect(await build.exited).toBe(0);
  }, 60_000);

  test("valid fixture exits 0 with a single JSON line", async () => {
    const { out, code } = await run(await Bun.file(join(root, "test/fixtures/sample.mdx")).text());
    expect(code).toBe(0);
    expect(out.trim().split("\n")).toHaveLength(1);
    expect(JSON.parse(out).ok).toBe(true);
  });

  test("syntax error exits 1 with a single JSON line", async () => {
    const { out, code } = await run("x\n\n<A>\n");
    expect(code).toBe(1);
    expect(out.trim().split("\n")).toHaveLength(1);
    expect(JSON.parse(out)).toMatchObject({ ok: false, error: { line: 3, column: 1 } });
  });

  test("--version prints the package.json version and exits 0", async () => {
    const { out, code } = await run("", ["--version"]);
    expect(code).toBe(0);
    expect(out).toBe(`${version}\n`);
  });

  test("unknown argument exits 2 with a message on stderr", async () => {
    const { out, err, code } = await run("# Hi\n", ["--nope"]);
    expect(code).toBe(2);
    expect(out).toBe("");
    expect(err).toContain("unknown argument: --nope");
  });

  test("BOM is stripped by the CLI", async () => {
    const { out, code } = await run(new Uint8Array([0xef, 0xbb, 0xbf, 0x23, 0x20, 0x48, 0x69, 0x0a]));
    expect(code).toBe(0);
    const tree = JSON.parse(out).tree;
    expect(tree.children[0].type).toBe("heading");
    expect(tree.children[0].position.start).toMatchObject({ line: 1, column: 1 });
  });

  test("invalid UTF-8 exits 2 with a message on stderr", async () => {
    const { out, err, code } = await run(new Uint8Array([0xff, 0xfe, 0x23, 0x20, 0x78]));
    expect(code).toBe(2);
    expect(out).toBe("");
    expect(err).toContain("unexpected error");
  });
});
