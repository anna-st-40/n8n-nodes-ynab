# Contributing to n8n-nodes-ynab-api

Thank you for your interest in contributing! This document provides guidelines for contributing to this project.

## Development Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/n8n-nodes-ynab.git
   cd n8n-nodes-ynab
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

   This launches a local n8n with this node installed and rebuilds it on every
   save, so you can drag the YNAB node onto a canvas and try your change
   immediately. n8n data lives in `~/.n8n-node-cli`, separate from any n8n you
   already run.

   To build once without starting n8n, run `npm run build`.

## Project Layout

```
.
├── credentials/
│   └── YnabApi.credentials.ts      # YNAB API credentials definition
├── icons/
│   ├── ynab.svg                    # Node and credential icon (light theme)
│   └── ynab.dark.svg               # Dark theme variant
├── nodes/
│   └── Ynab/
│       ├── Ynab.node.ts            # Main node implementation
│       └── Ynab.node.json          # Node codex metadata
├── examples/                       # Importable example workflows
├── dist/                           # Compiled JavaScript (generated)
├── eslint.config.mjs               # Lint rules (n8n community node preset)
├── package.json                    # Node package configuration
└── tsconfig.json                   # TypeScript configuration
```

## Available Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Run n8n locally with this node, rebuilding on change |
| `npm run build` | Compile TypeScript and copy icons and codex metadata into `dist/` |
| `npm run build:watch` | Compile on change, without starting n8n |
| `npm run lint` | Check the node against the n8n community node rules |
| `npm run lint:fix` | Fix what the linter can fix automatically |
| `npm run format` | Format sources with Prettier |
| `npm run release` | Cut a release (maintainers only, see below) |

## Code Style

- This project uses TypeScript
- Run `npm run lint` before committing
- Use `npm run lint:fix` to automatically fix linting issues
- Follow the existing code style and patterns

The linter runs in n8n's strict mode (`n8n.strict` in `package.json`), which
checks the rules n8n applies when verifying a community node — naming, option
ordering, icon variants, and deprecated API use. CI runs the same checks, so a
clean `npm run lint` locally means a green build.

## Testing

- Test your changes thoroughly with actual YNAB API
- Include examples in your pull request description
- Test with both successful and error scenarios

## Pull Request Process

1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Make your changes and commit with clear messages
3. Push to your fork: `git push origin feature/your-feature-name`
4. Open a Pull Request with:
   - Clear description of changes
   - Why the changes are needed
   - Any relevant issue numbers
   - Screenshots/examples if applicable

## Adding New Operations

When adding new YNAB API operations:

1. Check the [YNAB API documentation](https://api.ynab.com) for the endpoint
2. Add the operation to the appropriate resource in `Ynab.node.ts`
3. Use the declarative-style routing pattern
4. Add proper TypeScript types
5. Test the operation end-to-end

## Releasing (maintainers)

```bash
npm run release
```

This lints, builds, prompts for the version bump, updates `CHANGELOG.md`, then
commits, tags, and pushes. Pushing the tag triggers the publish workflow, which
publishes to npm with a provenance attestation — n8n requires community nodes to
be published this way. Do not run `npm publish` by hand; `prepublishOnly` blocks
it, because a manual publish produces no provenance.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help others learn and grow

## Questions?

Feel free to open an issue for questions or discussions!
