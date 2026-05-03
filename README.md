# Couple OS

> 二人の生活を、一つのOSで動かす

カップル向けの統合生活管理プラットフォーム。共有カレンダー、買い物リスト、TODO管理、支出管理、予算管理、立替精算を一つのアプリで。

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: Tailwind CSS + shadcn/ui
- **State**: Zustand + TanStack Query
- **Backend**: Supabase (Auth, PostgreSQL, Realtime, Storage)
- **Language**: TypeScript
- **Validation**: Zod + React Hook Form

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment variables:
   ```bash
   cp .env.local.example .env.local
   ```

3. Fill in your Supabase project credentials in `.env.local`

4. Run database migrations:
   ```bash
   npx supabase db push
   ```

5. Start development:
   ```bash
   npm run dev
   ```

## Environment Variables

The app requires these variables in local development and production:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_APP_NAME=
```

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public anon key used by the client and server helpers
- `SUPABASE_SERVICE_ROLE_KEY`: Reserved for server-side admin operations
- `NEXT_PUBLIC_APP_URL`: Base URL of the deployed app, for example `https://life-os.vercel.app`
- `NEXT_PUBLIC_APP_NAME`: Display name shown in the UI

If a required variable is missing, the app now fails fast with a clear error message during startup.

## Deploy

The simplest deployment target is Vercel.

1. Import the repository into Vercel.
2. In Project Settings -> Environment Variables, add every variable from `.env.local.example`.
3. Set `NEXT_PUBLIC_APP_URL` to the production URL that Vercel assigns to the project.
4. Run the deployment.

For local production verification:

```bash
npm run build
npm run start
```

## Project Structure

```
app/
├── (auth)/          # 認証ページ (login, register, callback)
├── (app)/           # メインアプリ
│   ├── home/        # ホームダッシュボード
│   ├── calendar/    # 共有カレンダー
│   ├── shopping/    # 買い物リスト
│   ├── todos/       # TODO管理
│   ├── finance/     # 家計管理
│   │   ├── dashboard/   # CFOダッシュボード
│   │   ├── expenses/    # 支出管理
│   │   ├── settlements/ # 立替精算
│   │   ├── budgets/     # 予算管理
│   │   └── savings/     # 積立 (Phase 2)
│   └── settings/    # 設定
components/
├── ui/              # shadcn/ui コンポーネント
├── shared/          # 共通コンポーネント (sidebar, header, bottom-nav)
├── calendar/        # カレンダー関連
├── finance/         # 家計関連
├── shopping/        # 買い物関連
└── todos/           # TODO関連
lib/
├── supabase/        # Supabase クライアント (client, server, middleware)
├── hooks/           # React Query カスタムフック
├── validators/      # Zod スキーマ
└── utils/           # ユーティリティ
stores/              # Zustand ストア
types/               # TypeScript 型定義
supabase/
└── migrations/      # DBマイグレーション
```

## Full Specification

See [couple-os-spec.md](./couple-os-spec.md) for the complete product specification.
