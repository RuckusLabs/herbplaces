// Explicit integration check. Only creates/removes uniquely named disposable
// listings, images, and accounts. No existing customer listing is selected.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
if (!process.argv.includes('--run')) throw new Error('Pass --run to create disposable deletion fixtures.');
const project='qtpepsebztlremlhpxdt';
const env=fs.readFileSync('.env.local','utf8');
const setting=name=>env.match(new RegExp(`^${name}\\s*=\\s*['\"]?([^\\s'\"]+)`,'m'))?.[1];
const url=setting('VITE_SUPABASE_URL');
assert.equal(new URL(url).hostname,`${project}.supabase.co`);
const keys=JSON.parse(execFileSync('supabase',['projects','api-keys','--project-ref',project,'--reveal','--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const key=(Array.isArray(keys)?keys:keys.api_keys||keys.keys||keys.data||[]).find(item=>item.name==='service_role')?.api_key;
assert.ok(key);
const options={auth:{persistSession:false,autoRefreshToken:false}};
const service=createClient(url,key,options);
const client=createClient(url,setting('VITE_SUPABASE_ANON_KEY'),options);
const quote=value=>`'${String(value).replaceAll("'","''")}'`;
const query=sql=>JSON.parse(execFileSync('supabase',['db','query','--linked','--output','json',sql],{encoding:'utf8',stdio:['ignore','pipe','pipe']})).rows;
const suffix=crypto.randomUUID(); const slug=`codex-delete-check-${suffix}`; const sharedSlug=`${slug}-shared`;
const users=[]; const fixtures=[]; const assets=[];
const baseline=query("select (select count(*) from public.places) as places,(select count(*) from storage.objects) as images")[0];
async function checked(result){if(result.error)throw new Error(result.error.code||'Fixture operation failed');return result.data;}
async function request(action,id,confirmation,token){const response=await fetch(`${url}/functions/v1/admin-places`,{method:'POST',headers:{Origin:'http://localhost:5181',Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({action,place_id:String(id),...(confirmation?{slug:confirmation}:{})})});return {status:response.status,data:await response.json()};}
async function upload(bucket,path){await checked(await service.storage.from(bucket).upload(path,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC1sAAAAASUVORK5CYII=','base64'),{contentType:'image/png',upsert:false,cacheControl:'0'}));assets.push({bucket,path});return service.storage.from(bucket).getPublicUrl(path).data.publicUrl;}
let passed=false;
try{
 const password=crypto.randomBytes(32).toString('base64url'); const email=`delete-check-${suffix}@example.invalid`;
 const created=await checked(await service.auth.admin.createUser({email,password,email_confirm:true})); users.push(created.user.id);
 query(`insert into public.site_admins(user_id) values(${quote(created.user.id)})`);
 const auth=await checked(await client.auth.signInWithPassword({email,password}));const token=auth.session.access_token;
 const content={name:'Disposable deletion check',tagline:'',description:'Disposable content',website:'',address:'',city:'Test',state:'',zip:'',phone:'',hours:'',social_links:[],category_ids:[],photos:[],coverPhoto:'',photo_alt:{}};
 query(`do $$ declare p jsonb; begin perform set_config('request.jwt.claim.sub',${quote(created.user.id)},true); p:=public.admin_create_place(${quote(JSON.stringify(content))}::jsonb,${quote(slug)},${quote(crypto.randomUUID())}); update public.places set geocode_status='confirmed' where id::text=p->>'id'; p:=public.admin_create_place(${quote(JSON.stringify({...content,name:'Disposable shared image check'}))}::jsonb,${quote(sharedSlug)},${quote(crypto.randomUUID())}); update public.places set geocode_status='confirmed' where id::text=p->>'id'; end $$;`);
 const rows=query(`select id::text as id,"urlSlug" as slug from public.places where "urlSlug" in (${quote(slug)},${quote(sharedSlug)})`);fixtures.push(...rows);
 const target=rows.find(item=>item.slug===slug);const other=rows.find(item=>item.slug===sharedSlug);assert.ok(target&&other);
 const cover=await upload('places',`${slug}/cover.png`);const shared=await upload('places',`${slug}/shared.png`);
 const old=await upload('place-photos',`editorial/${slug}/old.png`);const current=await upload('place-photos',`${target.id}/${suffix}.png`);await upload('place-photos',`${target.id}/${suffix}-orphan.png`);
 query(`update public.places p set "coverPhoto"=${quote(cover)},photos=(jsonb_populate_record(p,jsonb_build_object('photos',jsonb_build_array(${quote(current)},${quote(shared)})))).photos where id::text=${quote(target.id)};
 update public.places p set "coverPhoto"=${quote(shared)} where id::text=${quote(other.id)};
 insert into public.place_revisions(place_id,version,content) select id,0,jsonb_build_object('name','Deleted historical content','photos',jsonb_build_array(${quote(old)})) from public.places where id::text=${quote(target.id)};
 insert into public.place_uploads(path,place_id,url) select ${quote(`${target.id}/${suffix}.png`)},id,${quote(current)} from public.places where id::text=${quote(target.id)};
 insert into public.favorites(user_id,item_id,item_type) values(${quote(created.user.id)},${quote(target.id)},'place');`);
 const preview=await request('preview',target.id,null,token);assert.equal(preview.status,200);assert.equal(preview.data.image_count,4);assert.ok(preview.data.shared_images>0);
 const wrong=await request('delete',target.id,'wrong-slug',token);assert.equal(wrong.status,400);
 query(`update public.place_subscriptions set status='active' where place_id::text=${quote(target.id)}`);
 const billing=await request('delete',target.id,slug,token);assert.equal(billing.status,400);assert.match(billing.data.error,/subscription/);
 query(`update public.place_subscriptions set status='none' where place_id::text=${quote(target.id)}`);
 const removed=await request('delete',target.id,slug,token);assert.equal(removed.status,200);assert.equal(removed.data.removed,true);
 const audit=query(`select (select count(*) from public.places where id::text=${quote(target.id)}) as places,(select count(*) from public.place_revisions where place_id::text=${quote(target.id)}) as revisions,(select count(*) from public.place_uploads where place_id::text=${quote(target.id)}) as uploads,(select count(*) from public.favorites where item_type='place' and item_id=${quote(target.id)}) as favorites,(select count(*) from storage.objects where (bucket_id='places' and name in (${quote(`${slug}/cover.png`)})) or (bucket_id='place-photos' and (name like ${quote(`${target.id}/%`)} or name=${quote(`editorial/${slug}/old.png`)}))) as images`)[0];
 assert.deepEqual(audit,{places:0,revisions:0,uploads:0,favorites:0,images:0});
 assert.equal(query(`select count(*) as count from storage.objects where bucket_id='places' and name=${quote(`${slug}/shared.png`)}`)[0].count,1);
 const repeat=await request('delete',target.id,slug,token);assert.equal(repeat.data.removed,true);
 const removedOther=await request('delete',other.id,sharedSlug,token);assert.equal(removedOther.data.removed,true);
 passed=true;
}catch(error){console.error('Disposable deletion verification failed:',error.code||error.name||'check failed');process.exitCode=1;}
finally{
 // Cleanup is restricted to exact fixture IDs and unique fixture slugs.
 for(const fixture of fixtures){query(`delete from public.places where id::text=${quote(fixture.id)} and "urlSlug"=${quote(fixture.slug)}; delete from place_management_private.place_deletions where place_id=${quote(fixture.id)} and slug=${quote(fixture.slug)};`);}
 for(const bucket of ['places','place-photos']){const paths=assets.filter(asset=>asset.bucket===bucket).map(asset=>asset.path);if(paths.length)await checked(await service.storage.from(bucket).remove(paths));}
 for(const id of users)await checked(await service.auth.admin.deleteUser(id));
 const after=query("select (select count(*) from public.places) as places,(select count(*) from storage.objects) as images")[0];
 assert.deepEqual(after,baseline,'Fixture cleanup changed the original directory/image counts');
 console.log(JSON.stringify({passed,original_directory_preserved:true,real_storage_deletion_verified:passed,shared_image_preservation_verified:passed,billing_guard_verified:passed,repeat_request_verified:passed,fixture_accounts_removed:users.length}));
}
