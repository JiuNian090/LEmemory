# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff**: These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 0. LEmemory 项目特定规则

在开始之前，请务必阅读项目规则：`.trae/documents/PROJECT_RULES.md`

### 项目快速参考

| 项目信息 | 值 |
|---------|---|
| **项目类型** | 微信小程序 |
| **主要语言** | TypeScript (严格模式) |
| **云环境ID** | `cloud1-d3g5crpd0b1f51b0f` |
| **主色** | `#34d399` |
| **UI 规范** | `.trae/documents/model.md` |

### 数据库操作

```typescript
// 始终使用统一的数据库接口
import { 
  cardGroupCollection, 
  cardCollection,
  studyRecordCollection,
  favoriteCollection,
  generateId,
  getUserId 
} from '../../utils/db'
```

### 关键约定

1. **双模式支持**：云开发 + 本地存储自动降级
2. **静默失败**：数据库操作失败不打断用户，记录日志即可
3. **标签日志**：`console.log('[Module] message', data)`
4. **TypeScript 严格**：避免 `any`，完整类型定义

---

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if**: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
