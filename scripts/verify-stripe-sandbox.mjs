// Opt-in hosted sandbox check. Uses disposable fixtures and an isolated checkout
// endpoint; public BLOOM_ENABLED is never changed. No provider keys are printed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

process.umask(0o077);
const project = 'qtpepsebztlremlhpxdt';
const base = 'supabase/.temp/stripe-sandbox';
const stateFile = `${base}/state.json`;
const functionName = 'bloom-sandbox-verification';
const config = fs.readFileSync('.env.local', 'utf8');
const setting = name => config.match(new RegExp(`^${name}\\s*=\\s*['\"]?([^\\s'\"]+)`, 'm'))?.[1];
const url = setting('VITE_SUPABASE_URL');
assert.equal(new URL(url).hostname, `${project}.supabase.co`);
const anonKey = setting('VITE_SUPABASE_ANON_KEY');
const cli = args => execFileSync('supabase', args, {encoding:'utf8',stdio:['ignore','pipe','pipe']});
const keys = JSON.parse(cli(['projects','api-keys','--project-ref',project,'--reveal','--output','json']));
const serviceKey = keys.find(key => key.name === 'service_role')?.api_key;
assert.ok(serviceKey);
const options = {auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Origin:'http://127.0.0.1:5181'},fetch:(input,init)=>fetch(input,{...init,signal:init?.signal||AbortSignal.timeout(45000)})}};
const service = createClient(url,serviceKey,options);
const value = async request => { const {data,error} = await request; if(error) throw Error(error.message); return data; };
const save = state => fs.writeFileSync(stateFile,JSON.stringify(state,null,2),{mode:0o600});
const query = sql => JSON.parse(cli(['db','query','--linked','--project-ref',project,'--output','json',sql])).rows;
let state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile,'utf8')) : null;
async function customer() {
  const client = createClient(url,anonKey,options);
  await value(client.auth.setSession(state.session));
  return client;
}
async function action(name) {
  const client = await customer();
  const response = await client.functions.invoke(functionName,{body:{action:name,place_id:String(state.placeId)}});
  if (response.error) { let detail=''; try {detail=(await response.error.context.json()).error||'';} catch {} throw Error(detail||response.error.message); }
  const result = response.data;
  state.session = (await value(client.auth.getSession())).session; save(state);
  return result;
}
try {
  const step = process.argv[2];
  if(step==='setup') {
    assert.ok(!state,'Clean up the previous sandbox fixture first.');
    const active = query("select count(*) as count from pg_trigger where tgname in ('dispatch_claim_notification','dispatch_customer_notification') and tgenabled <> 'D'")[0];
    assert.equal(active.count,0,'Email dispatch must be off for hosted fixtures.');
    const secrets = JSON.parse(cli(['secrets','list','--project-ref',project,'--output','json']));
    assert.ok(secrets.some(item=>item.name==='STRIPE_SECRET_KEY'),'Add the restricted sandbox key first.');
    assert.equal(secrets.find(item=>item.name==='BLOOM_ENABLED')?.value,crypto.createHash('sha256').update('false').digest('hex'),'Public checkout must stay disabled.');
    fs.mkdirSync(base,{recursive:true});
    state={users:[],suffix:crypto.randomUUID()};save(state);
    const password=crypto.randomBytes(30).toString('base64url')+'Aa1!';
    const admin = createClient(url,anonKey,options);
    const manager = createClient(url,anonKey,options);
    for(const [role,client] of [['admin',admin],['manager',manager]]) {
      const email=`bloom-${role}-${state.suffix}@herbplaces.test`;
      const {user}=await value(service.auth.admin.createUser({email,password,email_confirm:true}));
      state.users.push(user.id);save(state);
      await value(client.auth.signInWithPassword({email,password}));
      if(role==='admin') await value(service.from('site_admins').insert({user_id:user.id}));
      else {state.managerId=user.id;state.session=(await value(client.auth.getSession())).session;save(state);}
    }
    state.content={name:`Temporary Bloom Sandbox ${state.suffix}`,tagline:'Sandbox payment verification',description:'Temporary fixture, removed after payment verification.',city:'Denver',state:'CO',address:'',zip:'',website:'',phone:'',hours:'',photos:[],coverPhoto:'',photo_alt:{},category_ids:[],social_links:[]};
    const place=await value(admin.rpc('admin_create_place',{p_request_id:state.suffix,p_slug:`sandbox-bloom-${state.suffix}`,p_content:state.content}));
    state.placeId=place.id;save(state);
    await value(manager.rpc('request_place_claim',{p_place_id:String(place.id),p_relationship:'Sandbox test owner',p_evidence:'Disposable payment lifecycle verification.'}));
    const context=await value(manager.rpc('get_management_context'));
    const claim=context.claims.find(item=>String(item.place_id)===String(place.id));
    await value(admin.rpc('admin_review_claim',{p_claim_id:claim.id,p_approve:true,p_note:'Disposable sandbox verification fixture.'}));
    assert.ok((await manager.rpc('get_editable_place',{p_place_id:String(place.id)})).error,'Unpaid owner must not edit.');
    const workspace=`${base}/workspace`;
    fs.mkdirSync(`${workspace}/supabase/functions/${functionName}`,{recursive:true});
    fs.cpSync('supabase/functions/_shared',`${workspace}/supabase/functions/_shared`,{recursive:true});
    let source=fs.readFileSync('supabase/functions/place-management/index.ts','utf8');
    source=source.replace('const user = await authenticated(req, db);',`const user = await authenticated(req, db);\n    if (user.id !== ${JSON.stringify(state.managerId)} || !/^(rk|sk)_test_/.test(required('STRIPE_SECRET_KEY'))) return json({error:'Sandbox fixture only.'},403,headers);`);
    source=source.replace("if (!placeId || placeId.length > 100)",`if (placeId !== ${JSON.stringify(String(place.id))})`);
    source=source.replace("if (Deno.env.get('BLOOM_ENABLED') !== 'true')",'if (false)');
    source=source.replace('    const billingAction',"    if (action === 'probe') {\n      const stripe = stripeClient();\n      const probes = {\n        prices: () => stripe.prices.retrieve(required('STRIPE_BLOOM_PRICE_ID')),\n        products: () => stripe.products.retrieve('prod_VU02O5KvcPuKrF'),\n        customers: () => stripe.customers.list({limit:1}),\n        subscriptions: () => stripe.subscriptions.list({limit:1}),\n        invoices: () => stripe.invoices.list({limit:1}),\n        portal: () => stripe.billingPortal.configurations.list({limit:1}),\n      };\n      const results = {};\n      for (const [name, probe] of Object.entries(probes)) {\n        try { await probe(); results[name] = 'ok'; }\n        catch (error) { results[name] = String(error.message).replace(/(?:rk|sk|pk)_(?:test|live)_[^'\\s]+/g,'[redacted key]'); }\n      }\n      return json(results,200,headers);\n    }\n"+'    const billingAction');
    source=source.replace("safe ? message : 'Unable to complete this request. Please try again or contact Little Herb Places.'", "message.replace(/(?:rk|sk|pk)_(?:test|live)_[^'\\s]+/g,'[redacted key]')");
    fs.writeFileSync(`${workspace}/supabase/functions/${functionName}/index.ts`,source);
    fs.writeFileSync(`${workspace}/supabase/config.toml`,`project_id = "${project}"\n[functions.${functionName}]\nverify_jwt = false\n`);
    cli(['functions','deploy',functionName,'--workdir',path.resolve(workspace),'--project-ref',project,'--no-verify-jwt','--use-api']);
    state.deployed=true;save(state);
    console.log(JSON.stringify({pass:'Unpaid ownership cannot edit; isolated fixture endpoint deployed',place_id:place.id}));
  } else if(step==='probe') {
    console.log(JSON.stringify(await action('probe')));
  } else if(step==='checkout') {
    const first=await action('checkout'); const second=await action('checkout');
    assert.equal(first.url,second.url,'Duplicate checkout must reuse the open session.');
    assert.equal(new URL(first.url).hostname,'checkout.stripe.com');
    state.checkoutUrl=first.url;save(state);
    console.log(JSON.stringify({pass:'Sandbox key, price validation, customer creation, checkout creation and retry reuse',checkout_url:first.url}));
  } else if(step==='status') {
    const record=await value(service.from('place_subscriptions').select('status,paid_until,grace_until,cancel_at_period_end,stripe_customer_id,stripe_subscription_id,checkout_session_id').eq('place_id',state.placeId).single());
    state.billing=record;save(state);
    console.log(JSON.stringify(record));
  } else if(step==='publish') {
    const client=await customer();
    const fresh=await value(client.rpc('get_editable_place',{p_place_id:String(state.placeId)}));
    const published=await value(client.rpc('publish_place',{p_place_id:String(state.placeId),p_content:{...state.content,tagline:'Published by the paid sandbox owner'},p_expected_version:fresh.content_version}));
    assert.equal(published.tagline,'Published by the paid sandbox owner');
    console.log('PASS Real paid owner can edit and publish');
  } else if(step==='deny-edit') {
    const client=await customer();assert.ok((await client.rpc('get_editable_place',{p_place_id:String(state.placeId)})).error);
    console.log('PASS Canceled/expired subscription cannot edit');
  } else if(step==='portal') {
    const result=await action('portal');state.portalUrl=result.url;save(state);console.log(JSON.stringify({portal_url:result.url}));
  } else if(step==='sync') {
    console.log(JSON.stringify(await action('sync-billing')));
  } else if(step==='cleanup') {
    assert.ok(state);
    const record=state.placeId?await value(service.from('place_subscriptions').select('status,stripe_subscription_id').eq('place_id',state.placeId).maybeSingle()):null;
    assert.ok(!record?.stripe_subscription_id || ['canceled','incomplete_expired'].includes(record.status),'Cancel the Stripe test subscription before removing its database fixture.');
    if(state.deployed) cli(['functions','delete',functionName,'--project-ref',project,'--yes']);
    if(state.placeId) {await value(service.from('management_audit').delete().eq('place_id',String(state.placeId)));await value(service.from('places').delete().eq('id',state.placeId));}
    if(state.users.length) await value(service.from('management_audit').delete().in('actor_id',state.users));
    for(const id of state.users) await value(service.auth.admin.deleteUser(id));
    fs.renameSync(stateFile,`${base}/completed-${state.suffix}.json`);
    // Retain IDs as a cleanup receipt, without account tokens or Checkout URLs.
    fs.writeFileSync(`${base}/completed-${state.suffix}.json`,JSON.stringify({place_id:state.placeId,users_removed:state.users.length,subscription_id:record?.stripe_subscription_id,completed_at:new Date().toISOString()}));
    console.log('PASS Temporary function, listing, claims, queued messages, and accounts removed');
  } else throw Error('Use setup, probe, checkout, status, publish, deny-edit, portal, sync, or cleanup.');
} catch(error) {
  console.error('Sandbox verification stopped:',error instanceof assert.AssertionError?error.message:(error.message||'Unknown failure'));
  if(state?.placeId) console.error('Fixture retained for retry/cleanup:',state.placeId);
  process.exitCode=1;
}
