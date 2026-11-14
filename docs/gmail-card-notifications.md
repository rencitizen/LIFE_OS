# Card notification import from Gmail

The Settings page connects the signed-in user's Gmail with the read-only Gmail scope. Purchase notifications received after connection create personal, non-settlement expenses, marked **カード通知・未確定**. Investment contributions and incomplete/cancellation notifications are retained in the Settings list without affecting expenses. Manual sync also scans View Card email up to 30 days back, limited to mail received after connection. View Card flash notices create provisional expenses immediately. A uniquely matching final notice reuses the expense; ambiguous matches are held for review.

## Server configuration

Configure server-only production variables from `.env.local.example`. `NEXT_PUBLIC_APP_URL` must be the canonical app origin and the OAuth redirect must be exactly `<origin>/api/integrations/gmail/callback`. Keep the 32-byte base64 `GMAIL_TOKEN_ENCRYPTION_KEY` stable; changing it makes stored tokens unreadable. Do not upload `.env.local` or OAuth JSON to source control.

Apply the Gmail migrations in timestamp order, through `20261114111755_viewcard_gmail_notifications.sql`. Both new tables have RLS and service-role-only privileges. The ingestion function runs as SECURITY INVOKER, with EXECUTE restricted to service_role; it validates current membership, claims the Gmail account/message ID, and inserts the expense in one transaction. Full message bodies and access tokens are not persisted. Refresh tokens use AES-256-GCM with the app user ID as authenticated data.

## Receive-trigger configuration

1. Enable the Cloud Pub/Sub API in the OAuth client's Google Cloud project.
2. Create a private topic, e.g. `life-os-gmail-notifications`. Grant **Pub/Sub Publisher** on this topic only to `gmail-api-push@system.gserviceaccount.com`.
3. Create a dedicated push service account with no project-wide data permissions. Create a push subscription for the topic, endpoint `<origin>/api/integrations/gmail/push`, authenticated using that service account. Set the OIDC audience to that exact endpoint URL. Grant Google's Pub/Sub service agent the required token-creator permission on that service account only, if required by the project.
4. Set `GMAIL_PUBSUB_TOPIC` to the full topic resource, `GMAIL_PUSH_AUDIENCE` to the endpoint URL and `GMAIL_PUSH_SERVICE_ACCOUNT` to that account's email. The handler verifies Google's signed ID token and exact service-account email before accepting events.
5. Connect Gmail in Settings, then confirm an unexpired watch in the status response and successful subscription delivery. Do not call monitoring active just because the OAuth client exists.

The daily Vercel cron at 18:00 UTC renews Gmail watches before expiry and performs catch-up synchronization. On a plan supporting more frequent cron, the fallback can be shortened. Push events trigger immediate synchronization independently of cron. History pagination and 404 recovery are supported. A backlog exceeding 500 message IDs is explicitly reported rather than advancing the cursor and silently losing notifications.

## Authorization and pilot limitations

- The Google app is initially in **Testing**. Gmail refresh tokens expire after seven days in that state. Set up the appropriate production/personal-use publication status before unattended operation and set `GMAIL_OAUTH_TESTING=false` only afterward. The Settings UI displays the testing limitation by default.
- The user must authorize Gmail from a normal system browser. Restricted-scope or unverified-app prompts may require the user to complete the flow themselves.
- Notifications are provisional authorizations. They are not proof of a final charge. Separate cancellation notices are retained for review; existing expenses are not automatically reversed from ambiguous email text.
- Money Forward reconciliation is not automatically scheduled by this change. The existing Money Forward importer can link exact matching expenses, but renamed merchants/ambiguous matches still require review. Do not run an independent unconditional import into the same ledger.
- Disconnect disables ingestion and erases the locally stored encrypted refresh token. Users can also revoke the Google app's grant in their Google account.
- This implementation targets the observed JCB sender `mail@qa.jcb.co.jp` and SMBC sender `statement@vpass.ne.jp`, Rakuten sender `info@mail.rakuten-card.co.jp`, and View Card sender `viewcard@mail.viewsnet.jp`. It excludes V Point Pay, promotions, and senders failing Gmail's DMARC result. Unsupported template changes go to review when recognized.

## Validation

`npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. Tests cover raw ISO-2022-JP decoding, investment/cancellation handling, sender authentication, transaction dates, atomic DB rollback, retry deduplication, separate same-amount purchases, and service-role privilege restrictions. A real OAuth consent and an authenticated Pub/Sub delivery must still be exercised before declaring the full flow operational.
