# mt-parser

CLI en Bun que lee MDX por stdin y escribe el mdast en JSON (una línea) por stdout. Solo parsea: no valida ni transforma el árbol. Se distribuye como binario compilado, no se publica en npm.

## Comandos

- `bun test`: tests (los del binario lo compilan solos antes de correr).
- `bun run build`: compila `./src/cli.ts` a `dist/mt-parser`.

## Reglas

- Dependencias con versión exacta, sin `^` ni `~`: el árbol resultante depende de ellas. Commitear `bun.lock`.
- Repo público: no agregar referencias internas (nombres de productos o de la empresa, rutas locales, otros repos, contenido real). Los fixtures son MDX sintético. No agregar LICENSE.
- Usar Bun en lugar de Node (`bun`, `bun test`, `bun install`).
