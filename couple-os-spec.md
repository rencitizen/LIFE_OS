# Couple OS — プロダクト仕様書 v1.0
> "二人の生活を、一つのOSで動かす"

---

## 0. プロダクト哲学

| 軸 | 定義 |
|---|---|
| **Single Source of Truth** | 予定・タスク・支出はすべて同一データ基盤で繋がる |
| **Two-Person First** | UIもデータモデルも「2人」が前提。個人向けアプリの寄せ集めではない |
| **CFO Mindset** | 家計を「生活経営」として捉え、意思決定を数字で支援する |
| **Low Friction** | 入力コストを最小化。AI・連携・自動化で手入力を減らす |

---

## 1. 機能一覧

### MVP（〜3ヶ月）

#### 1-1. 共有カレンダー
- [ ] 月・週ビュー切り替え
- [ ] イベント作成（タイトル / 日時 / 種別 / 公開範囲）
- [ ] 公開範囲：共有 / 自分のみ / パートナーのみ
- [ ] イベント種別タグ：生活 / 金融 / 記念日 / 医療 / 旅行
- [ ] 繰り返しイベント（毎月・毎年・毎週）
- [ ] プッシュリマインド（1日前 / 当日）
- [ ] TODO連携（イベントにTODOをアタッチ）

#### 1-2. 買い物リスト
- [ ] リスト作成・グループ分け（食材 / 日用品 / その他）
- [ ] アイテム追加・チェック完了
- [ ] 優先度（高 / 中 / 低）
- [ ] 予想金額・メモ
- [ ] 購入者記録（誰が買ったか）
- [ ] チェック完了 → 支出登録候補生成フロー

#### 1-3. TODO管理
- [ ] タスク作成（タイトル / 期限 / 優先度 / 担当者）
- [ ] 担当区分：自分 / パートナー / 共有
- [ ] ステータス：未着手 / 進行中 / 完了
- [ ] カレンダーイベントへのアタッチ
- [ ] 繰り返しタスク

#### 1-4. CFOダッシュボード（基本）
- [ ] 収入登録（固定 / 臨時）
- [ ] 支出登録（手動）
- [ ] 支出区分：個人 / 共有 / 立替
- [ ] カテゴリ管理
- [ ] 月次サマリー（収入・支出・残高）
- [ ] 固定費 vs 変動費の分離表示
- [ ] 予算設定・残予算表示

#### 1-5. 立替精算
- [ ] 立替登録（誰が / 誰の分 / 金額）
- [ ] 精算状況トラッキング
- [ ] 精算リクエスト送信

#### 1-6. ホーム画面
- [ ] 今日の予定サマリー
- [ ] 今日のTODOリスト
- [ ] 買い物リスト（未チェック件数）
- [ ] 今月残予算バー
- [ ] 直近の金融イベント（3件）

#### 1-7. 認証・ペア設定
- [ ] メールアドレス / Googleログイン
- [ ] 招待コードによるペアリング
- [ ] プロフィール設定（名前 / アバター / 通貨）

---

### Phase 2（〜6ヶ月）

- [ ] **目的別積立ウィジェット**（旅行 / 結婚 / 引越 / 緊急資金）
- [ ] **純資産推移グラフ**（資産 - 負債）
- [ ] **クレジットカード管理**（利用枠 / 引き落とし日 / 未払額）
- [ ] **銀行口座連携**（残高同期 ※ Open Banking API）
- [ ] **AIカテゴリ自動分類**（支出テキスト → カテゴリ推定）
- [ ] **月次AIレビュー生成**（支出傾向・改善提案・来月予測）
- [ ] **旅行イベント → TODO自動展開**（ホテル予約 / 交通手配 / パッキングなど）
- [ ] **予算差異アラート**（カテゴリ別予算超過通知）
- [ ] **レシート写真OCR → 支出自動入力**
- [ ] **繰り返し支出の自動登録**（家賃・サブスク）
- [ ] **週次サマリー通知**（n8n Automation）

---

### Phase 3（〜12ヶ月）

- [ ] **家族拡張モード**（子供・親を追加 / 3人以上対応）
- [ ] **投資ポートフォリオ管理**（証券口座連携）
- [ ] **ライフプランシミュレーター**（結婚・出産・住宅購入試算）
- [ ] **多通貨対応**（海外在住カップル向け）
- [ ] **AIチャットアドバイザー**（"今月どれくらい節約できる？"）
- [ ] **外部カレンダー同期**（Google Calendar / Apple Calendar）
- [ ] **家電・保険・サブスク契約管理**
- [ ] **タスクテンプレートライブラリ**（引越し / 結婚準備 / 年末調整など）
- [ ] **データエクスポート**（CSV / JSON）
- [ ] **Web版 / PWA対応**

---

## 2. ER図レベルのデータモデル設計

```
couples ─────────────────────────────────────────┐
  │                                               │
  ├── users (2人)                                 │
  │     └── user_profiles                         │
  │                                               │
  ├── calendar_events ──── event_reminders        │
  │     └── event_todos (junction)                │
  │                                               │
  ├── shopping_lists                              │
  │     └── shopping_items ──→ expenses (候補生成) │
  │                                               │
  ├── todos                                       │
  │     └── todo_attachments                      │
  │                                               │
  ├── expenses ──── expense_splits                │
  │     └── settlements                           │
  │                                               │
  ├── budgets                                     │
  │     └── budget_categories                     │
  │                                               │
  ├── accounts (銀行/カード)                       │
  │     └── account_balances                      │
  │                                               │
  ├── savings_goals                               │
  │     └── savings_contributions                 │
  │                                               │
  └── incomes                                     │
        └── income_entries                        │
```

---

## 3. 主要テーブル定義

### couples
```sql
CREATE TABLE couples (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT,                        -- "田中家" など
  invite_code   TEXT UNIQUE NOT NULL,
  currency      TEXT DEFAULT 'JPY',
  timezone      TEXT DEFAULT 'Asia/Tokyo',
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

### users
```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY,            -- Supabase Auth UID
  couple_id     UUID REFERENCES couples(id),
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  color         TEXT DEFAULT '#4F46E5',      -- パートナー識別カラー
  role          TEXT DEFAULT 'partner',      -- partner / child / extended
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

### calendar_events
```sql
CREATE TABLE calendar_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id       UUID REFERENCES couples(id),
  created_by      UUID REFERENCES users(id),
  title           TEXT NOT NULL,
  description     TEXT,
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ,
  all_day         BOOLEAN DEFAULT false,
  visibility      TEXT DEFAULT 'shared',     -- shared / private / partner_only
  event_type      TEXT DEFAULT 'life',       -- life / financial / anniversary / medical / travel
  is_recurring    BOOLEAN DEFAULT false,
  recurrence_rule TEXT,                      -- RFC 5545 RRULE
  color           TEXT,
  location        TEXT,
  linked_amount   NUMERIC(12,2),             -- 金融イベントの金額
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### shopping_lists
```sql
CREATE TABLE shopping_lists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id   UUID REFERENCES couples(id),
  name        TEXT NOT NULL,               -- "今週の食材" など
  category    TEXT DEFAULT 'general',      -- food / daily / other
  is_active   BOOLEAN DEFAULT true,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### shopping_items
```sql
CREATE TABLE shopping_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id             UUID REFERENCES shopping_lists(id),
  name                TEXT NOT NULL,
  memo                TEXT,
  quantity            NUMERIC(8,2),
  unit                TEXT,
  estimated_price     NUMERIC(10,2),
  priority            TEXT DEFAULT 'medium',   -- high / medium / low
  is_checked          BOOLEAN DEFAULT false,
  checked_by          UUID REFERENCES users(id),
  checked_at          TIMESTAMPTZ,
  expense_created     BOOLEAN DEFAULT false,   -- 支出候補生成済みフラグ
  created_at          TIMESTAMPTZ DEFAULT now()
);
```

### todos
```sql
CREATE TABLE todos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id       UUID REFERENCES couples(id),
  created_by      UUID REFERENCES users(id),
  assigned_to     UUID REFERENCES users(id),  -- NULL = 共有
  title           TEXT NOT NULL,
  description     TEXT,
  due_date        DATE,
  priority        TEXT DEFAULT 'medium',       -- high / medium / low
  status          TEXT DEFAULT 'pending',      -- pending / in_progress / done
  visibility      TEXT DEFAULT 'shared',       -- shared / private
  event_id        UUID REFERENCES calendar_events(id),
  is_recurring    BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### expenses
```sql
CREATE TABLE expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id       UUID REFERENCES couples(id),
  paid_by         UUID REFERENCES users(id),
  amount          NUMERIC(12,2) NOT NULL,
  currency        TEXT DEFAULT 'JPY',
  category_id     UUID REFERENCES expense_categories(id),
  description     TEXT,
  expense_date    DATE NOT NULL,
  expense_type    TEXT DEFAULT 'shared',       -- personal / shared / advance / pending_settlement
  payment_method  TEXT,                        -- cash / card / transfer
  is_fixed        BOOLEAN DEFAULT false,       -- 固定費フラグ
  receipt_url     TEXT,
  source          TEXT DEFAULT 'manual',       -- manual / shopping_list / ocr / auto
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### expense_splits
```sql
-- 共有支出の負担割合管理
CREATE TABLE expense_splits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id  UUID REFERENCES expenses(id),
  user_id     UUID REFERENCES users(id),
  ratio       NUMERIC(5,4),                    -- 0.5000 = 50%
  amount      NUMERIC(12,2),
  is_settled  BOOLEAN DEFAULT false
);
```

### settlements
```sql
CREATE TABLE settlements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id       UUID REFERENCES couples(id),
  from_user       UUID REFERENCES users(id),
  to_user         UUID REFERENCES users(id),
  amount          NUMERIC(12,2) NOT NULL,
  settled_at      DATE,
  status          TEXT DEFAULT 'requested',    -- requested / confirmed / done
  memo            TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### budgets
```sql
CREATE TABLE budgets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id   UUID REFERENCES couples(id),
  year_month  TEXT NOT NULL,                   -- "2026-03"
  total_limit NUMERIC(12,2),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(couple_id, year_month)
);
```

### budget_categories
```sql
CREATE TABLE budget_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id   UUID REFERENCES budgets(id),
  category_id UUID REFERENCES expense_categories(id),
  limit_amount NUMERIC(12,2),
  alert_ratio  NUMERIC(4,2) DEFAULT 0.80        -- 80%で警告
);
```

### savings_goals
```sql
CREATE TABLE savings_goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id       UUID REFERENCES couples(id),
  title           TEXT NOT NULL,               -- "旅行資金", "結婚資金"
  target_amount   NUMERIC(12,2),
  current_amount  NUMERIC(12,2) DEFAULT 0,
  target_date     DATE,
  icon            TEXT,
  color           TEXT,
  status          TEXT DEFAULT 'active',       -- active / achieved / paused
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### accounts
```sql
CREATE TABLE accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id       UUID REFERENCES couples(id),
  owner_id        UUID REFERENCES users(id),
  name            TEXT NOT NULL,               -- "楽天銀行", "三井住友カード"
  account_type    TEXT,                        -- bank / credit / investment / cash
  balance         NUMERIC(14,2),
  credit_limit    NUMERIC(12,2),              -- クレカ限度額
  billing_date    INT,                         -- 引き落とし日
  closing_date    INT,                         -- 締め日
  last_synced_at  TIMESTAMPTZ,
  is_shared       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### incomes
```sql
CREATE TABLE incomes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id   UUID REFERENCES couples(id),
  user_id     UUID REFERENCES users(id),
  amount      NUMERIC(12,2) NOT NULL,
  income_type TEXT DEFAULT 'salary',           -- salary / bonus / freelance / other
  description TEXT,
  income_date DATE NOT NULL,
  is_fixed    BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

---

## 4. 画面一覧

| # | 画面名 | 役割 | 優先度 |
|---|--------|------|--------|
| 01 | **ホーム** | 今日のサマリー統合ビュー | MVP |
| 02 | **カレンダー（月）** | 月全体のイベント俯瞰 | MVP |
| 03 | **カレンダー（週）** | 週単位の詳細ビュー | MVP |
| 04 | **イベント詳細/編集** | イベント情報フル編集 | MVP |
| 05 | **買い物リスト一覧** | アクティブリスト表示 | MVP |
| 06 | **買い物リスト詳細** | アイテム操作・チェック | MVP |
| 07 | **支出候補確認** | 買い物→支出変換レビュー | MVP |
| 08 | **TODOリスト** | 全TODO / 自分 / 相手 / 共有タブ | MVP |
| 09 | **TODO詳細/編集** | タスク詳細フル編集 | MVP |
| 10 | **CFOダッシュボード** | 月次財務サマリー | MVP |
| 11 | **支出一覧** | フィルタ・検索付き履歴 | MVP |
| 12 | **支出登録/編集** | 手動支出入力フォーム | MVP |
| 13 | **立替・精算** | 立替残高・精算リクエスト | MVP |
| 14 | **予算管理** | カテゴリ別予算設定 | MVP |
| 15 | **目的別積立** | 積立ゴール一覧・進捗 | Phase 2 |
| 16 | **純資産推移** | 資産グラフ・口座一覧 | Phase 2 |
| 17 | **口座管理** | 銀行・カード口座登録 | Phase 2 |
| 18 | **月次AIレビュー** | AI生成の月次振り返りレポート | Phase 2 |
| 19 | **レシートスキャン** | OCR支出入力 | Phase 2 |
| 20 | **ライフプラン** | 将来シミュレーター | Phase 3 |
| 21 | **投資管理** | ポートフォリオ | Phase 3 |
| 22 | **設定 > プロフィール** | 名前・アバター・カラー | MVP |
| 23 | **設定 > ペア管理** | 招待・ペアリング | MVP |
| 24 | **設定 > カテゴリ管理** | カスタムカテゴリ | MVP |
| 25 | **設定 > 通知設定** | リマインド・アラート設定 | MVP |
| 26 | **オンボーディング** | ペアリング〜初期設定ウィザード | MVP |
| 27 | **ログイン / 新規登録** | 認証画面 | MVP |

---

## 5. ユーザーフロー

### Flow A：初期セットアップ
```
App起動
  └→ 新規登録 (メール / Google)
       └→ プロフィール設定（名前・アバター・カラー）
            └→ ペア設定選択
                 ├→ 招待コード発行 → 相手に送る
                 └→ コード入力 → ペアリング完了
                      └→ 初期設定ウィザード
                           ├→ 通貨・タイムゾーン
                           ├→ 収入登録（2人分）
                           ├→ 固定費登録
                           └→ ホームへ
```

### Flow B：買い物→支出登録
```
買い物リスト
  └→ アイテム追加（名前 / 予想金額 / 優先度）
       └→ 外出・買い物
            └→ アイテムをチェック ✓
                 └→ リスト完了時に「支出を記録しますか？」
                      └→ 候補確認画面
                           ├→ 金額調整・カテゴリ確認
                           ├→ 支出区分を選択（共有/個人/立替）
                           └→ 登録 → CFOダッシュボードに反映
```

### Flow C：イベント→TODOの自動展開
```
カレンダーにイベント作成
  └→ 種別「旅行」を選択
       └→ AIが関連TODOを提案
            ├→ ホテル予約 (〇日前)
            ├→ 交通手配 (〇日前)
            ├→ 荷物準備 (前日)
            └→ TODO一括追加確認
                 └→ 追加 → TODOリストに反映
```

### Flow D：月次CFOレビュー
```
月末 or 手動起動
  └→ AIが月次データを分析
       └→ レポート生成
            ├→ 支出サマリー（予算差異）
            ├→ 前月比較
            ├→ 節約できたカテゴリ
            ├→ 来月の注意ポイント
            └→ 積立ゴール進捗
```

### Flow E：立替精算
```
誰かが立替支出を登録
  └→ expense_type = 'advance'
       └→ 精算ページに自動追加
            └→ 「精算リクエスト」送信
                 └→ 相手に通知
                      └→ 相手が確認・承認
                           └→ status = 'done' → 残高リセット
```

---

## 6. アーキテクチャ

### 全体構成

```
┌────────────────────────────────────────────┐
│              Client Layer                   │
│  Next.js (App Router) + TailwindCSS        │
│  React Query + Zustand                     │
│  PWA / iOS / Android (Expo将来)            │
└────────────────┬───────────────────────────┘
                 │ HTTPS
┌────────────────▼───────────────────────────┐
│           Supabase Platform                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │   Auth   │  │ Postgres │  │Realtime  │ │
│  │  (JWT)   │  │  (RLS)   │  │(WebSocket│ │
│  └──────────┘  └──────────┘  └──────────┘ │
│  ┌──────────┐  ┌──────────┐               │
│  │ Storage  │  │  Edge    │               │
│  │(receipts)│  │Functions │               │
│  └──────────┘  └──────────┘               │
└────────────────┬───────────────────────────┘
                 │
┌────────────────▼───────────────────────────┐
│           Automation Layer (n8n)            │
│  ・週次サマリー生成ジョブ                    │
│  ・繰り返し支出の自動登録                    │
│  ・予算超過アラート送信                      │
│  ・OCR処理キュー                            │
└────────────────┬───────────────────────────┘
                 │
┌────────────────▼───────────────────────────┐
│              AI Layer                       │
│  Anthropic API (Claude)                    │
│  ・支出カテゴリ分類                          │
│  ・月次レビュー生成                          │
│  ・TODOテンプレート提案                      │
│  ・チャットアドバイザー（Phase 3）           │
└────────────────────────────────────────────┘
```

### フロントエンド構成

```
app/
├── (auth)/
│   ├── login/
│   └── register/
├── (app)/
│   ├── home/
│   ├── calendar/
│   ├── shopping/
│   ├── todos/
│   ├── finance/
│   │   ├── dashboard/
│   │   ├── expenses/
│   │   ├── settlements/
│   │   ├── budgets/
│   │   └── savings/
│   └── settings/
├── components/
│   ├── ui/         (shadcn/ui)
│   ├── calendar/
│   ├── finance/
│   └── shared/
├── lib/
│   ├── supabase/
│   ├── hooks/
│   └── utils/
└── stores/         (Zustand)
```

### Realtime設計

```
Supabase Realtime Channels:

couple:{couple_id}
  └→ BROADCAST:
      ・shopping_item.checked
      ・todo.status_changed
      ・expense.added
      ・settlement.requested

  └→ POSTGRES_CHANGES:
      ・INSERT / UPDATE on todos (couple_id = ?)
      ・INSERT / UPDATE on expenses (couple_id = ?)
      ・UPDATE on shopping_items (list_id in ?)
```

---

## 7. スケーラビリティ設計

### データベース

| 戦略 | 内容 |
|------|------|
| **RLS (Row Level Security)** | `couple_id` ベースで全テーブルに適用。他カップルのデータへのアクセスをDB層で遮断 |
| **インデックス設計** | `(couple_id, expense_date)`, `(couple_id, start_at)`, `(assigned_to, status)` に複合インデックス |
| **パーティショニング** | expenses / calendar_events は年月パーティション（10万件超で検討） |
| **アーカイブ戦略** | 2年以上の支出データをcold storageへ移行 |

### フロントエンド

| 戦略 | 内容 |
|------|------|
| **ISR / SSR 使い分け** | ダッシュボードはSSR、静的ページはSSG |
| **Optimistic UI** | チェック・ステータス変更はローカル即時反映 → 後でサーバー同期 |
| **無限スクロール** | 支出一覧・TODOは仮想スクロール（react-window）|
| **React Query キャッシュ** | `staleTime: 30s` でリアルタイム更新とAPI負荷のバランスを取る |

### 将来の家族拡張

- `users.role` フィールドで `child` / `extended` を追加
- `todos.assigned_to` は複数ユーザー対応へ（junction table化）
- カレンダーの公開範囲を `visibility: TEXT[]` に拡張

---

## 8. 将来の拡張（AI / API連携）

### AI機能ロードマップ

| 機能 | 実装方法 | タイミング |
|------|----------|-----------|
| 支出カテゴリ自動分類 | Claude API + few-shot prompt | Phase 2 |
| レシートOCR解析 | Claude Vision API | Phase 2 |
| 月次レビューレポート生成 | Structured output + テンプレート | Phase 2 |
| TODOテンプレート提案 | イベント種別ベースのRAG | Phase 2 |
| 予算最適化提案 | 過去データ + Claude分析 | Phase 3 |
| AIチャットアドバイザー | Claude + 家計データコンテキスト | Phase 3 |
| ライフプランシミュレーション | Claude + 数値計算エンジン | Phase 3 |

### AIプロンプト設計例（月次レビュー）

```
System: あなたはカップルの家計管理アドバイザーです。
        データに基づき、具体的で実行可能なアドバイスをしてください。

User: 以下は{couple_name}の{year_month}の家計データです。
      収入: {total_income}円
      支出合計: {total_expense}円
      カテゴリ別支出: {category_breakdown}
      前月比: {comparison}
      予算差異: {budget_variance}
      積立ゴール進捗: {savings_progress}

      以下の観点でレビューを生成してください：
      1. 今月のサマリー（3行以内）
      2. よかった点
      3. 改善できる点（具体的な金額と行動）
      4. 来月に向けたアクション（2〜3個）
```

### 外部API連携計画

| サービス | 目的 | API |
|---------|------|-----|
| Plaid / マネーフォワード | 銀行・カード残高同期 | OAuth + Webhook |
| Google Calendar | 外部カレンダー双方向同期 | Google Calendar API v3 |
| Apple Calendar | iOS連携 | CalDAV |
| LINE / Slack | 通知・ Bot | Messaging API |
| Stripe | 将来のサブスク課金 | Stripe Billing |

---

## 9. セキュリティ設計

### 認証・認可

```
┌────────────────────────────────────────┐
│  認証: Supabase Auth                    │
│  ・JWT (access token: 1h)              │
│  ・refresh token: 30日                 │
│  ・Google OAuth 2.0                    │
│  ・Email OTP / Magic Link              │
└────────────────────────────────────────┘
```

### Row Level Security（RLS）ポリシー例

```sql
-- expenses: couple_idが一致するユーザーのみアクセス可
CREATE POLICY "couple_access" ON expenses
  USING (
    couple_id IN (
      SELECT couple_id FROM users WHERE id = auth.uid()
    )
  );

-- todos: private タスクは作成者のみ参照可
CREATE POLICY "todo_visibility" ON todos
  USING (
    couple_id IN (SELECT couple_id FROM users WHERE id = auth.uid())
    AND (
      visibility = 'shared'
      OR created_by = auth.uid()
      OR assigned_to = auth.uid()
    )
  );
```

### データ保護方針

| 項目 | 対策 |
|------|------|
| **通信暗号化** | TLS 1.3 必須 |
| **保存データ暗号化** | Supabase AES-256 at rest |
| **PII管理** | 個人識別情報はマスキングしてログ出力 |
| **ペアリング解除** | 離脱時に共有データへのアクセス権を即時剥奪 |
| **監査ログ** | 支出・精算の変更はaudit_logsテーブルに記録 |
| **レート制限** | Edge FunctionsにIP・UID別レート制限 |
| **OWASP対策** | Supabaseのパラメータ化クエリ、XSS対策（CSP設定）|
| **2FA** | Phase 2でTOTP（認証アプリ）対応 |

### プライバシー設計

- **個人タスク・個人支出**はパートナーからも不可視（RLSで制御）
- ペア解除時のデータ取り扱いを利用規約に明記
- GDPR/個人情報保護法対応のデータ削除API

---

## 10. 開発ロードマップ

### Phase 1 MVP（Week 1〜12）

```
Week 1-2:   環境構築・認証・ペアリング機能
Week 3-4:   共有カレンダー（月/週ビュー + CRUD）
Week 5-6:   買い物リスト（CRUD + チェック機能）
Week 7-8:   TODO管理（担当者・優先度・カレンダー連携）
Week 9-10:  支出登録・カテゴリ・区分管理
Week 11:    立替精算ページ + 予算設定
Week 12:    ホーム統合ビュー + Realtime同期 + βテスト
```

### Phase 2（Month 4〜6）

```
Month 4: AIカテゴリ分類 + レシートOCR + 月次AIレビュー
Month 5: 目的別積立 + 純資産推移 + クレカ管理
Month 6: Supabase pg_cron + Edge Functions（週次通知・繰り返し支出）+ 外部カレンダー同期
```

### Phase 3（Month 7〜12）

```
Month 7-8:  銀行API連携 + 残高自動同期
Month 9-10: ライフプランシミュレーター + AIチャット
Month 11:   家族拡張モード（3人以上）
Month 12:   投資管理 + データエクスポート + PWA対応
```

### KPI（成功指標）

| 指標 | MVP目標 | 6ヶ月目標 |
|------|---------|----------|
| DAU/MAU | 40%以上 | 55%以上 |
| 支出登録件数/月/カップル | 20件以上 | 50件以上 |
| TODO完了率 | 60%以上 | 70%以上 |
| ペア継続率（90日）| 60% | 75% |
| App Store評価 | 4.0以上 | 4.3以上 |

---

## Appendix：技術スタック詳細

| レイヤー | 技術 | 用途 |
|---------|------|------|
| Frontend | Next.js 15 (App Router) | Webアプリ本体 |
| UI | Tailwind CSS + shadcn/ui | コンポーネント |
| 状態管理 | Zustand + React Query | ローカル状態 + サーバー同期 |
| Backend | Supabase | Auth / DB / Realtime / Storage |
| DB | PostgreSQL (Supabase) | メインDB |
| Automation | Supabase pg_cron + Edge Functions | バッチ処理・通知 |
| AI | Anthropic Claude API | 分類・生成・分析 |
| OCR | Claude Vision | レシート解析 |
| Push通知 | Supabase + Expo Notifications | リマインド |
| Hosting | Vercel | Next.js ホスティング |
| Monitoring | Sentry + Supabase Logs | エラー追跡 |
| CI/CD | GitHub Actions | テスト・デプロイ自動化 |

---

*Couple OS v1.0 Product Specification — 作成日: 2026-03-13*
