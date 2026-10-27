import test from 'node:test';
import assert from 'node:assert/strict';
import {listingTrafficUrl,fetchListingTraffic} from '../../supabase/functions/_shared/simpleAnalytics.js';
test('Simple Analytics queries use exact listing paths, UTC completed dates, and API version 6',()=>{
 const url=listingTrafficUrl({slug:'moss-apothecary',start:'2026-09-01',endExclusive:'2026-10-01'});assert.equal(url.origin,'https://simpleanalytics.com');assert.equal(url.searchParams.get('pages'),'/place/moss-apothecary,/place/moss-apothecary/');assert.equal(url.searchParams.get('end'),'2026-09-30');assert.equal(url.searchParams.get('version'),'6');assert.equal(url.searchParams.get('timezone'),'UTC');
 for(const slug of ['*','../admin','moss,other',''])assert.throws(()=>listingTrafficUrl({slug,start:'2026-09-01',endExclusive:'2026-10-01'}));
});
test('Simple Analytics keys remain in headers and only validated scoped statistics leave the adapter',async()=>{
 let request;const result=await fetchListingTraffic({apiKey:'sa_api_key_test',slug:'moss-apothecary',start:'2026-09-01',endExclusive:'2026-10-01',fetchImpl:async(url,options)=>{request={url,options};return Response.json({pageviews:42,referrers:[{value:'google.com',pageviews:10},{value:'bad',pageviews:'invalid'}],account:'must-not-return',internal:'must-not-return'});}});
 assert.equal(request.options.headers['Api-Key'],'sa_api_key_test');assert.ok(!request.url.includes('sa_api_key'));assert.equal(result.pageviews,42);assert.deepEqual(result.referrers,[{name:'google.com',pageviews:10}]);assert.ok(!JSON.stringify(result).includes('must-not-return'));
});
test('Simple Analytics authentication and unavailable data are not reported as zero traffic',async()=>{
 for(const response of [new Response('',{status:401}),Response.json({ok:false,error:'plan'}),Response.json({})])await assert.rejects(fetchListingTraffic({apiKey:'sa_api_key_test',slug:'moss',start:'2026-09-01',endExclusive:'2026-10-01',fetchImpl:async()=>response}));
 await assert.rejects(fetchListingTraffic({apiKey:'',slug:'moss',start:'2026-09-01',endExclusive:'2026-10-01'}));
});
