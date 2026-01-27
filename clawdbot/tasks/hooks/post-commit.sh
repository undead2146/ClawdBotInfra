#!/bin/bash
# ============================================================
# Git Post-Commit Hook
# ============================================================
# Runs after commits are made
# ============================================================

# Log commit to activity tracker
COMMIT_HASH=$(git rev-parse HEAD)
COMMIT_MSG=$(git log -1 --pretty=%B)
REPO_NAME=$(basename $(git rev-parse --show-toplevel))

echo "[$(date)] $REPO_NAME: $COMMIT_HASH - $COMMIT_MSG" >> ~/claude-stack/activity.log
