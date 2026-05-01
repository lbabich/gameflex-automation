# Tooling

## Linter / Formatter: Biome v2.x

Run before committing:

```
npm run check
```

Biome must be run from the project root — not via an absolute path argument. Use the subshell pattern when the working directory might be unreliable:

```
(cd "<project-root>" && node_modules/.bin/biome check --write .)
```
