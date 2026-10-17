import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { Root } from "mdast";

const processor = unified()
  .use(remarkParse)
  .use(remarkMdx)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkGfm);

export type ParseError = { message: string; line: number | null; column: number | null };

export type ParseResult =
  | { ok: true; tree: Root }
  | { ok: false; error: ParseError };

/** Raised by micromark/mdast-util-mdx as a VFileMessage; anything else is unexpected. */
function isSyntaxError(e: unknown): e is Error & { reason?: string; line?: number | null; column?: number | null; place?: unknown } {
  return e instanceof Error && "reason" in e && "ruleId" in e && "source" in e;
}

export function parse(source: string): ParseResult {
  try {
    return { ok: true, tree: processor.parse(source) };
  } catch (e) {
    if (!isSyntaxError(e)) throw e;
    const place = e.place as any;
    const point = place?.start ?? place;
    const message = e.reason ?? e.message;
    // mdast-util-mdx-jsx errors (unclosed/mismatched tags) carry no place, only "(l:c-l:c)" in the text.
    const inText = /\((\d+):(\d+)(?:-\d+:\d+)?\)/.exec(message);
    return {
      ok: false,
      error: {
        message,
        line: e.line ?? point?.line ?? (inText ? Number(inText[1]) : null),
        column: e.column ?? point?.column ?? (inText ? Number(inText[2]) : null),
      },
    };
  }
}
