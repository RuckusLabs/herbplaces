import { test,expect } from '@playwright/test';
import { Buffer } from 'node:buffer';

const photo='/assets/pages/home/hero.jpg';
const place={id:'10000000-0000-0000-0000-000000000001',name:'Moss Apothecary',urlSlug:'moss-apothecary',city:'Denver',state:'CO',address:'123 Main St',description:'Herbs, teas, and workshops.',website:'https://example.com/',coverPhoto:photo,photos:[photo],photo_alt:{[photo]:'Shelves of botanical tea jars'},category_ids:['shops'],is_claimed:true,content_version:1,hours:'Monday: 10 am–6 pm'};
const offering={id:'20000000-0000-0000-0000-000000000001',kind:'service',title:'Tea consultation',description:'Meet your herbalist.',price:'$60',url:'https://example.com/book',image:'',image_alt:''};
const event={...offering,id:'20000000-0000-0000-0000-000000000002',title:'Seasonal tea workshop',starts_at:'2099-10-27T18:00:00Z',ends_at:'2099-10-27T20:00:00Z',timezone:'America/Denver',location:'Our shop'};
const initial={primary_action:{label:'Shop online',url:'https://example.com/shop'},specialties:['Tea'],languages:'English',access_notes:'Step-free entrance.',announcement:{title:'Autumn blends',body:'Come explore.',url:'https://example.com/tea',code:'',starts_at:'',expires_at:'2099-01-01T00:00:00Z'},offerings:[offering],events:[event]};
async function site(page,{owner=false,paid=true}={}) {
  const state={profile:{place_id:place.id,place_slug:place.urlSlug,version:1,operating_status:'open',content:structuredClone(initial)},events:[],saved:null,essentials:null,preference:{enabled:false,eligible:paid,last_report:null}};
  const subscription={status:paid?'active':'none',paid_until:paid?new Date(Date.now()+86400000).toISOString():null};
  if(owner){const user={id:'00000000-0000-0000-0000-000000000001',email:'owner@example.com',email_confirmed_at:'2026-01-01',aud:'authenticated',app_metadata:{},user_metadata:{}};const expires_at=Math.floor(Date.now()/1000)+3600;const token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:user.id,exp:expires_at,role:'authenticated'})).toString('base64url')}.test`;const session={access_token:token,refresh_token:'test',token_type:'bearer',expires_at,expires_in:3600,user};await page.addInitScript(value=>localStorage.setItem('sb-127-auth-token',JSON.stringify(value)),session);await page.route('**/auth/v1/**',route=>route.fulfill({json:route.request().url().includes('/token')?session:user}));}
  await page.route('**/functions/v1/place-activity',route=>{state.events.push(route.request().postDataJSON());return route.fulfill({json:{accepted:true}});});
  await page.route('**/rest/v1/**',route=>{
    const path=new URL(route.request().url()).pathname;const name=path.split('/').at(-1);const body=route.request().postDataJSON()||{};
    if(name==='public_places')return route.fulfill({json:[place,{...place,id:'other-2',name:'Fern Garden',urlSlug:'fern-garden'},{...place,id:'other-3',name:'Willow Herbs',urlSlug:'willow-herbs'}]});
    if(name==='public_place_growth')return route.fulfill({json:[state.profile]});
    if(name==='get_management_context')return route.fulfill({json:{is_admin:false,memberships:owner?[{place_id:place.id,is_billing_contact:true,place,subscription,can_edit:paid}]:[],claims:[]}});
    if(name==='get_activity_email_preference')return route.fulfill({json:state.preference});
    if(name==='set_activity_email_preference'){if(state.preferenceError)return route.fulfill({status:503,json:{message:'Report preference could not be saved.'}});state.preference={...state.preference,enabled:body.p_enabled};return route.fulfill({json:state.preference});}
    if(name==='get_growth_access')return route.fulfill({json:{can_edit:paid,can_manage_offerings:paid,profile:state.profile}});
    if(name==='get_editable_place')return route.fulfill({json:place});
    if(name==='get_place_activity')return route.fulfill({json:{from:'2026-09-28',through:'2026-10-27',current:{profile_view:12,primary_click:3},previous:{profile_view:6},daily:[{day:'2026-10-27',profile_view:12}],items:[{kind:'offering_click',item_id:offering.id,total:2}]}});
    if(name==='publish_place_growth'){if(state.publishError)return route.fulfill({status:503,json:{message:'Publishing is unavailable. Please try again.'}});state.saved=body;state.profile={...state.profile,content:body.p_content,version:state.profile.version+1};return route.fulfill({json:state.profile});}
    if(name==='update_place_essentials'){state.essentials=body;return route.fulfill({json:{...place,...body.p_content,content_version:2}});}
    return route.fulfill({json:path.includes('/rpc/')?null:[]});
  });
  return state;
}

test('visitors discover searchable offerings and event pages with direct business actions',async({page})=>{
  await site(page);await page.goto('/discover');await expect(page.getByRole('link',{name:'Seasonal tea workshop',exact:true})).toBeVisible();
  await page.getByLabel('Kind of offering').selectOption('service');await expect(page.getByRole('link',{name:'Seasonal tea workshop',exact:true})).toHaveCount(0);
  await page.getByRole('link',{name:'Tea consultation',exact:true}).click();await expect(page.getByRole('heading',{name:'Tea consultation',level:1})).toBeVisible();
  await expect(page.getByRole('link',{name:/Learn More & Book/})).toHaveAttribute('href','https://example.com/book');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','index,follow');
});
test('owners can preview and publish highlights without recording their own profile views',async({page})=>{
  const state=await site(page,{owner:true});await page.goto('/place/moss-apothecary');await expect(page.getByText('Business tools & activity',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Your last 30 days'})).toBeVisible();await expect(page.getByRole('button',{name:'Download Daily Activity CSV'})).toBeVisible();
  await page.getByRole('button',{name:'Edit Business Highlights'}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Visitor Information',exact:true}).click();await dialog.getByLabel('Languages',{exact:true}).fill('English, Spanish');
  await dialog.getByRole('button',{name:'Preview Highlights'}).click();await expect(dialog).toHaveCount(0);await expect(page.getByRole('region',{name:'Visitor information',exact:true})).toContainText('English, Spanish');expect(state.saved).toBe(null);
  await page.getByRole('region',{name:'Unpublished Highlights Preview'}).getByRole('button',{name:'Publish Highlights'}).click();await expect(dialog).toHaveCount(0);expect(state.saved.p_content.languages).toBe('English, Spanish');expect(state.events.filter(event=>event.kind==='profile_view')).toHaveLength(0);
});
test('approved free managers can correct essential details and cannot edit paid highlights',async({page})=>{
  const state=await site(page,{owner:true,paid:false});await page.goto('/place/moss-apothecary');await expect(page.getByText('Business tools & activity',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Edit Business Highlights'})).toHaveCount(0);await page.getByRole('button',{name:'Correct Essential Details'}).click();
  const dialog=page.getByRole('dialog');await dialog.getByLabel('Phone',{exact:true}).fill('303-555-0123');await dialog.getByRole('button',{name:'Save Essential Details'}).click();await expect(dialog).toHaveCount(0);expect(state.essentials.p_content.phone).toBe('303-555-0123');
});
test('city collections and all-directory pages expose real links and fit narrow screens',async({page})=>{
  await site(page);await page.goto('/browse');await page.getByRole('link',{name:/Denver, Colorado/}).click();await expect(page.getByRole('heading',{level:1})).toContainText('Denver, Colorado');await expect(page.getByRole('link',{name:'Moss Apothecary',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('saved-place links keep a name at tablet widths and photo descriptions survive full view',async({page})=>{
  await site(page);await page.setViewportSize({width:950,height:800});await page.goto('/place/moss-apothecary');await expect(page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Saved Places',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'View Full Image',exact:true}).click();await expect(page.getByRole('dialog').getByRole('img',{name:'Shelves of botanical tea jars',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'View Full Image',exact:true})).toBeFocused();
});

test('monthly business report emails require opt-in and can be stopped independently of membership',async({page})=>{
 const state=await site(page,{owner:true});await page.goto('/place/moss-apothecary');await expect(page.getByText('Business tools & activity',{exact:true})).toBeVisible();
 const consent=page.getByRole('checkbox',{name:'Email me this place’s monthly activity report',exact:true});await expect(consent).not.toBeChecked();await consent.check();await expect(page.getByRole('status').filter({hasText:'Monthly reports are on'})).toBeVisible();expect(state.preference.enabled).toBe(true);
 await consent.uncheck();await expect(page.getByRole('status').filter({hasText:'Future monthly reports are off'})).toBeVisible();expect(state.preference.enabled).toBe(false);
 state.preferenceError=true;await consent.click();await expect(page.getByRole('alert')).toContainText('Report preference could not be saved.');await expect(consent).not.toBeChecked();
});

test('the plan comparison offers Bloom and free listings without signup or Thrive links',async({page})=>{
 await site(page);await page.goto('/the-little-garden');
 await expect(page.getByRole('heading',{name:'Bloom',exact:true,level:3})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Business Listing',exact:true,level:3})).toBeVisible();
 await expect(page.locator('a[href*="/thrive"], a[href*="/register"], a[href*="/sprout"]')).toHaveCount(0);
});

test('report unsubscribe is scanner-safe, works signed out, and retries a failed confirmation',async({page})=>{
 await site(page);const requests=[];let fail=true;
 await page.route('**/functions/v1/activity-report-unsubscribe?token=*',route=>{requests.push(route.request().method());return route.fulfill({status:fail?503:200,body:'Report preference updated.'});});
 await page.goto('/reports/unsubscribe?token=20000000-0000-0000-0000-000000000001');
 await expect(page.getByRole('heading',{name:'Stop monthly reports?',exact:true})).toBeVisible();expect(requests).toEqual([]);await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex,nofollow');
 await page.getByRole('button',{name:'Stop Monthly Reports',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Please try again');
 fail=false;await page.getByRole('button',{name:'Stop Monthly Reports',exact:true}).click();await expect(page.getByRole('heading',{name:'Monthly reports stopped.',exact:true})).toBeVisible();expect(requests).toEqual(['POST','POST']);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('invalid report links do not offer an unsubscribe action',async({page})=>{
 await site(page);await page.goto('/reports/unsubscribe?token=invalid');await expect(page.getByRole('alert')).toContainText('This report link is not valid.');await expect(page.getByRole('button',{name:'Stop Monthly Reports',exact:true})).toHaveCount(0);
});

test('report advice opens the relevant announcement field and setup is visible without expanding tools',async({page})=>{
  const state=await site(page,{owner:true});state.profile.content.announcement.expires_at='2020-01-01T00:00:00Z';
  await page.goto('/place/moss-apothecary');
  await expect(page.getByRole('region',{name:'Profile setup checklist'})).toBeVisible();
  await page.getByRole('button',{name:'Refresh Your Announcement',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Title',{exact:true}).first()).toBeFocused();
});

test('report action links preserve the requested edit across sign-in',async({page})=>{
  await site(page);await page.goto('/place/moss-apothecary?business=announcement');
  await expect(page.getByRole('link',{name:'Sign in to open your business tools',exact:true})).toHaveAttribute('href','/login?next=%2Fplace%2Fmoss-apothecary%3Fbusiness%3Dannouncement');
  await expect(page.getByRole('button',{name:'Publish Highlights',exact:true})).toHaveCount(0);
});


test('profile setup opens the description and photo editor directly',async({page})=>{
  await site(page,{owner:true});await page.goto('/place/moss-apothecary');
  await page.getByRole('link',{name:'Edit Description & Photos',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('textbox',{name:'Description',exact:true})).toHaveValue('Herbs, teas, and workshops.');
});

test('highlight sections keep drafts while products and events open individually',async({page},testInfo)=>{
  const state=await site(page,{owner:true});await page.goto('/place/moss-apothecary');
  await page.getByRole('button',{name:'Edit Business Highlights'}).click();const dialog=page.getByRole('dialog');
  await expect(dialog.getByLabel('Languages',{exact:true})).toHaveCount(0);
  await dialog.getByRole('button',{name:'Visitor Information',exact:true}).click();
  await dialog.getByLabel('Languages',{exact:true}).fill('English, Spanish');
  await dialog.getByRole('button',{name:'Products & Services 1',exact:true}).click();
  await expect(dialog.getByLabel('Shopping or booking link',{exact:true})).toHaveCount(0);
  await dialog.getByRole('button',{name:/Tea consultation.*Edit/}).click();
  await dialog.getByLabel('Title',{exact:true}).fill('Personal tea consultation');
  await dialog.getByRole('button',{name:'Workshops & Events 1',exact:true}).click();
  await expect(dialog.getByRole('button',{name:/Seasonal tea workshop.*Edit/})).toBeVisible();
  await expect(dialog.getByLabel('Registration link',{exact:true})).toHaveCount(0);
  await dialog.getByRole('button',{name:'Visitor Information',exact:true}).click();
  await expect(dialog.getByLabel('Languages',{exact:true})).toHaveValue('English, Spanish');
  expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('focused-highlights-editor.png'),animations:'disabled'});
  await dialog.getByRole('button',{name:'Publish Highlights'}).click();
  await expect(dialog).toHaveCount(0);expect(state.saved.p_content.offerings[0].title).toBe('Personal tea consultation');
  expect(state.saved.p_content.languages).toBe('English, Spanish');
});

test('invalid items reveal their section before publishing and preserve other edits',async({page})=>{
  const state=await site(page,{owner:true});await page.goto('/place/moss-apothecary');
  await page.getByRole('button',{name:'Edit Business Highlights'}).click();const dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:'Products & Services 1',exact:true}).click();
  await dialog.getByRole('button',{name:'Add Offering',exact:true}).click();
  await dialog.getByLabel('Title',{exact:true}).fill('New seasonal tea');
  await dialog.getByRole('button',{name:'Main Action',exact:true}).click();
  await dialog.getByRole('button',{name:'Publish Highlights',exact:true}).click();
  await expect(dialog.getByRole('alert')).toContainText('Add a booking, registration, or shopping link');
  await expect(dialog.getByLabel('Title',{exact:true})).toHaveValue('New seasonal tea');
  expect(state.saved).toBe(null);
  await dialog.getByLabel('Shopping or booking link',{exact:true}).fill('https://example.com/tea');
  await dialog.getByRole('button',{name:'Preview Highlights',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('region',{name:'Products and services',exact:true})).toContainText('New seasonal tea');
  await page.getByRole('button',{name:'Back to Editing',exact:true}).click();
  await expect(dialog.getByLabel('Title',{exact:true})).toHaveValue('New seasonal tea');
});

test('highlights preview replaces page content and keeps its toolbar below navigation while scrolling',async({page},testInfo)=>{
  const state=await site(page,{owner:true});await page.goto('/place/moss-apothecary');
  await page.getByRole('button',{name:'Edit Business Highlights'}).click();const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Destination link',{exact:true}).fill('https://example.com/new-shop');
  await dialog.getByRole('button',{name:'Preview Highlights',exact:true}).click();
  const toolbar=page.getByRole('region',{name:'Unpublished Highlights Preview'});
  await expect(toolbar).toBeVisible();await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('link',{name:/Shop online/})).toHaveAttribute('href','https://example.com/new-shop');
  await expect(page.getByRole('button',{name:'Edit Business Highlights',exact:true})).toHaveCount(0);
  expect(state.saved).toBe(null);
  await page.evaluate(()=>window.scrollTo(0,1000));
  const navBox=await page.getByRole('navigation',{name:'Main navigation',exact:true}).boundingBox();
  const barBox=await toolbar.boundingBox();
  expect(Math.abs(navBox.y)).toBeLessThanOrEqual(1);expect(Math.abs(barBox.y-navBox.height)).toBeLessThanOrEqual(1);
  await page.screenshot({path:testInfo.outputPath('on-page-highlights-preview.png'),animations:'disabled'});
  await toolbar.getByRole('button',{name:'Back to Editing',exact:true}).click();
  await expect(dialog.getByLabel('Destination link',{exact:true})).toHaveValue('https://example.com/new-shop');
  await dialog.getByRole('button',{name:'Preview Highlights',exact:true}).click();
  await toolbar.getByRole('button',{name:'Discard Changes',exact:true}).click();
  await expect(toolbar).toHaveCount(0);await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('link',{name:/Shop online/})).toHaveAttribute('href','https://example.com/shop');
  expect(state.saved).toBe(null);expect(state.events.filter(event=>event.kind==='profile_view')).toHaveLength(0);
  expect(await page.evaluate(()=>document.body.classList.contains('has-growth-preview'))).toBe(false);
});

test('publishing failure retains the private page preview and allows retry',async({page})=>{
  const state=await site(page,{owner:true});await page.goto('/place/moss-apothecary');
  await page.getByRole('button',{name:'Edit Business Highlights'}).click();const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Destination link',{exact:true}).fill('https://example.com/new-shop');
  await dialog.getByRole('button',{name:'Preview Highlights',exact:true}).click();
  const toolbar=page.getByRole('region',{name:'Unpublished Highlights Preview'});
  state.publishError=true;await toolbar.getByRole('button',{name:'Publish Highlights',exact:true}).click();
  await expect(toolbar.getByRole('alert')).toContainText('Publishing is unavailable');
  await expect(page.getByRole('link',{name:/Shop online/})).toHaveAttribute('href','https://example.com/new-shop');
  expect(state.saved).toBe(null);state.publishError=false;
  await toolbar.getByRole('button',{name:'Publish Highlights',exact:true}).click();
  await expect(toolbar).toHaveCount(0);expect(state.saved.p_content.primary_action.url).toBe('https://example.com/new-shop');
});

test('leaving a private highlights preview clears the toolbar and never carries drafts to another listing',async({page})=>{
  const state=await site(page,{owner:true});await page.goto('/place/moss-apothecary');
  await page.getByRole('button',{name:'Edit Business Highlights'}).click();const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Destination link',{exact:true}).fill('https://example.com/private-draft');
  await dialog.getByRole('button',{name:'Preview Highlights',exact:true}).click();
  await page.getByRole('link',{name:'Explore Places',exact:true}).first().click();
  await expect(page.getByRole('region',{name:'Unpublished Highlights Preview'})).toHaveCount(0);
  expect(await page.evaluate(()=>document.body.classList.contains('has-growth-preview'))).toBe(false);
  await page.goto('/place/moss-apothecary');
  await expect(page.getByRole('link',{name:/Shop online/})).toHaveAttribute('href','https://example.com/shop');
  expect(state.saved).toBe(null);
});

test('listing highlights follow the gallery and story and share the existing visit sidebar',async({page,isMobile},testInfo)=>{
  const state=await site(page);
  state.profile.content.offerings=[{...offering,image:photo,image_alt:'Botanical shop shelves'}, {...offering,id:crypto.randomUUID(),title:'Seasonal Tea Collection',kind:'product',price:'From $18',image:'',description:'Small-batch blends for everyday rituals.'}];
  await page.goto('/place/moss-apothecary');
  const gallery=page.getByRole('region',{name:'Photos of Moss Apothecary',exact:true});
  const products=page.getByRole('region',{name:'Products and services',exact:true});
  const events=page.getByRole('region',{name:'Upcoming workshops and events',exact:true});
  const visit=page.getByRole('complementary',{name:'Plan a Little Visit.',exact:true});
  await expect(visit.getByRole('region',{name:'Visitor information',exact:true})).toContainText('English');
  const galleryBox=await gallery.boundingBox();const productsBox=await products.boundingBox();const visitBox=await visit.boundingBox();
  expect(galleryBox.y+galleryBox.height).toBeLessThan(productsBox.y);
  if(isMobile)expect(visitBox.y+visitBox.height).toBeLessThan(productsBox.y);
  else expect(productsBox.x+productsBox.width).toBeLessThanOrEqual(visitBox.x);
  await expect(products.getByRole('link',{name:/Learn More & Book/})).not.toHaveClass(/button/);
  await expect(events.getByRole('time')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('integrated-listing-highlights.png'),fullPage:true,animations:'disabled'});
});
