# ChatGPT Finance MVP

## Source of truth

- Supabase is the finance system of record.
- The August 2026 MoneyForward CSV was a one-off historical backfill only. CSV import is not part of the ongoing workflow.
- New spending is stored transaction-by-transaction through ChatGPT or the LIFE_OS UI.
- ChatGPT-created rows use `expenses.source = 'chatgpt'` and are audited in `finance_action_logs`.

## Conversation-to-expense rules

The normal interaction should be short, for example:

> 今日オオゼキで4,280円、食料品、精算対象

ChatGPT converts that into structured fields and calls `register_chatgpt_expense`.

### Defaults and inference

- Date defaults to the conversation date when omitted.
- Payer defaults to the speaker when omitted.
- Category may be inferred when the merchant/context is clear.
- If the category is materially uncertain, ChatGPT asks the user before registration. Do not silently store the row as `未分類` merely to avoid a clarification.
- Only an explicit `精算対象` creates partner settlement debt: `expense_type = shared` and `is_settlement_target = true`.
- If settlement treatment is omitted, default to non-settlement. Do not infer settlement from phrases such as `2人で`, a shared-looking merchant, or past behavior.
- A shared-but-non-settlement expense is allowed when explicitly requested.
- Payment method is optional.
- Custom settlement ratios are not part of the ChatGPT Finance MVP. Settlement-target expenses always use the active standard split profile.

## Category hierarchy

Food is aggregated under the root category `食費`.

Current structure:

- `食費`
  - `食料品`
  - `外食`
    - `食事`
    - `飲み会`
  - `カフェ`

Classification behavior:

- Clear grocery / supermarket purchases -> `食料品`.
- Clear cafe / coffee-shop purchases -> `カフェ`.
- Clear normal restaurant meals -> `外食 > 食事`.
- Clear drinking-party / izakaya social dining -> `外食 > 飲み会`.
- If more than one category is reasonably plausible, ask the user before writing.
- `交際費` remains separate from food categories.
- For the one-off August 2026 historical CSV backfill, the CSV classification remains authoritative.

## Registration RPC

`public.register_chatgpt_expense(...)` is the canonical ChatGPT create path.

A successful settlement-target registration performs all of the following in one database transaction:

1. Resolve payer and couple.
2. Resolve the category by name (optionally parent category name).
3. Find the split profile active on the expense date.
4. Insert the `expenses` row with `source = chatgpt`.
5. Snapshot each member's burden into `expense_splits`.
6. Adjust yen rounding so split amounts sum exactly to the expense amount.
7. Insert a `finance_action_logs` audit record containing the original user input and structured payload.

If validation fails, the expense is not partially created.

## Multiple expenses in one message

One message may contain multiple independent expenses, for example:

> 今日ランチ1,200円、コンビニ650円、薬局980円

ChatGPT parses them as separate transactions and registers each row separately. A failure or ambiguity in one item should not cause the other clearly specified items to be reinterpreted. If one item needs category clarification, ask specifically about that item.

## Duplicate handling

- Do not automatically discard a transaction merely because date, amount, category, and payer match an existing row; legitimate same-day duplicate purchases can occur.
- When an apparently identical transaction is repeated immediately or the conversation strongly suggests accidental resubmission, warn the user before creating another row.
- Otherwise, register it as a distinct expense.

## Corrections and deletion

- `public.update_chatgpt_expense(...)` is the canonical correction path for ChatGPT-created expenses.
- If the user says something such as `さっきのスーパー3,200円じゃなくて2,800円`, identify the intended recent expense from conversation/database context.
- If exactly one row is an unambiguous match, update it automatically and audit the change.
- If multiple rows are plausible, ask which one before updating.
- A correction to amount/date/category on an unsettled settlement-target expense recalculates its `expense_splits` using the standard profile effective on the corrected date.
- Already-settled expenses are not silently rewritten.
- Deletion always requires explicit confirmation before the delete mutation is executed.

## Registration response

After a successful write, return a compact confirmation so input errors are visible immediately.

Non-settlement example:

> 登録：スタバ ¥620 / カフェ

Settlement-target example:

> 登録：オオゼキ ¥4,280 / 食料品 / 精算対象  
> 負担：れん ¥2,298・ひかるん ¥1,982

For multiple expenses, return one compact line per registered transaction.

## Default burden ratio

- Standard burden is maintained in `expense_split_profiles` / `expense_split_profile_members`.
- The active profile is effective-dated.
- Every settlement-target expense snapshots its allocation into `expense_splits`, so changing the default ratio later never rewrites historical expenses.
- ChatGPT does not accept per-expense custom ratios in the MVP.

## Monthly settlement

- Settlement is based on settlement-target shared expenses with `expense_splits`.
- At month end, sum each member's actual payments and owed shares, net the differences, and produce one transfer direction/amount.
- Save the monthly result to `settlements` with `settlement_month`.
- Mark covered `expense_splits.is_settled = true` only when settlement is completed.

## Safety and audit

- Unique expense edits may be performed automatically when the target row is unambiguous.
- Deletion requires explicit confirmation.
- ChatGPT finance mutations are recorded in `finance_action_logs`.
- Missing or ambiguous category information must be clarified before registration.
- Missing settlement designation must not silently create partner debt.

## MVP exclusions

- No recurring/fixed-cost auto-generation yet.
- No ongoing CSV ingestion pipeline.
- No custom per-expense settlement ratio through ChatGPT.
- Savings/investment automation and long-term simulation remain separate from the transaction-ledger MVP.
