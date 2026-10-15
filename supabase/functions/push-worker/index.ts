import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
type Job = { msg_id: number; read_ct: number; notification_id: string; user_id: string };
const json = (data: unknown, status=200) => new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});
Deno.serve(async (req) => {
  const secret = Deno.env.get("PUSH_WORKER_SECRET");
  if (!secret || req.method !== "POST" || req.headers.get("Authorization") !== `Bearer ${secret}`)
    return json({error:"Unauthorized"},401);
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({error:"Worker configuration missing"},503);
  const db = createClient(url,key,{auth:{persistSession:false}});
  const claimed = await db.rpc("claim_activity_push");
  if (claimed.error) return json({error:claimed.error.message},500);
  let sent=0,failed=0,archived=0;
  for (const job of (claimed.data ?? []) as Job[]) {
    try {
      const {data:notice,error:noticeError}=await db.from("notifications").select("id,body,user_id").eq("id",job.notification_id).eq("user_id",job.user_id).maybeSingle();
      if (noticeError) throw noticeError;
      if (!notice) { await db.rpc("ack_activity_push",{job_id:job.msg_id}); archived++; continue; }
      const {data:devices,error:deviceError}=await db.from("push_devices").select("expo_token").eq("user_id",job.user_id);
      if(deviceError) throw deviceError;
      let retry=false;
      for(const device of devices ?? []) {
        const token=device.expo_token as string;
        const {data:existing,error:existsError}=await db.from("push_deliveries").select("notification_id").eq("notification_id",job.notification_id).eq("expo_token",token).maybeSingle();
        if(existsError) throw existsError;
        if(existing) continue;
        const response=await fetch("https://exp.host/--/api/v2/push/send",{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({to:token,title:"Business Partner",body:notice.body,sound:"default",data:{notification_id:job.notification_id}}),
        });
        if(!response.ok) {retry=true;break;}
        const result=await response.json();
        const ticket=result.data;
        if(ticket?.status==="error") {
          if(ticket.details?.error==="DeviceNotRegistered"){
            await db.from("push_devices").delete().eq("expo_token",token).eq("user_id",job.user_id);
            continue;
          }
          retry=true; break;
        }
        if(ticket?.status!=="ok") {retry=true;break;}
        const {error:saveError}=await db.from("push_deliveries").upsert({notification_id:job.notification_id,expo_token:token},{onConflict:"notification_id,expo_token"});
        if(saveError) throw saveError;
        sent++;
      }
      if(retry) {
        failed++;
        if(job.read_ct>=5) {await db.rpc("ack_activity_push",{job_id:job.msg_id});archived++;}
      } else {
        const done=await db.rpc("ack_activity_push",{job_id:job.msg_id});
        if(done.error) throw done.error;
        archived++;
      }
    }catch(e) {
      console.error("push delivery failed",job.msg_id,e instanceof Error?e.message:"unknown error");
      failed++;
      if(job.read_ct>=5) {await db.rpc("ack_activity_push",{job_id:job.msg_id});archived++;}
    }
  }
  return json({processed:(claimed.data??[]).length,sent,failed,archived});
});
