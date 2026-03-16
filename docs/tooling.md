# Tooling

## Linter / Formatter: Biome v2.x

Run before committing:

```
npm run check
```

Biome must be run from the project root — not via an absolute path argument. Use the subshell pattern when CWD might be unreliable:

```
(cd "C:/dev/gameflex/gameflex-automation" && node_modules/.bin/biome check --write .)
```
