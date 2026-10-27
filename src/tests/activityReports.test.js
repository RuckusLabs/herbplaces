import test from 'node:test';
import assert from 'node:assert/strict';
import { activityReportEmail,dispatchActivityReports,createActivityReportHandler,createReportUnsubscribeHandler } from '../../supabase/functions/_shared/activityReports.js';
const token='20000000-0000-0000-0000-000000000001';
const config={from:'Little Herb Places <reports@example.com>',siteUrl:'https://littleherbplaces.com',unsubscribeUrl:'https://example.supabase.co/functions/v1/activity-report-unsubscribe',apiKey:'test-only'};
const job={id:'report-1',lease_token:'lease-1',payload:{account_email:'owner@example.com',unsubscribe_token:token,place_name:'Moss & Fern',place_slug:'moss-and-fern',plan:'Thrive pilot',period_start:'2026-09-01',period_end:'2026-10-01',previous_start:'2026-08-01',current:{profile_view:24,primary_click:3},previous:{profile_view:10},items:[{title:'Seasonal tea workshop',kind:'event_click',total:2}]}};
test('monthly report emails describe completed periods and actions, preserve privacy, and support one-click unsubscribe',()=>{
 const email=activityReportEmail(job,config);assert.deepEqual(email.to,['owner@example.com']);assert.match(email.text,/September 1 – 30, 2026/);assert.match(email.html,/September 1 – 30, 2026/);assert.match(email.text,/Previous month: August 1 – 31, 2026/);assert.doesNotMatch(email.text + email.html,/different lengths/);assert.match(email.text,/Profile views: 24 \(previous month: 10\)/);assert.match(email.text,/not unique visitors/);assert.match(email.text,/Seasonal tea workshop: 2 registration-link clicks/);assert.equal(email.headers['List-Unsubscribe-Post'],'List-Unsubscribe=One-Click');assert.ok(!email.headers['List-Unsubscribe'].includes('owner@example.com'));assert.match(email.text,/https:\/\/littleherbplaces.com\/reports\/unsubscribe\?token=/);assert.match(email.headers['List-Unsubscribe'],/example.supabase.co\/functions\/v1\/activity-report-unsubscribe/);
 const escaped=activityReportEmail({...job,payload:{...job.payload,place_name:'<script>bad()</script>\nBcc: injected@example.com',items:[{title:'<img src=x>',kind:'offering_click',total:2}]}},config);
 assert.ok(!escaped.html.includes('<script>'));assert.ok(escaped.html.includes('&lt;img src=x&gt;'));assert.ok(!escaped.subject.includes('\n'));
 assert.throws(()=>activityReportEmail({...job,payload:{...job.payload,account_email:'x\nBcc: y'}},config));
 assert.throws(()=>activityReportEmail({...job,payload:{...job.payload,current:{profile_view:-1}}},config));
});
test('delivery rechecks consent before sending and keeps stable idempotency on retries',async()=>{
 for(const outcome of ['success','failure','stopped']){
  const calls=[];const requests=[];
  const database={rpc:async(name,args)=>{calls.push({name,args});return{data:name==='take_activity_email_reports'?[{id:job.id,lease_token:job.lease_token}]:name==='prepare_activity_email_report'?(outcome==='stopped'?null:job):null};}};
  const result=await dispatchActivityReports({...config,database,fetchImpl:async(url,options)=>{requests.push({url,options});return outcome==='failure'?new Response('',{status:503}):Response.json({id:'email-1'});}});
  assert.equal(calls[0].name,'enqueue_activity_email_reports');assert.equal(calls[2].name,'prepare_activity_email_report');
  if(outcome==='stopped'){assert.equal(requests.length,0);assert.equal(result.skipped,1);}else{assert.equal(requests[0].options.headers['Idempotency-Key'],'place-activity-report/report-1');assert.equal(calls.at(-1).args.p_email_id,outcome==='success'?'email-1':null);assert.equal(result.sent,outcome==='success'?1:0);}
 }
});
test('missing configuration and unauthorized scheduler requests do not lease or send reports',async()=>{
 let called=0;
 await assert.rejects(dispatchActivityReports({...config,from:'',database:{rpc:async()=>{called++;}}}));assert.equal(called,0);
 const handler=createActivityReportHandler({secret:'scheduler-secret',enabled:true,dispatch:async()=>{called++;return{sent:0,failed:0,skipped:0};}});
 assert.equal((await handler(new Request('https://example.test',{method:'POST'}))).status,401);assert.equal(called,0);
 assert.equal((await handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer scheduler-secret'},body:JSON.stringify({to:'attacker@example.com'})}))).status,200);assert.equal(called,1);
 const disabled=createActivityReportHandler({secret:'scheduler-secret',enabled:false,dispatch:async()=>{called++;}});assert.equal((await disabled(new Request('https://example.test',{method:'POST'}))).status,503);assert.equal(called,1);
});
test('unsubscribe links are safe for email scanners and only POST changes a preference',async()=>{
 const calls=[];const handler=createReportUnsubscribeHandler({siteUrl:'https://littleherbplaces.com',origins:['https://littleherbplaces.com'],unsubscribe:async value=>calls.push(value)});const url=`https://example.test/unsubscribe?token=${token}`;
 const landing=await handler(new Request(url));assert.equal(landing.status,303);assert.equal(landing.headers.get('Location'),`https://littleherbplaces.com/reports/unsubscribe?token=${token}`);assert.equal(calls.length,0);
 await handler(new Request(url,{method:'HEAD'}));assert.equal(calls.length,0);
 const blocked=await handler(new Request(url,{method:'POST',headers:{Origin:'https://untrusted.example'}}));assert.equal(blocked.status,403);assert.equal(calls.length,0);
 const preflight=await handler(new Request(url,{method:'OPTIONS',headers:{Origin:'https://littleherbplaces.com'}}));assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'https://littleherbplaces.com');
 assert.equal((await handler(new Request(url,{method:'POST',body:'List-Unsubscribe=One-Click'}))).status,200);assert.deepEqual(calls,[token]);
 assert.equal((await handler(new Request('https://example.test/unsubscribe?token=invalid',{method:'POST'}))).status,400);assert.equal(calls.length,1);
});
