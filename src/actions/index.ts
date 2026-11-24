import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { searchSchema } from '../buysmart/model'
import { LiveProvider } from '../buysmart/providers'
import type { Discovery } from '../buysmart/model'
export function liveAllowed(userId:string,env:Pick<Env,'LIVE_ENABLED'|'LIVE_USER_IDS'>){return env.LIVE_ENABLED==='true'&&(env.LIVE_USER_IDS??'').split(',').map(s=>s.trim()).includes(userId)}
const discover:ActionHandler<Env>=async({userId,params,tools,env})=>{
 if(!liveAllowed(userId,env))return {success:false,error:'Live research is disabled for this account. The free demo is available at /.'}
 const parsed=searchSchema.safeParse(params);if(!parsed.success)return {success:false,error:'Enter a valid query, category, and budget between $25 and $10,000.'}
 const input=parsed.data
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(userId+JSON.stringify({...input,query:input.query.toLowerCase()})))
 const key=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('')
 const gate=env.RESEARCH_GATE.get(env.RESEARCH_GATE.idFromName('research-budget-v1'))
 const request=(op:string,result?:Discovery)=>gate.fetch(new Request('https://internal/gate',{method:'POST',body:JSON.stringify({op,key,userId,result})}))
 const reservation=await (await request('reserve')).json() as {state:string;result?:Discovery}
 if(reservation.state==='cached'&&reservation.result)return {success:true,data:reservation.result}
 if(reservation.state!=='reserved')return {success:false,error:reservation.state==='pending'?'An identical search is already running. Please wait before retrying.':'The research usage limit has been reached. Explore demo mode or reopen a saved comparison.'}
 try{const provider=new LiveProvider((endpoint,body)=>tools.integration(endpoint,body));const result=await provider.search(input);await request('finish',result);return {success:true,data:result}}
 catch(e){await request('fail');return {success:false,error:e instanceof Error?e.message:'Research is temporarily unavailable.'}}
}
export const actions:Record<string,ActionHandler<Env>>={discover}
