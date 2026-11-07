import { describe, it, expect } from "vitest";
import { parseViewCardEmail, viewCardExternalId } from "./view-card-email";
const from = '"株式会社ビューカード" <viewcard@mail.viewsnet.jp>';
const subject = "◆速報版◆ビューカードご利用情報のお知らせ（本人会員利用）";
const body = "ご利用カード ：ビックカメラSuicaカード\n・ 利用日時 ：2026/11/7 18:25:02\n・ 利用金額 ：7,374円\n・ 利用加盟店 ：国内加盟店";
describe("View Card mail", () => {
 it("parses authorization without booking a finalized expense", () => {
  expect(parseViewCardEmail({from,subject,body,messageId:"a"})).toMatchObject({provider:"viewcard",kind:"review",amount:7374,merchant:null,usedAt:"2026-11-07T18:25:02+09:00"});
 });
 it("parses confirmation with named merchant", () => {
  expect(parseViewCardEmail({from,subject:subject.replace("速報版","確報版"),body:body.replace("国内加盟店","テスト店舗"),messageId:"b"})).toMatchObject({kind:"purchase",merchant:"テスト店舗"});
 });
 it("ignores untrusted or unrelated emails", () => {
  expect(parseViewCardEmail({from:"attacker@example.com",subject,body,messageId:"a"})).toBeNull();
 });
 it("keeps distinct emails distinct", () => expect(viewCardExternalId("a")).not.toBe(viewCardExternalId("b")));
});
