import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async (request)=>{
  if(request.method==="OPTIONS") return new Response(null,{status:204,headers:cors});
  if(request.method!=="POST") return json({error:"Method not allowed"},405);
  const auth=request.headers.get("Authorization")??"";
  if(!auth.startsWith("Bearer "))return json({error:"Log in first"},401);
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const account=Deno.env.get("CLOUDFLARE_ACCOUNT_ID"),token=Deno.env.get("CLOUDFLARE_STREAM_TOKEN");
  if(!url||!anon||!service||!account||!token)return json({error:"Video uploads are not configured"},503);
  const caller=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
  const {data:{user},error}=await caller.auth.getUser();
  if(error||!user)return json({error:"Unauthorized"},401);
  const body=await request.json().catch(()=>({}));
  if(!/^[a-f0-9-]{36}$/i.test(body.business_id??""))return json({error:"Invalid business"},400);
  const admin=createClient(url,service,{auth:{persistSession:false}});
  const {data:business}=await admin.from("businesses").select("id").eq("id",body.business_id).eq("owner_id",user.id).eq("hidden",false).maybeSingle();
  if(!business)return json({error:"Business owner access required"},403);
  const since=new Date(Date.now()-3600000).toISOString();
  const {count}=await admin.from("video_uploads").select("uid",{count:"exact",head:true}).eq("owner_id",user.id).gte("created_at",since);
  if((count??0)>=10)return json({error:"Video upload limit reached. Try later."},429);
  const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/stream/direct_upload`,{
    method:"POST",headers:{"Authorization":`Bearer ${token}`,"Content-Type":"application/json"},
    body:JSON.stringify({maxDurationSeconds:90,meta:{business_id:body.business_id}}),
  });
  const result=await response.json().catch(()=>({}));
  const uid=result.result?.uid,uploadURL=result.result?.uploadURL;
  if(!response.ok||!result.success||!uid||!uploadURL||!/^[a-f0-9]{32}$/.test(uid))
    return json({error:"Could not prepare video upload"},502);
  const saved=await admin.from("video_uploads").insert({uid,owner_id:user.id,business_id:body.business_id});
  if(saved.error)return json({error:"Could not record video upload"},500);
  return json({uid,uploadURL});
});
