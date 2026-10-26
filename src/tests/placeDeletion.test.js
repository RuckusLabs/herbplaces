import test from 'node:test';
import assert from 'node:assert/strict';
import { storedImage, placeDeletionAssets, cleanupPlaceImages, assertPlaceBillingResolved } from '../../supabase/functions/_shared/placeDeletion.js';
const origin='https://test.supabase.co';
test('deletion includes owned current/history/imported images and skips shared, external, and brand assets', () => {
  const url = path => `${origin}/storage/v1/object/public/${path}`;
  const result=placeDeletionAssets({urls:[url('places/cover.jpg'),url('place-photos/1/old.jpg'),url('places/shared.jpg'),'https://external.example/picture.jpg',url('brand-assets/logo.png')],other_urls:[url('places/shared.jpg')],folder_assets:[{bucket:'place-photos',path:'1/unpublished.jpg'}]},origin);
  assert.deepEqual(result.assets,[{bucket:'places',path:'cover.jpg'},{bucket:'place-photos',path:'1/old.jpg'},{bucket:'place-photos',path:'1/unpublished.jpg'}]);
  assert.equal(result.sharedCount,1);
  assert.equal(storedImage(url('place-photos/%2e%2e/x.jpg'),origin),null);
  assert.equal(storedImage('https://other.supabase.co/storage/v1/object/public/places/cover.jpg',origin),null);
});
test('storage cleanup batches real deletes and leaves failures retryable', async () => {
  const calls=[];
  const storage={from:bucket=>({remove:async paths=>{calls.push({bucket,paths});return {error:null};}})};
  await cleanupPlaceImages(storage,Array.from({length:205},(_,i)=>({bucket:'place-photos',path:`1/${i}.jpg`})));
  assert.deepEqual(calls.map(call=>call.paths.length),[100,100,5]);
  await assert.rejects(cleanupPlaceImages({from:()=>({remove:async()=>({error:new Error('offline')})})},[{bucket:'places',path:'old.jpg'}]),/retrying/);
});
test('deletion checks actual subscriptions beyond page one and refuses active or unverified billing', async () => {
  const base={status:'canceled',stripe_customer_id:'cus_1',stripe_subscription_id:'sub_old'};
  const stripe={subscriptions:{retrieve:async()=>({id:'sub_old',status:'canceled'}),list:async params=>params.starting_after?{data:[{id:'sub_new',status:'active'}],has_more:false}:{data:[{id:'sub_old',status:'canceled'}],has_more:true}}};
  await assert.rejects(assertPlaceBillingResolved(stripe,base),/Resolve the subscription/);
  await assert.rejects(assertPlaceBillingResolved(null,{status:'active'}),/Resolve the subscription/);
  await assert.rejects(assertPlaceBillingResolved(null,{status:'none',checkout_expires_at:new Date(Date.now()+60000).toISOString()}),/Checkout is being prepared/);
  await assert.rejects(assertPlaceBillingResolved({subscriptions:{retrieve:async()=>{throw new Error('Stripe unavailable');}}},{status:'canceled',stripe_subscription_id:'sub_old'}),/Stripe unavailable/);
});
test('resolved billing passes, but open checkout and asynchronous payment processing block deletion', async () => {
  const stripe={subscriptions:{list:async()=>({data:[],has_more:false})},checkout:{sessions:{list:async params=>({data:params.status==='open'?[{id:'cs_open'}]:[],has_more:false}),retrieve:async()=>({status:'complete',payment_status:'unpaid'})}}};
  await assert.rejects(assertPlaceBillingResolved(stripe,{status:'none',stripe_customer_id:'cus_1'}),/open checkout/);
  await assert.rejects(assertPlaceBillingResolved(stripe,{status:'none',checkout_session_id:'cs_waiting'}),/still processing/);
  await assertPlaceBillingResolved(null,{status:'none'});
});
