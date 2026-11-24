import { z } from 'zod'
import type { Discovery } from './model'
export const MAX_LIFETIME_SEARCHES=8
interface Entry { until:number; result?:Discovery; pendingUntil?:number }
/** One native Durable Object serializes reservations across isolates/restarts. No public route exposes it. */
export class ResearchGate {
 constructor(private state:DurableObjectState){}
 async fetch(request:Request):Promise<Response>{
 const input=z.object({op:z.enum(['reserve','finish','fail']),key:z.string().min(1).max(100),userId:z.string().min(1).max(150),result:z.unknown().optional()}).parse(await request.json())
 const now=Date.now();const cacheKey='cache:'+input.key
 if(input.op==='reserve')return this.state.storage.transaction(async tx=>{
 const entry=await tx.get<Entry>(cacheKey)
 if(entry?.result&&entry.until>now)return Response.json({state:'cached',result:entry.result})
 if(entry?.pendingUntil&&entry.pendingUntil>now)return Response.json({state:'pending'})
 const day=new Date(now).toISOString().slice(0,10);const userKey='usage:'+day+':'+input.userId
 const total=await tx.get<number>('lifetime')??0;const used=await tx.get<number>(userKey)??0
 if(total>=MAX_LIFETIME_SEARCHES||used>=2)return Response.json({state:'limited'})
 await tx.put('lifetime',total+1);await tx.put(userKey,used+1);await tx.put(cacheKey,{until:now+86400000,pendingUntil:now+300000})
 return Response.json({state:'reserved'})
 })
 if(input.op==='finish'){await this.state.storage.put(cacheKey,{until:now+86400000,result:input.result});return Response.json({ok:true})}
 await this.state.storage.delete(cacheKey);return Response.json({ok:true})
 }
}
