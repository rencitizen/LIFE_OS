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
- If the category is materially uncertain, prefer `未分類` rather than inventing a precise category.
- An explicit `精算対象` means `expense_type = shared` and `is_settlement_target = true`.
- If settlement treatment is omitted, do **not** create a debt to the partner automatically. Default to non-settlement unless the surrounding conversation clearly establishes otherwise.
- A shared-but-non-settlement expense is allowed when explicitly requested.
- Payment method is optional.

## Category hierarchy

Food is aggregated under the root category `食費`.

Current structure:

- `食費`
  - `食料品`
  - `外食`
    - `食事`
    - `飲み会`
  - `カフェ`

`交際費` remains separate. If an imported historical row says `交際費`, the CSV classification is authoritative for that historical row.

## Registration RPC

`public.register_chatgpt_expense(...)` is the canonical ChatGPT write path.

A successful settlement-target registration performs all of the following in one database transaction:

1. Resolve payer and couple.
2. Resolve the category by name (optionally parent category name).
3. Find the split profile active on the expense date.
4. Insert the `expenses` row with `source = chatgpt`.
5. Snapshot each member's burden into `expense_splits`.
6. Adjust yen rounding so split amounts sum exactly to the expense amount.
7. Insert a `finance_action_logs` audit record containing the original user input and structured payload.

If validation fails, the expense is not partially created.

## Default burden ratio

- Standard burden is maintained in `expense_split_profiles` / `expense_split_profile_members`.
- The active profile is effective-dated.
- Every settlement-target expense snapshots its allocation into `expense_splits`, so changing the default ratio later never rewrites historical expenses.

## Monthly settlement

- Settlement is based on settlement-target shared expenses with `expense_splits`.
- At month end, sum each member's actual payments and owed shares, net the differences, and produce one transfer direction/amount.
- Save the monthly result to `settlements` with `settlement_month`.
- Mark covered `expense_splits.is_settled = true` only when settlement is completed.

## Safety and audit

- Unique expense edits may be performed automatically when the target row is unambiguous.
- Deletion requires explicit confirmation.
- ChatGPT finance mutations are recorded in `finance_action_logs`.
- Missing or ambiguous information should not silently create partner debt.

## MVP exclusions

- No recurring/fixed-cost auto-generation yet.
- No ongoing CSV ingestion pipeline.
- Savings/investment automation and long-term simulation remain separate from the transaction-ledger MVP.
