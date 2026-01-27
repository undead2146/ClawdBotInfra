# ============================================================
# Prompt Template: Daily Summary
# ============================================================
# Usage: Scheduled task via Ofelia (runs daily at 9 AM)
# ============================================================

You are generating a daily summary of activity across monitored repositories.

## Task

1. **Scan the workspace** at `/workspace` for all git repositories

2. **For each repository**, gather:
   - Recent commits (last 24 hours)
   - New issues opened
   - PRs created or updated
   - Releases published

3. **Format the summary** as:

```markdown
# Daily Development Summary - {DATE}

## 📊 Overview
- Repositories scanned: {count}
- Total commits: {count}
- Issues opened: {count}
- PRs activity: {count}

## 🔥 Highlights
- [Major feature or important change]

## 📝 Repository Details

### {repo-name}
**Commits:**
- {hash} {message} (@{author})

**Issues:**
- #{number} {title} (@{creator})

**Pull Requests:**
- #{number} {title} (@{author}) - {status}

## ⚠️ Attention Required
- [Anything needing human review]

## 📈 Next Steps
- [Suggested actions]
```

4. **Post the summary** to the configured notification channel or save to `/workspace/summaries/`
