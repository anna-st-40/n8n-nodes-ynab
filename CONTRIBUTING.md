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

4. Make your changes and build:
   ```bash
   npm run build
   ```

5. Test your changes with the Docker setup:
   ```bash
   docker-compose up -d
   ```

## Code Style

- This project uses TypeScript
- Run `npm run lint` before committing
- Use `npm run lintfix` to automatically fix linting issues
- Follow the existing code style and patterns

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

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help others learn and grow

## Questions?

Feel free to open an issue for questions or discussions!
