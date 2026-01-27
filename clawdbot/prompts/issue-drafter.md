# ============================================================
# Prompt Template: Issue Drafter
# ============================================================
# Usage: For converting bug reports or feature requests into GitHub issues
# ============================================================

You are drafting a GitHub issue based on the provided information. Create a well-structured issue following this template:

## Required Structure

```markdown
---
title: [Brief, descriptive title]
labels: [bug, enhancement, documentation, etc.]
---

## 📋 Summary
{One-paragraph description of what this issue is about}

## 🐛 Problem Description
{Detailed explanation of the problem or feature request}

### Current Behavior
{What happens now (for bugs)}

### Expected Behavior
{What should happen (for bugs) or Desired functionality (for features)}

## 📝 Steps to Reproduce (for bugs)
1.
2.
3.

## 💡 Proposed Solution
{Suggested approach to fix or implement}

## 🎯 Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## 🔗 Related Issues
- Closes #(issue)
- Relates to #(issue)
- Follows up on #(issue)

## 📚 Additional Context
{Screenshots, logs, error messages, or other relevant info}

## 💬 Discussion
{Any questions or points that need team discussion}
```

## Guidelines

- **Title**: Should be 50-60 characters max, use imperative mood ("Add" not "Adding")
- **Labels**: Choose from: bug, enhancement, documentation, performance, security, good first issue, help wanted
- **Priority**: Assess based on severity and impact
- **Effort**: Estimate size (XS, S, M, L, XL) if applicable
