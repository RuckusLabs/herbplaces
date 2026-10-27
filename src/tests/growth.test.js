import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyGrowth,prepareGrowth,publicGrowth,profileChecklist,activityCsv } from '../utilities/placeGrowth.js';
import { getBrowsePages } from '../utilities/browse.js';
import { openingHoursSchema } from '../utilities/openingHoursSchema.js';
import { discoveryItems,filterDiscovery } from '../utilities/discovery.js';
import { getDiscoverySeo } from '../utilities/seo.js';
import { renderRouteContent,renderSitemap,renderDiscoveryContent } from '../../scripts/seo/render.mjs';
import { directoryHash } from '../../scripts/seo/directory.mjs';
import { createPlaceActivityHandler } from '../../supabase/functions/_shared/placeActivity.js';

const places=Array.from({length:30},(_,i)=>({id:i+1,name:`Place ${i+1}`,urlSlug:`place-${i+1}`,city:i<3?'Denver':'Other City',state:i%2?'Colorado':'CO',category_ids:['shops'],photos:[]}));
test('browse pages link every listing and generate only collections with useful coverage',()=>{
  const pages=getBrowsePages(places);const global=pages.filter(page=>page.page);
  assert.equal(global.length,2);assert.equal(new Set(global.flatMap(page=>page.places.map(place=>place.id))).size,30);
  assert.equal(pages.filter(page=>page.path==='/browse/colorado/denver').length,1);
  assert.ok(pages.find(page=>page.path==='/browse/colorado/denver/herb-shops'));
  assert.ok(!getBrowsePages(places.slice(0,2)).some(page=>page.city));
  const html=renderRouteContent({path:'/browse'},places);
  assert.match(html,/href="\/browse\/page\/2\/"/);assert.match(renderSitemap(places),/browse\/colorado\/denver\/herb-shops/);
});
test('opening hours markup accepts explicit schedules and declines ambiguous or overlapping times',()=>{
  const hours=openingHoursSchema('Monday–Friday: 10 am–6 pm; Saturday: 09:00–14:00; Sunday: closed');
  assert.equal(hours.length,3);assert.equal(hours[0].dayOfWeek.length,5);assert.equal(hours[0].opens,'10:00');assert.equal(hours[0].closes,'18:00');assert.equal(hours[2].opens,'00:00');
  for(const value of ['Monday: 10–6','Monday: 25:00–28:00','Call ahead','Monday: 10 am–6 pm; Monday: 11 am–5 pm'])assert.deepEqual(openingHoursSchema(value),[]);
});
test('growth drafts validate links and date order and scheduled content expires without deleting it',()=>{
  const content=prepareGrowth({...emptyGrowth(),primary_action:{label:'Shop online',url:'example.com'},announcement:{title:'Seasonal tea',body:'Visit us.',url:'',code:'',starts_at:'2026-10-01T00:00:00Z',expires_at:'2026-11-01T00:00:00Z'}});
  assert.equal(content.primary_action.url,'https://example.com/');
  assert.equal(publicGrowth({content},Date.parse('2026-10-15')).announcement.title,'Seasonal tea');
  assert.equal(publicGrowth({content},Date.parse('2026-11-02')).announcement,null);
  assert.equal(content.announcement.title,'Seasonal tea');
  assert.throws(()=>prepareGrowth({...emptyGrowth(),primary_action:{label:'Shop online',url:'javascript:alert(1)'}}));
  assert.throws(()=>prepareGrowth({...emptyGrowth(),announcement:{title:'No expiry'}}));
  assert.equal(profileChecklist({},null).filter(item=>item.done).length,0);
  assert.ok(activityCsv({daily:[{day:'2026-10-27',profile_view:3}]}).includes('2026-10-27,3,0,0'));
});
test('offerings and event pages are searchable, exclude ended events, and escape their static content',()=>{
  const item={id:'20000000-0000-0000-0000-000000000001',kind:'service',title:'Tea consultation',description:'Learn about teas.',price:'Ask for pricing',url:'https://example.com/book',image:'',image_alt:''};
  const profile={place_id:'1',operating_status:'open',content:{...emptyGrowth(),specialties:['Tea'],offerings:[item],events:[{...item,id:'20000000-0000-0000-0000-000000000002',title:'Past event',starts_at:'2020-01-01T12:00:00Z',ends_at:'2020-01-01T13:00:00Z',timezone:'UTC'}]}};
  const items=discoveryItems(places,[profile]);assert.equal(items.length,1);
  assert.equal(filterDiscovery(items,'Denver tea','service').length,1);assert.equal(filterDiscovery(items,'','events').length,0);
  assert.equal(getDiscoverySeo(items[0]).structuredData['@graph'][0]['@type'],'Service');
  const html=renderDiscoveryContent(places,{...items[0],title:'<script>unsafe</script>'});assert.ok(!html.includes('<script>unsafe'));assert.match(html,/&lt;script&gt;/);
  const before=directoryHash([{...places[0],growth:profile}]);assert.notEqual(before,directoryHash([{...places[0],growth:{...profile,content:{...profile.content,offerings:[]}}}]));
});
test('public activity endpoint enforces origins, hashes IPs, honors DNT, and forwards no personal request data',async()=>{
  const records=[];let now=new Date('2026-10-27T12:00:00Z');
  const handler=createPlaceActivityHandler({origins:['https://littleherbplaces.com'],secret:'test-secret-with-at-least-32-characters',record:async value=>records.push(value),now:()=>now});
  const make=(headers={},body={})=>new Request('https://example.test/activity',{method:'POST',headers:{Origin:'https://littleherbplaces.com','x-forwarded-for':'192.0.2.1','Content-Type':'application/json',...headers},body:JSON.stringify({place_id:'1',kind:'profile_view',event_id:crypto.randomUUID(),...body})});
  assert.equal((await handler(make({Origin:'https://untrusted.test'}))).status,403);
  assert.equal((await handler(make({DNT:'1'}))).status,200);assert.equal(records.length,0);
  assert.equal((await handler(make())).status,200);assert.equal(records.length,1);assert.equal(records[0].p_visitor_hash.length,64);assert.ok(!JSON.stringify(records).includes('192.0.2.1'));
  now=new Date('2026-10-28T12:00:00Z');await handler(make());assert.notEqual(records[0].p_visitor_hash,records[1].p_visitor_hash);
  assert.equal((await handler(make({}, {kind:'invented',event_id:'bad'}))).status,400);
});
test('plan comparison preserves Sprout, Bloom, and Thrive and advertises growth tools only when enabled',()=>{
  const route={path:'/the-little-garden'};
  const disabled=renderRouteContent(route,[],{growthEnabled:false});
  const enabled=renderRouteContent(route,[],{growthEnabled:true,bloomAvailable:true});
  assert.match(enabled,/Create a Free Account/);assert.match(enabled,/30-day Activity Report and CSV/);assert.match(enabled,/Thrive is not available for purchase/);
  assert.ok(enabled.includes('Sprout'));assert.ok(!disabled.includes('30-day Activity Report and CSV'));
});
