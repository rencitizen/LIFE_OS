import { beforeEach, expect, it, vi } from 'vitest'
const m=vi.hoisted(()=>({from:vi.fn(),rpc:vi.fn(),fetch:vi.fn(),updates:[] as Record<string,unknown>[],kind:'review',reason:'利用日時・金額・利用先の確認が必要です'}))
vi.mock('server-only',()=>({}))
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({from:m.from,rpc:m.rpc})}))
vi.mock('@/lib/supabase/server',()=>({createClient:vi.fn()}))
vi.mock('./secrets',()=>({required:(name:string)=>name==='NEXT_PUBLIC_APP_URL'?'https://lifeos.test':'test',decryptToken:()=> 'test'}))
vi.mock('google-auth-library',()=>({OAuth2Client:class { setCredentials(){} async getAccessToken(){return {token:'test'}} }}))
import {syncConnection,type Connection} from './server'
const connection:Connection={user_id:'owner',couple_id:'couple',email:'test@example.com',refresh_token_encrypted:'test',connected_at:'2026-10-16T00:00:00Z',history_id:'100',watch_expires_at:null,enabled:true}
const message={id:'retry',internalDate:String(new Date('2026-10-25').getTime()),payload:{mimeType:'text/plain',headers:[{name:'From',value:'statement@vpass.ne.jp'},{name:'Subject',value:'ご利用のお知らせ【三井住友カード】'},{name:'Authentication-Results',value:'mx.google.com; dmarc=pass header.from=vpass.ne.jp;'}],body:{data:Buffer.from('◇利用日：2026/10/25 18:55\n◇利用先：ローソン\n◇利用金額：746円').toString('base64url')}}}
beforeEach(()=>{
 vi.clearAllMocks();m.updates.length=0;m.kind='review';m.reason='利用日時・金額・利用先の確認が必要です'
 vi.stubGlobal('fetch',m.fetch);m.rpc.mockResolvedValue({error:null})
 m.fetch.mockImplementation(async(url:string)=>({ok:true,status:200,json:async()=>url.includes('/history?')?{historyId:'200'}:message}))
 m.from.mockImplementation((table:string)=>{
  let id=false;let updating=false
  const result=()=>({data:table==='users'?{couple_id:'couple'}:id?{message_id:'retry',kind:m.kind,reason:m.reason,expense_id:null,parser_version:0}:[{message_id:'retry'}],error:null})
  const chain={select:()=>chain,eq:(key:string)=>{if(key==='message_id')id=true;return chain},is:()=>chain,lt:()=>chain,gte:()=>chain,in:()=>chain,or:()=>chain,order:()=>chain,limit:()=>chain,
   update:(values:Record<string,unknown>)=>{updating=true;m.updates.push(values);return chain},single:async()=>result(),maybeSingle:async()=>result(),then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(updating?{error:null}:result()).then(resolve)}
  return chain
 })
})
it('reparses a queued failure even without new mail and persists its parser version',async()=>{
 await expect(syncConnection(connection)).resolves.toMatchObject({processed:1})
 expect(m.rpc).toHaveBeenCalledWith('ingest_gmail_card_notifications',expect.objectContaining({p_notifications:[expect.objectContaining({amount:746,kind:'purchase',parserVersion:2})]}))
 expect(m.updates).toContainEqual(expect.objectContaining({history_id:'200',last_error:null}))
})
it('does not advance the cursor after a write error',async()=>{
 m.rpc.mockResolvedValue({error:{message:'DB unavailable'}})
 await expect(syncConnection(connection)).rejects.toThrow('Gmail sync failed')
 expect(m.updates.some(row=>'history_id' in row)).toBe(false)
})
it('finds previously skipped View Card mail when the user runs a manual sync', async () => {
 const viewCard = {
  ...message,
  internalDate: String(Date.now()),
  payload: {
   mimeType: 'text/plain',
   headers: [
    {name:'From',value:'viewcard@mail.viewsnet.jp'},
    {name:'Subject',value:'◆速報版◆ビューカードご利用情報のお知らせ（本人会員利用）'},
    {name:'Authentication-Results',value:'mx.google.com; dmarc=pass header.from=mail.viewsnet.jp'},
   ],
   body: {data:Buffer.from('ご利用カード：ビューカード\n・ 利用日時：2026/11/14 17:34:46\n・ 利用金額：1,000円\n・ 利用加盟店：国内加盟店').toString('base64url')},
  },
 }
 m.fetch.mockImplementation(async (url: string) => ({
  ok: true,
  status: 200,
  json: async () => url.includes('/history?') ? {historyId:'200'}
   : url.includes('/messages?') ? {messages:[{id:'retry'}]} : viewCard,
 }))
 await expect(syncConnection(connection, true)).resolves.toMatchObject({processed:1})
 expect(m.fetch.mock.calls.some(([url]) => new URL(url).searchParams.get('q')?.includes('from:viewcard@mail.viewsnet.jp'))).toBe(true)
 expect(m.rpc).toHaveBeenCalledWith('ingest_gmail_card_notifications', expect.objectContaining({
  p_notifications: [expect.objectContaining({provider:'viewcard',kind:'purchase',stage:'authorization',amount:1000})],
 }))
})
it('does not revive deleted purchases or reclassify cancellations',async()=>{
 for(const [kind,reason] of [['purchase',''],['review','取消・返金の照合が必要です']]){
  m.kind=kind;m.reason=reason
  await expect(syncConnection(connection)).resolves.toMatchObject({processed:0})
 }
 expect(m.rpc).not.toHaveBeenCalled();expect(m.fetch).toHaveBeenCalledTimes(2)
})
