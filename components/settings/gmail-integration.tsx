'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { toast } from 'sonner'

type Status = {
  reviewCount: number
  connected: boolean
  watching: boolean
  oauthTesting: boolean
  connection?: {
    email: string
    last_synced_at: string | null
    last_error: string | null
    watch_expires_at: string | null
  }
  notifications: {
    message_id: string
    provider: string
    amount: number | null
    merchant: string | null
    used_at: string | null
    kind: string
    reason: string | null
    expense_id: string | null
  }[]
}

async function request(path: string, method = 'GET') {
  const response = await fetch(`/api/integrations/gmail/${path}`, { method })
  const result = await response.json()
  if (!response.ok)
    throw new Error(result.error || '連携状態を取得できませんでした')
  return result
}

export function GmailIntegration({ userId }: { userId: string }) {
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get('gmail')
    if (result === 'connected') toast.success('Googleと連携しました')
    else if (result === 'connected_pending')
      toast.info('Googleと連携しました。受信通知の設定状態を確認してください。')
    else if (result === 'permission')
      toast.error('Gmailの読み取り許可が必要です')
    else if (result === 'expired')
      toast.error('連携操作の有効期限が切れました。もう一度連携してください。')
    else if (result === 'failed') toast.error('Googleとの連携に失敗しました')
  }, [])
  const queryClient = useQueryClient()
  const status = useQuery<Status>({
    queryKey: ['gmail-status', userId],
    queryFn: () => request('status'),
    refetchInterval: 60_000,
  })
  const sync = useMutation({
    mutationFn: () => request('sync', 'POST'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['gmail-status', userId],
      })
      await queryClient.invalidateQueries({ queryKey: ['expenses'] })
      await queryClient.invalidateQueries({ queryKey: ['expense-summary'] })
      toast.success('利用通知を同期しました')
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const disconnect = useMutation({
    mutationFn: () => request('status', 'DELETE'),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['gmail-status', userId] }),
    onError: (error: Error) => toast.error(error.message),
  })
  const connection = status.data?.connection
  const watching = status.data?.watching
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          カード利用通知の自動取り込み
        </CardTitle>
        <CardDescription>
          JCB・三井住友カード・楽天カード・ビューカードの通知を、連携開始後の利用通知から取り込みます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          通常の利用は未確定の個人支出として反映します。ビューカードは速報の時点で仮計上します。楽天カードは利用先を含む通常版で反映します。投信積立は生活費から除き、判断できない通知は確認待ちになります。
        </p>
        {status.isPending ? (
          <p className="text-sm">連携状態を確認中…</p>
        ) : status.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {status.error.message}
          </p>
        ) : status.data?.connected ? (
          <>
            <p className="text-sm">{connection?.email}</p>
            <p className="text-sm text-muted-foreground">
              {watching
                ? 'メール受信時に自動同期'
                : '受信通知の設定待ち。手動同期が利用できます。'}
            </p>
            {connection?.last_synced_at && (
              <p className="text-xs text-muted-foreground">
                最終同期：
                {new Date(connection.last_synced_at).toLocaleString('ja-JP', {
                  timeZone: 'Asia/Tokyo',
                })}
              </p>
            )}
            {connection?.last_error && (
              <p role="alert" className="text-sm text-destructive">
                {connection.last_error}
              </p>
            )}
            {status.data.oauthTesting && (
              <p className="text-sm text-muted-foreground">
                試験連携のため、Googleの許可は7日間で期限切れになります。本稼働前にGoogle側の公開設定が必要です。
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => sync.mutate()}
                disabled={sync.isPending}
              >
                {sync.isPending ? '同期中…' : '今すぐ同期'}
              </Button>
              <form action="/api/integrations/gmail/start" method="post">
                <Button variant="outline" type="submit">
                  Googleと再連携
                </Button>
              </form>
              <Button
                variant="ghost"
                onClick={() => disconnect.mutate()}
                disabled={disconnect.isPending || sync.isPending}
              >
                連携を解除
              </Button>
            </div>
            {status.data.reviewCount > 0 && (
              <p role="status" className="text-sm text-amber-700 dark:text-amber-400">
                {status.data.reviewCount}件の通知が確認待ちです。これらの通知からは支出を計上していません。Money Forwardなどから登録済みの場合は追加不要です。
              </p>
            )}
            {status.data.notifications.length > 0 && (
              <ul className="divide-y">
                {status.data.notifications.map((item) => (
                  <li key={item.message_id} className="py-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span>{item.merchant || '利用先を確認してください'}</span>
                      <span>
                        {item.amount === null
                          ? '金額未確認'
                          : `¥${item.amount.toLocaleString()}`}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.provider === 'rakuten'
                        ? '楽天カード'
                        : item.provider === 'viewcard'
                          ? 'ビューカード'
                          : item.provider.toUpperCase()}{' '}
                      ·{' '}
                      {item.kind === 'purchase'
                        ? '未確定の支出'
                        : item.kind === 'investment'
                          ? '投信積立（生活費から除外）'
                          : '確認待ち'}
                      {item.reason ? ` · ${item.reason}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <form action="/api/integrations/gmail/start" method="post">
            <Button type="submit">Googleと連携する</Button>
          </form>
        )}
        <p className="text-xs text-muted-foreground">
          楽天カードは楽天e-NAVIで「カード利用お知らせメール」と「速報版」を設定し、このアプリと連携したGmailで受信してください。通常版は最短2日後、速報版は最短翌日に届きます。
          <a
            className="ml-1 underline"
            href="https://www.rakuten-card.co.jp/security/information-mail/"
            target="_blank"
            rel="noreferrer"
          >
            楽天カードの設定方法
          </a>
        </p>
        <p className="text-xs text-muted-foreground">
          Googleの許可はGmail全体の読み取りが対象です。LIFE_OSでは対応カードの利用通知を解析します。メールの受信から反映まで遅れる場合があります。
        </p>
      </CardContent>
    </Card>
  )
}
