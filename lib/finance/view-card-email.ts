export type ViewCardNotice = {
  provider: "viewcard"; kind: "review" | "purchase"; stage: "authorization" | "confirmed";
  cardName: string; usedAt: string; amount: number; merchant: string | null;
  messageId: string; reason: string | null;
};
/** Parse known VIEW CARD notifications. Authorizations are NOT finalized expenses. */
export function parseViewCardEmail(mail: {from:string;subject:string;body:string;messageId:string}): ViewCardNotice | null {
  const sender = (mail.from.match(/<([^>]+)>/)?.[1] || mail.from.split(/\s+/).pop() || "").toLowerCase();
  if (sender !== "viewcard@mail.viewsnet.jp" || !mail.subject.includes("ビューカードご利用情報のお知らせ")) return null;
  const preliminary = mail.subject.includes("速報版");
  if (!preliminary && !mail.subject.includes("確報版")) return null;
  const get = (key:string) => {
    const line = mail.body.split(/\r?\n/).find(line => line.trim().replace(/^[・•]\s*/, "").startsWith(key));
    return line?.split(/[：:]/).slice(1).join(":").trim() || null;
  };
  const cardName = get("ご利用カード");
  const date = get("利用日時");
  const amountString = get("利用金額");
  if (!cardName || !date || !amountString || !mail.messageId) return null;
  const d = date.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  const a = amountString.match(/^([\d,]+)\s*円$/);
  if (!d || !a) return null;
  const pad = (n:string) => n.padStart(2, "0");
  const usedAt = d[1]+"-"+pad(d[2])+"-"+pad(d[3])+"T"+pad(d[4])+":"+d[5]+":"+d[6]+"+09:00";
  const parsed = new Date(usedAt);
  if (Number.isNaN(parsed.getTime()) || Number(d[2]) > 12 || Number(d[2]) < 1 || Number(d[3]) > 31 || Number(d[3]) < 1 || Number(d[4]) > 23) return null;
  const amount = Number(a[1].replace(/,/g,""));
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;
  const rawMerchant = get("利用加盟店");
  const merchant = rawMerchant && !["国内加盟店","海外加盟店"].includes(rawMerchant) ? rawMerchant : null;
  const kind = !preliminary && merchant ? "purchase" : "review";
  return {
    provider:"viewcard", kind, stage: preliminary ? "authorization" : "confirmed",
    cardName, usedAt, amount, merchant, messageId:mail.messageId,
    reason:preliminary ? "速報版のため確報まで支出集計対象外" : merchant ? null : "加盟店不明のため要確認",
  };
}
export const viewCardExternalId = (messageId:string) => "viewcard:gmail:"+messageId;
