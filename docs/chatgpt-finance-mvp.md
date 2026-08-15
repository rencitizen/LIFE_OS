# ChatGPT Finance MVP

## Source of truth

- Supabase is the finance system of record.
- MoneyForward is no longer an input source.
- New spending is stored transaction-by-transaction through ChatGPT.
- Historical imported MoneyForward rows remain untouched and are not used for couple settlement unless split rows are explicitly added.

## Expense entry rules

- Date defaults to the conversation date when omitted.
- Payer defaults to the speaker when omitted.
- Category is inferred from context; ask only when materially ambiguous.
- Personal vs shared is never inferred. The user specifies it; ask if omitted.
- Shared expenses use the active standard split profile unless a custom split is explicitly stated.
- Custom examples: 50/50, 100/0, or any explicit ratio.
- Each shared expense snapshots its actual allocation into `expense_splits`; changing the default profile later never rewrites historical allocations.

## Categories

- Historical food data stays under `食費`.
- New dining uses parent category `外食` with children:
  - `食事`
  - `飲み会`
  - `カフェ`

## Default burden ratio

- Standard burden is salary-based by default.
- The actual ratio is stored independently in `expense_split_profiles` / `expense_split_profile_members` so it can be changed without changing salary history.
- When ratios change, close the current profile and create a new effective-dated profile.

## Monthly settlement

- Settlement is based only on shared expenses with `expense_splits`.
- At month end, sum each member's actual payments and owed shares, net the differences, and produce one transfer direction/amount.
- Save the monthly result to `settlements` with `settlement_month`.
- Mark covered `expense_splits.is_settled = true` only when settlement is completed.

## Safety and audit

- Unique expense edits may be performed automatically.
- Deletion requires explicit confirmation.
- ChatGPT finance mutations are recorded in `finance_action_logs`.

## MVP exclusions

- No automatic recurring/fixed-cost generation yet.
- Savings/investment automation and long-term simulation remain separate from the transaction-ledger MVP.
