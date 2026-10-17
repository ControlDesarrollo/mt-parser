# mt-parser

Parser de MDX a mdast. Lee MDX por stdin (UTF-8) y escribe el árbol mdast en JSON por stdout. Solo parsea: no valida ni transforma el árbol, y solo reporta errores de sintaxis.

Usa `unified` con `remark-parse`, `remark-mdx`, `remark-frontmatter` (yaml) y `remark-gfm`. El árbol incluye `position` y `data.estree` de las expresiones.

## Uso

```sh
mt-parser < example.mdx
mt-parser --version   # imprime la versión (ej. 0.1.0) y sale con 0, sin leer stdin
```

Cualquier otro argumento sale con `2` y un mensaje en stderr.

## Salida

Una sola línea JSON:

```json
{"ok": true, "tree": {"type": "root", "children": []}}
{"ok": false, "error": {"message": "...", "line": 3, "column": 1}}
```

`line` y `column` pueden ser `null` si el error no trae ubicación.

## Códigos de salida

- `0`: parseo correcto
- `1`: error de sintaxis
- `2`: error inesperado (mensaje en stderr), incluida la entrada que no es UTF-8 válido

Límite conocido: si stdout está cerrado desde el inicio (`mt-parser >&-`), no se garantiza el código de salida. Un lector que cierra el pipe a mitad de la salida sí da `2`.

## Build

```sh
bun install
bun run build   # genera dist/mt-parser
bun test
```
