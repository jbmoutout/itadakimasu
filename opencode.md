# Code exploration rules

You have a 32K context window. Budget it carefully.

## Exploration strategy

1. **Triage first.** Use `head -n 30 FILE` to preview files before reading them fully. Only `cat -n` a file when you've confirmed it's relevant to your findings.

2. **Limit full reads.** Read at most 5 files in full. For everything else, use `head` or `grep -n PATTERN FILE` to extract only the relevant lines.

3. **Cite what you find.** Every observation should include a file path and line number (e.g., `route.ts:35`). Use `grep -n` or `cat -n` to get line numbers.

4. **Cross-reference with grep, not cat.** When checking if a pattern is consistent across the codebase, use `grep -rn "PATTERN" app/ lib/` — never cat multiple files to search manually.

5. **Finish before you run out of context.** Once you've explored enough to make 4-6 findings, stop exploring and present your candidates. Do not keep reading "just in case" — present what you have.
