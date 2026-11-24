import { comparisonSchema, type Comparison } from './model'
export interface StorageLike { getItem(key:string):string|null; setItem(key:string,value:string):void }
const key = 'buysmart-demo-history-v1'
export function readHistory(storage: StorageLike): Comparison[] {
 try { const raw: unknown = JSON.parse(storage.getItem(key) ?? '[]'); if(!Array.isArray(raw)) return []; return raw.flatMap(v=>{ const r=comparisonSchema.safeParse(v);return r.success?[r.data]:[] }) } catch {return []}
}
export function saveHistory(storage:StorageLike, comparison:Comparison) { const valid=comparisonSchema.parse(comparison);storage.setItem(key,JSON.stringify([valid,...readHistory(storage).filter(c=>c.id!==valid.id)].slice(0,30))) }
export function deleteHistory(storage:StorageLike,id:string) {storage.setItem(key,JSON.stringify(readHistory(storage).filter(c=>c.id!==id)))}
