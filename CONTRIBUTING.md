# Contributing to Google Jobs IT Scraper

Thank you for your interest in contributing to the Google Jobs IT Scraper! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Coding Standards](#coding-standards)
- [Common Tasks](#common-tasks)

## Code of Conduct

Be respectful, constructive, and professional in all interactions.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/google-jobs-it-scraper.git
   cd google-jobs-it-scraper
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/original-repo/google-jobs-it-scraper.git
   ```

## Development Setup

### Prerequisites

- Node.js 20+ installed
- npm or yarn package manager
- Git
- Apify account (for testing)

### Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev
```

### Environment Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Add your Apify token to `.env`:
   ```env
   APIFY_TOKEN=your_token_here
   ```

## Making Changes

### Branch Naming

Use descriptive branch names:
- `feature/add-email-notifications`
- `fix/salary-parsing-bug`
- `docs/update-readme`
- `refactor/improve-error-handling`

### Commit Messages

Follow conventional commit format:
```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(scraper): add support for remote job filtering

fix(parser): handle edge case in salary parsing

docs(readme): add troubleshooting section
```

## Testing

### Local Testing

1. **Create test input** in `.actor/INPUT.json`:
   ```json
   {
     "searchQueries": ["Software Developer"],
     "locations": ["Berlin"],
     "maxResults": 10
   }
   ```

2. **Run the actor**:
   ```bash
   npm run dev
   ```

3. **Check results**:
   - Dataset: `./apify_storage/datasets/default/`
   - Logs: Console output
   - Stats: `./apify_storage/key_value_stores/default/`

### Testing Guidelines

- Test with small datasets first (maxResults: 10)
- Verify output data structure
- Check error handling
- Test edge cases
- Ensure no regressions

### Manual Test Checklist

- [ ] Actor starts successfully
- [ ] Input validation works correctly
- [ ] Jobs are scraped and saved to dataset
- [ ] Statistics are calculated correctly
- [ ] Errors are logged properly
- [ ] Checkpoint system works
- [ ] Deduplication works
- [ ] Filtering (excludeWords) works
- [ ] Proxy integration works (if configured)

## Submitting Changes

### Pull Request Process

1. **Update your fork**:
   ```bash
   git checkout main
   git pull upstream main
   ```

2. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes** and commit:
   ```bash
   git add .
   git commit -m "feat: your feature description"
   ```

4. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create a Pull Request** on GitHub

### Pull Request Guidelines

- Provide clear description of changes
- Reference related issues
- Include test results
- Update documentation if needed
- Ensure code passes linting
- Keep PRs focused and atomic

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How was this tested?

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Local testing successful
```

## Coding Standards

### TypeScript

- Use strict TypeScript mode
- Define types for all functions and variables
- Avoid `any` type (use `unknown` if necessary)
- Use meaningful variable names
- Add JSDoc comments for public functions

### Code Style

- Use ESLint configuration provided
- Format with consistent indentation (2 spaces)
- Maximum line length: 120 characters
- Use single quotes for strings
- Add semicolons

### Example:

```typescript
/**
 * Parse salary string to structured format
 * @param salaryText - Raw salary text from job listing
 * @returns Structured salary object or undefined
 */
export function parseSalary(salaryText: string): Salary | undefined {
    if (!salaryText) return undefined;

    // Implementation...
}
```

### Logging

- Use Apify log levels appropriately:
  - `log.error()` - Critical errors
  - `log.warning()` - Warnings, non-critical issues
  - `log.info()` - Important information
  - `log.debug()` - Detailed debugging info

- Include context in logs:
  ```typescript
  log.info('Scraped jobs', { count: jobs.length, query: query.query });
  ```

## Common Tasks

### Adding a New Feature

1. Check if feature is needed (open an issue first for discussion)
2. Create feature branch
3. Implement feature with tests
4. Update documentation
5. Submit PR

### Fixing a Bug

1. Create an issue describing the bug
2. Create fix branch
3. Fix the bug
4. Add test to prevent regression
5. Submit PR

### Updating Dependencies

```bash
# Check for outdated packages
npm outdated

# Update specific package
npm update package-name

# Update all packages
npm update

# Test after updates
npm run build
npm run dev
```

### Updating HTML Selectors

Google frequently changes its HTML structure. To update selectors:

1. **Inspect Google Jobs page** in browser DevTools
2. **Find new selectors** for job cards and data fields
3. **Update** `src/scraper.ts` in `parseJobListings()` method
4. **Test** with various search queries
5. **Document** changes in commit message

Example:
```typescript
// Old selector
const title = $card.find('h3').first().text();

// New selector (if Google changes structure)
const title = $card.find('[data-job-title]').first().text();
```

### Adding New Data Fields

1. **Update types** in `src/types.ts`:
   ```typescript
   export interface ScrapedJob {
       // ... existing fields
       newField: string;
   }
   ```

2. **Extract data** in `src/scraper.ts`:
   ```typescript
   const newField = $card.find('.new-selector').text();
   ```

3. **Add to job object**:
   ```typescript
   const job: ScrapedJob = {
       // ... existing fields
       newField,
   };
   ```

4. **Update README** with new field documentation

## Documentation

### When to Update Documentation

- Adding new features
- Changing input parameters
- Modifying output format
- Changing configuration
- Adding dependencies
- Fixing important bugs

### Documentation Files

- `README.md` - Main documentation
- `DEPLOYMENT.md` - Deployment instructions
- `PROJECT_STRUCTURE.md` - Architecture overview
- `CHANGELOG.md` - Version history
- Code comments - Inline documentation

## Questions?

- Open an issue for questions
- Check existing issues and PRs
- Review documentation

## License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 License.

---

**Thank you for contributing! 🎉**
