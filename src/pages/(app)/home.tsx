import { useState } from 'react'
import { AuthOverlay, getAuthToken, useAuth, useMutations, useQuery, signOut } from 'deepspace'
import BuySmart from '../../buysmart/BuySmart'
import { comparisonSchema, type Comparison, type Discovery, type ProductProvider } from '../../buysmart/model'
const liveProvider:ProductProvider={async search(input){const response=await fetch('/api/actions/discover',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await getAuthToken()},body:JSON.stringify(input)});const r=await response.json() as {success:boolean;data:Discovery;error:string};if(!r.success)throw new Error(r.error);return r.data}}
export default function Home(){
 const {isSignedIn,userId}=useAuth();const [auth,setAuth]=useState(false);const [live,setLive]=useState(false)
 const {records}=useQuery<{snapshot:Comparison}>('comparisons')
 const mutations=useMutations<{snapshot:Comparison}>('comparisons')
 const history=records.flatMap(r=>{const c=comparisonSchema.safeParse(r.data.snapshot);return c.success?[{...c.data,id:r.recordId}]:[]})
 return <><BuySmart key={String(userId)+String(live)} live={live} provider={live?liveProvider:undefined} cloudHistory={isSignedIn?history:undefined} onSave={isSignedIn?async c=>{if(!mutations.ready)throw new Error('Storage connecting');await mutations.createConfirmed({snapshot:c})}:undefined} onDelete={isSignedIn?async id=>{if(!mutations.ready)throw new Error('Storage connecting');await mutations.removeConfirmed(id)}:undefined} account={<>{isSignedIn?<><label><input type="checkbox" checked={live} onChange={e=>setLive(e.target.checked)}/>Live research</label><button onClick={()=>void signOut()}>Sign out</button></>:<button onClick={()=>setAuth(true)}>Sign in to save privately ↗</button>}</>}/>{auth&&<AuthOverlay onClose={()=>setAuth(false)}/>}</>
}
