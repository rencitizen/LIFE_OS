# ChatGPT × LIFE_OS Todo MVP

## Goal

Use ChatGPT as the natural-language interface for LIFE_OS Todo management while keeping Supabase as the single source of truth.

## Scope

Included:
- Read current Todos
- Create Todo
- Complete Todo
- Update Todo
- Delete Todo only after explicit confirmation

Out of scope for this MVP:
- Shopping
- Calendar
- Finance
- Long-term context / memory
- Obsidian
- Public API / MCP server

## Architecture

No new integration layer for the MVP.

ChatGPT -> Supabase -> LIFE_OS

Supabase remains the system of record.

## As-Is findings (2026-08-15)

- Total Todos: 54
- Done: 49
- Pending: 4
- In progress: 1
- Unassigned: 23
- Missing start/end/due dates: 23
- Todos with a parent: 3
- Recurring Todos: 0
- Done without completed_at: 0
- completed_at with non-done status: 0

Current active Todos:
- SBI設定 — in_progress — high — large — assigned to ひかるん — overdue
- 信託解約 — pending — medium — small — assigned to れん — overdue
- monmon掃除 — pending — medium — small — assigned to ひかるん — no date
- 杉浦、長谷川連絡 — pending — medium — small — unassigned — no date
- メルカリ情報共有　予約時間確認 — pending — medium — small — unassigned — no date

Observed title ambiguity:
- Titles containing `SBI`: 5
- Titles containing `杉浦`: 3
- Titles containing `予約`: 4
- Titles containing `解約`: 2
- Titles containing `切替/切り替え`: 5

Therefore simple substring matching is not safe enough for automatic updates.

## Input rules

### 1. Create Todo

Create a Todo only when the user expresses a clear action, obligation, or explicit request to add a Todo.

Examples that should create:
- 「免許証の住所変更しないと」
- 「明日美容室予約する」
- 「週末に資料直す」
- 「Todoにふるさと納税追加して」

Examples that should not create:
- 「ジム変えようかな」
- 「旅行行きたいな」
- 「これやった方がいいかな？」
- 「自転車どうしよう」

### 2. Default values for newly created Todos

Follow the existing LIFE_OS Todo schema and UI defaults.

- title: required
- status: pending
- task_level: small
- priority: medium
- visibility: shared
- assigned_to: null unless explicitly stated
- start_date: null unless explicitly stated or naturally resolved from the user's wording
- end_date: null unless explicitly stated
- due_date: null unless explicitly stated
- parent_todo_id: null unless explicitly linked

Do not invent dates, assignees, hierarchy, or priority.

### 3. Complete Todo

Completion language includes, but is not limited to:
- 終わった
- やった
- 済んだ
- 完了
- done
- 予約した
- 申し込んだ
- 解約した
- 提出した

When a single active Todo can be confidently identified:
- set status = done
- set completed_at = current timestamp

No confirmation is required for a unique, high-confidence completion match.

### 4. Update Todo

Normal low-risk updates can be applied without confirmation when the target Todo is unique.

Examples:
- 「免許証の住所変更、明日にして」
- 「資料修正を優先度高にして」
- 「これはひかるん担当」

### 5. Delete Todo

Deletion always requires explicit confirmation immediately before execution.

Do not treat completion as deletion.

### 6. Matching existing Todos

Search active Todos first (`pending`, `in_progress`).

Ranking considerations:
1. Explicit title/entity words
2. Action verb compatibility
3. Assignee mentioned in conversation
4. Status and recency/context
5. Parent/child relationship where relevant

Rules:
- One clear active match -> execute
- Multiple plausible active matches -> ask which one
- No active match -> do not fabricate a completed Todo
- Completed historical Todos may be inspected to understand ambiguity, but should not normally be mutated by a casual completion statement

### 7. Date handling

Interpret relative dates using Asia/Tokyo.

- today / 今日 -> current local date
- tomorrow / 明日 -> current local date + 1 day
- this weekend / 週末 -> resolve only when the required field meaning is clear; otherwise preserve without inventing an exact day

Only save a date when the user's statement meaningfully specifies one.

### 8. Assignee handling

Current couple members relevant to Todo operation:
- れん
- ひかるん

Default for newly created Todos is unassigned unless the user clearly indicates an assignee.

Examples:
- 「俺がやる」 -> assign to れん
- 「ひかるんにお願い」 -> assign to ひかるん

### 9. Query behavior

Questions such as:
- 「今Todo何残ってる？」
- 「今週やることは？」
- 「明日何やればいい？」

must read from Supabase at answer time. Do not rely on chat memory as the source of truth.

## Safety / execution policy

Auto-execute:
- create
- complete
- low-risk field update

Require confirmation:
- delete
- destructive bulk operations
- ambiguous target resolution

Do not execute:
- inferred actions from brainstorming only
- updates with no identifiable target
- fabricated completion records when no matching Todo exists

## Audit requirement

ChatGPT-originated mutations should be traceable. A minimal audit structure should record:
- source = chatgpt
- action type
- todo_id
- user / couple
- raw user input when available
- structured payload
- execution timestamp
- status / error

The audit mechanism should be minimal and must not alter current Todo behavior.

## MVP success criteria

- User can add a Todo without opening LIFE_OS
- User can complete a Todo without opening LIFE_OS
- User can update a Todo without opening LIFE_OS
- ChatGPT returns the latest Todo state from Supabase
- Ambiguous requests do not update the wrong Todo
- Deletes never occur without confirmation
- User and partner Todos do not become mixed up
