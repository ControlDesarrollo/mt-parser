import pkg from "../package.json" with { type: "json" };
import { parse } from "./parse";

// A reader that closes the pipe early raises EPIPE asynchronously, outside the try/catch.
process.stdout.on("error", (e) => {
  process.stderr.write(`unexpected error: ${e.message}\n`);
  process.exitCode = 2;
});

async function main(args: string[]): Promise<number> {
  if (args.length > 0) {
    if (args.length === 1 && args[0] === "--version") {
      process.stdout.write(`${pkg.version}\n`);
      return 0;
    }
    process.stderr.write(`unknown argument: ${args[0]}\nusage: mt-parser [--version] < input.mdx\n`);
    return 2;
  }

  // fatal: invalid UTF-8 throws instead of being replaced silently (exit 2).
  const source = new TextDecoder("utf-8", { fatal: true }).decode(await Bun.stdin.arrayBuffer());
  const result = parse(source);
  process.stdout.write(JSON.stringify(result) + "\n");
  return result.ok ? 0 : 1;
}

try {
  // exitCode (not process.exit) lets stdout flush before the process ends.
  process.exitCode = await main(Bun.argv.slice(2));
} catch (e) {
  process.stderr.write(`unexpected error: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 2;
}
