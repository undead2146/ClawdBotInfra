#!/bin/bash
# ============================================================
# Git Pre-Commit Hook
# ============================================================
# Place this in .git/hooks/pre-commit to run before commits
# ============================================================

set -e

echo "=== Running Pre-Commit Checks ==="

# 1. Check for secrets
echo "[1/4] Scanning for secrets..."
if git diff --cached --name-only | xargs grep -l "sk-ant-" 2>/dev/null; then
    echo "❌ ERROR: Anthropic API key detected in staged files!"
    exit 1
fi

if git diff --cached --name-only | xargs grep -l "ghp_" 2>/dev/null; then
    echo "❌ ERROR: GitHub token detected in staged files!"
    exit 1
fi

# 2. Lint staged files (if using a linter)
echo "[2/4] Running linter..."
# npm run lint-staged || true

# 3. Run tests (if configured)
echo "[3/4] Running tests..."
# npm test || true

# 4. Check file sizes
echo "[4/4] Checking file sizes..."
MAX_SIZE=1048576  # 1MB
for file in $(git diff --cached --name-only); do
    if [ -f "$file" ]; then
        size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
        if [ "$size" -gt "$MAX_SIZE" ]; then
            echo "⚠️  WARNING: $file is larger than 1MB"
        fi
    fi
done

echo "✅ Pre-commit checks passed!"
