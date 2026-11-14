import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Gmail連携のプライバシー情報 | LIFE_OS',
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-7 px-6 py-12 leading-8">
      <h1 className="text-2xl font-bold">
        LIFE_OS：Gmail連携のプライバシー情報
      </h1>
      <p>
        更新日：2026年11月14日。LIFE_OSは、家計を記録するための個人利用アプリです。このページは、JCB・三井住友カード・楽天カード・ビューカードの利用通知を取り込むGmail連携について説明します。
      </p>
      <section>
        <h2 className="text-lg font-semibold">取得する情報と目的</h2>
        <p>
          利用者の同意により、Gmailの読み取り権限を取得します。この権限はメールボックス全体を読み取れる権限です。アプリは送信元・件名・認証結果を確認し、対象のカード利用通知から利用日時、金額、利用先、カードの表示情報を解析して、未確定の支出として記録します。メールの送信・削除・変更は行いません。投信積立や判定できない通知は、通常の支出とは分けて扱います。
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold">保存と処理</h2>
        <p>
          連携したメールアドレス、暗号化した継続認証用トークン、同期・通知監視の状態、重複登録を防ぐメールID、解析した利用情報を保存します。メール本文全体は取り込み記録に保存しません。取得・保存にはGoogleのAPIと通知サービス、Vercel上のアプリ、Supabaseのデータベースを使用します。支出として登録された情報は、LIFE_OSの家計データとして扱われます。
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold">連携の解除とデータの削除</h2>
        <p>
          LIFE_OSの設定画面から連携を解除すると、保存した認証トークンを消去し、自動取り込みを停止します。登録済みの支出と取り込み記録は残ります。Google側の許可は、Googleアカウントの接続管理画面から取り消せます。保存済みデータの削除については、下記の連絡先までお問い合わせください。
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold">連絡先</h2>
        <p>
          <a className="underline" href="mailto:ren.citizen.finance@gmail.com">
            ren.citizen.finance@gmail.com
          </a>
        </p>
      </section>
    </main>
  )
}
