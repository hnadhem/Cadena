---
description: Generate comprehensive tests for a given file
allowed-tools: Read, Write, Bash(cat package.json)
argument-hint: [filepath] [--framework] [--coverage-gaps]
---

Generate tests for $1.
First, read the file and identify: exported functions, edge cases,
error paths, and any integration points.
Check package.json to confirm the test framework in use.
If --coverage-gaps is passed, run existing tests first and only
generate tests for uncovered paths.
Follow the existing test style in the __tests__ folder.
Do not test implementation details - test behavior.
