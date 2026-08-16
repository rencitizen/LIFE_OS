# ChatGPT × LIFE_OS Life Modules MVP

## Goal

Extend the same conversation -> structured data -> Supabase -> LIFE_OS pattern used by Finance and Todo to Calendar, Shopping, and Ideas without creating a new integration layer.

Supabase remains the system of record.

## Shared audit

Calendar, Shopping, and Idea mutations are recorded in `chatgpt_action_logs` with:

- acting user and couple
- entity type / entity id
- create / update / complete / delete action
- original conversation text when available
- structured payload
- execution status and timestamp

Delete RPCs require an explicit confirmation flag at the database boundary.

## Calendar

Canonical ChatGPT write paths:

- `register_chatgpt_calendar_event(...)`
- `update_chatgpt_calendar_event(...)`
- `delete_chatgpt_calendar_event(...)`

Rules:

- Create only when a concrete event can be identified.
- A start date/time must be resolved before writing. Ask when the timing is materially ambiguous.
- End time is optional. When explicitly supplied, it must not precede the start.
- Default visibility is `shared` and default event type is `life` unless the conversation clearly indicates otherwise.
- Do not invent recurrence. Recurring-event creation is outside this MVP until recurrence semantics are separately defined.
- Unique low-risk edits may be executed without confirmation; ambiguous target resolution requires a question.
- Delete requires explicit confirmation.

## Shopping

Current active lists are the existing LIFE_OS lists:

- `食材`
- `日用品`
- `欲しい物`

Canonical ChatGPT write paths:

- `register_chatgpt_shopping_item(...)`
- `update_chatgpt_shopping_item(...)`
- `set_chatgpt_shopping_item_checked(...)`
- `delete_chatgpt_shopping_item(...)`

Rules:

- The database RPC requires an explicit target list ID; list inference happens before the write.
- Clear food ingredients / groceries -> `食材`.
- Clear consumables / household necessities -> `日用品`.
- Durable goods, clothing, furniture, electronics, and general wants -> `欲しい物`.
- If more than one list is reasonably plausible, ask before writing.
- Quantity, unit, estimated price, and priority are optional and must not be invented.
- A unique statement such as `〇〇買った` may mark the matching item checked without confirmation.
- An ambiguous completion statement requires target clarification.
- Delete requires explicit confirmation.
- Multiple shopping items in one message may be registered as independent rows.

## Ideas / thought themes

`idea_items` is the lightweight store for thoughts, themes, and things the user explicitly wants retained outside the action-oriented Todo model.

Canonical ChatGPT write paths:

- `register_chatgpt_idea_item(...)`
- `update_chatgpt_idea_item(...)`
- `complete_chatgpt_idea_item(...)`
- `delete_chatgpt_idea_item(...)`

Rules:

- Capture an idea when the user explicitly asks to save/remember it as a theme, idea, or wish, or when the conversation clearly establishes that it should be retained in LIFE_OS.
- Do not turn brainstorming into a Todo automatically.
- Conversely, a concrete obligation/request belongs in Todo rather than Ideas.
- Default status is `active`.
- Unique edits/completion may be automatic; ambiguous targets require clarification.
- Delete requires explicit confirmation.

## Habits

The current `/habits` page is a visualization derived from Todo completion history; there is no independent habit-definition or habit-log table yet.

Therefore ChatGPT Habit writes are intentionally not added in this MVP. A separate product decision is required for:

- what constitutes a habit definition
- frequency / schedule semantics
- daily completion logs
- streak reset rules
- ownership / sharing

Until that model exists, ChatGPT may manage the underlying Todos but must not fabricate a separate habit record.

## Safety

Across these modules:

- Read current Supabase state before editing/completing an existing entity.
- One clear match -> execute low-risk mutation.
- Multiple plausible matches -> ask which one.
- No match -> do not fabricate a historical entity merely to mark it complete.
- Delete -> always require explicit confirmation.
- Do not silently invent important dates, assignees, list placement, or recurrence.
