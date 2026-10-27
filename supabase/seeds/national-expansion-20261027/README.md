# National expansion — October 27, 2026

116 newly verified public places bring the directory from 71 to 187 places across 50 states. The batch includes 140 reviewed photographs; 1 profile has no suitable photo and uses the existing hidden-gallery behavior.

This is editorial data and provenance. The original publication is recorded in receipt.json, with additions and photo updates in separate second-pass receipts; merging this PR does not execute the import. Existing application behavior, billing settings, ownership, and badges are unchanged.

## Verification

- Each profile has a current operator-confirmed visitor address, with source links and qualified access/hours notes. Online-only, stale, conflicting, and transient leads are documented separately in excluded.json.
- 113 locations use exact US Census street/address matches with matching state and ZIP; three exceptions use New Jersey and Delaware government address points and Chicago municipal business-license coordinates. Gaia’s point identifies its parent building; the public address retains unit B. The Chicago point identifies the exact business address and is not claimed to be survey-grade.
- Reviewed photographs show actual shops, named staff, gardens, or products. Brand products may be shared across that brand’s branches, with truthful product alt text. Unidentified branch interiors, generic stock, logos, illustrations, advertising graphics, and inaccessible/undersized files were rejected.
- Image provenance, local WebP dimensions, and SHA-256 checksums are recorded per profile. Source attribution does not grant a reuse license.
- The importer previews by default, requires a total of at least 150 profiles, checks duplicate names/addresses/slugs, privately backs up existing records, uploads immutable photo paths, verifies delivered checksums, inserts the batch once, and checks every existing row is unchanged.

## Reproduction

```sh
python3 scripts/geocode-national-expansion.py
node scripts/seed-national-expansion.mjs
python3 scripts/build-national-expansion-review.py
```

The follow-up publication uses `node scripts/seed-national-expansion.mjs --followup --apply`; original receipts are preserved. Photo updates use `node scripts/apply-national-expansion-photo-followup.mjs --apply`, restricted to the fifteen original gaps. Native portrait photos meet the same orientation-independent minimum (short side 200px, long side 300px) without upscaling. It requires configured Supabase CLI access; credentials remain in memory and are never committed. The preview should propose zero new profiles after publication. Government-address exceptions are preserved in reviewed-locations.json instead of inventing Census matches.

## Profiles

| Place | City | State | Photos |
| --- | --- | --- | --- |
| [The Green Lass Apothecary & Tea Shop](https://littleherbplaces.com/place/the-green-lass-apothecary-tea-shop/) | Huntsville | Alabama | 1 |
| [The Mercantile Apothecary](https://littleherbplaces.com/place/the-mercantile-apothecary/) | Stevenson | Alabama | 1 |
| [All About Herbs](https://littleherbplaces.com/place/all-about-herbs/) | Wasilla | Alaska | 1 |
| [Into the Wilds Apothecary](https://littleherbplaces.com/place/into-the-wilds-apothecary/) | Ozark | Arkansas | 1 |
| [Lhasa Karnak Herb Company - San Pablo](https://littleherbplaces.com/place/lhasa-karnak-herb-company-san-pablo/) | Berkeley | California | 1 |
| [Lhasa Karnak Herb Company - Shattuck](https://littleherbplaces.com/place/lhasa-karnak-herb-company-shattuck/) | Berkeley | California | 1 |
| [Herban Myth Apothecary at Chico Holistic Wellness Center](https://littleherbplaces.com/place/herban-myth-apothecary-at-chico-holistic-wellness-center/) | Chico | California | 1 |
| [Pilar’s Wellness Collective Apothecary](https://littleherbplaces.com/place/pilar-s-wellness-collective-apothecary/) | Costa Mesa | California | 1 |
| [Green Wisdom Herbal Studies](https://littleherbplaces.com/place/green-wisdom-herbal-studies/) | Long Beach | California | 1 |
| [Dragon Herbs Herbal Emporium and Elixir Bar](https://littleherbplaces.com/place/dragon-herbs-herbal-emporium-and-elixir-bar/) | Los Angeles | California | 1 |
| [The Herbal Ritual Apothecary and Pharmacy](https://littleherbplaces.com/place/the-herbal-ritual-apothecary-and-pharmacy/) | Oakland | California | 1 |
| [Mountain Rose Herbs Mercantile - Palm Springs](https://littleherbplaces.com/place/mountain-rose-herbs-mercantile-palm-springs/) | Palm Springs | California | 1 |
| [Rosemary’s Garden](https://littleherbplaces.com/place/rosemary-s-garden/) | Sebastopol | California | 1 |
| [Wildcraft Herb Shoppe](https://littleherbplaces.com/place/wildcraft-herb-shoppe/) | East Hampton | Connecticut | 2 |
| [Euphoric Herbals Apothecary - Milford](https://littleherbplaces.com/place/euphoric-herbals-apothecary-milford/) | Milford | Delaware | 1 |
| [Gaia Emporium](https://littleherbplaces.com/place/gaia-emporium/) | Newark | Delaware | 1 |
| [A Thousand Leaves Community Apothecary](https://littleherbplaces.com/place/a-thousand-leaves-community-apothecary/) | Gainesville | Florida | 2 |
| [The Herb Shop at Cypress Pillar Healing Arts](https://littleherbplaces.com/place/the-herb-shop-at-cypress-pillar-healing-arts/) | Sarasota | Florida | 2 |
| [Healing Waters Clinic & Herb Shop](https://littleherbplaces.com/place/healing-waters-clinic-herb-shop/) | St. Augustine | Florida | 1 |
| [The Herb Shop of Vinings](https://littleherbplaces.com/place/the-herb-shop-of-vinings/) | Atlanta | Georgia | 1 |
| [Kauai Farmacy](https://littleherbplaces.com/place/kauai-farmacy/) | Kilauea | Hawaii | 1 |
| [Dragon’s Den Herb Shop](https://littleherbplaces.com/place/dragon-s-den-herb-shop/) | Makawao | Hawaii | 1 |
| [Alkaline Healing Herbs - Division](https://littleherbplaces.com/place/alkaline-healing-herbs-division/) | Chicago | Illinois | 1 |
| [Alkaline Healing Herbs - Elston](https://littleherbplaces.com/place/alkaline-healing-herbs-elston/) | Chicago | Illinois | 1 |
| [DMApothecary at Mella’Ninn Complex](https://littleherbplaces.com/place/dmapothecary-at-mella-ninn-complex/) | Chicago | Illinois | 1 |
| [Herb Stone](https://littleherbplaces.com/place/herb-stone/) | Chicago | Illinois | 1 |
| [Hoa My Chinese Medicine](https://littleherbplaces.com/place/hoa-my-chinese-medicine/) | Chicago | Illinois | 1 |
| [Lisa Herbal Corporation](https://littleherbplaces.com/place/lisa-herbal-corporation/) | Chicago | Illinois | 0 |
| [Merz Apothecary](https://littleherbplaces.com/place/merz-apothecary/) | Chicago | Illinois | 1 |
| [The Spice Shack](https://littleherbplaces.com/place/the-spice-shack/) | Grabill | Indiana | 1 |
| [Good Earth Natural Food Co.](https://littleherbplaces.com/place/good-earth-natural-food-co/) | Indianapolis | Indiana | 1 |
| [Little Woods Herbal](https://littleherbplaces.com/place/little-woods-herbal/) | Ames | Iowa | 1 |
| [Holistic Harmony](https://littleherbplaces.com/place/holistic-harmony/) | Clear Lake | Iowa | 1 |
| [Flourish Herbals & Aromatherapy](https://littleherbplaces.com/place/flourish-herbals-aromatherapy/) | Garden City | Kansas | 1 |
| [Leaf & Stone Apothecary](https://littleherbplaces.com/place/leaf-stone-apothecary/) | Wichita | Kansas | 1 |
| [Wild Thyme Herbal Apothecary](https://littleherbplaces.com/place/wild-thyme-herbal-apothecary/) | Bardstown | Kentucky | 1 |
| [Miss Anne’s Maypop Herb Shop](https://littleherbplaces.com/place/miss-anne-s-maypop-herb-shop/) | New Orleans | Louisiana | 1 |
| [Green Oaks Apothecary](https://littleherbplaces.com/place/green-oaks-apothecary/) | Slidell | Louisiana | 2 |
| [Greenwood Herbals](https://littleherbplaces.com/place/greenwood-herbals/) | Limerick | Maine | 2 |
| [Homegrown Herb & Tea](https://littleherbplaces.com/place/homegrown-herb-tea/) | Portland | Maine | 1 |
| [Village Green Apothecary](https://littleherbplaces.com/place/village-green-apothecary/) | Bethesda | Maryland | 1 |
| [Red Antler Apothecary — Lowell](https://littleherbplaces.com/place/red-antler-apothecary-lowell/) | Lowell | Massachusetts | 1 |
| [Red Antler Apothecary — Salem](https://littleherbplaces.com/place/red-antler-apothecary-salem/) | Salem | Massachusetts | 1 |
| [Alternatives For Health Herbal Apothecary](https://littleherbplaces.com/place/alternatives-for-health-herbal-apothecary/) | Sturbridge | Massachusetts | 1 |
| [Perry’s Place](https://littleherbplaces.com/place/perry-s-place/) | Cedar Springs | Michigan | 1 |
| [Those Nature People Herb Haus - Davison](https://littleherbplaces.com/place/those-nature-people-herb-haus-davison/) | Davison | Michigan | 1 |
| [Hawthorn & Violet Herbal Apothecary](https://littleherbplaces.com/place/hawthorn-violet-herbal-apothecary/) | Fenton | Michigan | 1 |
| [Those Nature People Herb Haus - Flint](https://littleherbplaces.com/place/those-nature-people-herb-haus-flint/) | Flint | Michigan | 1 |
| [Those Nature People Herb Haus - Frankenmuth](https://littleherbplaces.com/place/those-nature-people-herb-haus-frankenmuth/) | Frankenmuth | Michigan | 1 |
| [Gathered Botanicals](https://littleherbplaces.com/place/gathered-botanicals/) | Grand Rapids | Michigan | 2 |
| [Bloodroot Herb Shop](https://littleherbplaces.com/place/bloodroot-herb-shop/) | Ypsilanti | Michigan | 2 |
| [Jewelweed](https://littleherbplaces.com/place/jewelweed/) | Excelsior | Minnesota | 2 |
| [Lakota Made](https://littleherbplaces.com/place/lakota-made/) | Mankato | Minnesota | 1 |
| [Magus Books and Herbs](https://littleherbplaces.com/place/magus-books-and-herbs/) | Minneapolis | Minnesota | 1 |
| [Present Moment Herbs & Books](https://littleherbplaces.com/place/present-moment-herbs-books/) | Minneapolis | Minnesota | 1 |
| [Mother’s Natchez](https://littleherbplaces.com/place/mother-s-natchez/) | Natchez | Mississippi | 1 |
| [Clary & Sage Apothecary](https://littleherbplaces.com/place/clary-sage-apothecary/) | Ocean Springs | Mississippi | 2 |
| [CW Organics Herbal Apothecary](https://littleherbplaces.com/place/cw-organics-herbal-apothecary/) | Ridgeland | Mississippi | 1 |
| [Centered Spirit Apothecary & Emilie’s French Teas](https://littleherbplaces.com/place/centered-spirit-apothecary-emilie-s-french-teas/) | Kansas City | Missouri | 1 |
| [Phoenix Herb](https://littleherbplaces.com/place/phoenix-herb/) | Kansas City | Missouri | 1 |
| [Cheryl’s Herbs](https://littleherbplaces.com/place/cheryl-s-herbs/) | Maplewood | Missouri | 1 |
| [STL Herbs and Aromatics](https://littleherbplaces.com/place/stl-herbs-and-aromatics/) | Maplewood | Missouri | 1 |
| [Prairie Star Botanicals](https://littleherbplaces.com/place/prairie-star-botanicals/) | Blair | Nebraska | 1 |
| [Bentley’s Apothecary](https://littleherbplaces.com/place/bentley-s-apothecary/) | Fremont | Nebraska | 2 |
| [Herbally Grounded - Eastern](https://littleherbplaces.com/place/herbally-grounded-eastern/) | Henderson | Nevada | 1 |
| [Herbally Grounded - Charleston](https://littleherbplaces.com/place/herbally-grounded-charleston/) | Las Vegas | Nevada | 1 |
| [The Herbal Path — Dover](https://littleherbplaces.com/place/the-herbal-path-dover/) | Dover | New Hampshire | 1 |
| [Spirit Wise Herbs & Magick](https://littleherbplaces.com/place/spirit-wise-herbs-magick/) | Portsmouth | New Hampshire | 2 |
| [The Herbal Path — Portsmouth](https://littleherbplaces.com/place/the-herbal-path-portsmouth/) | Portsmouth | New Hampshire | 2 |
| [Herbal Root Organics](https://littleherbplaces.com/place/herbal-root-organics/) | Boonton | New Jersey | 1 |
| [Raine n River Apothecary](https://littleherbplaces.com/place/raine-n-river-apothecary/) | Jersey City | New Jersey | 2 |
| [Integrative Herbalism](https://littleherbplaces.com/place/integrative-herbalism/) | Kinnelon | New Jersey | 2 |
| [Herbalist & Alchemist Retail Store](https://littleherbplaces.com/place/herbalist-alchemist-retail-store/) | Washington | New Jersey | 1 |
| [Old Town Herbal](https://littleherbplaces.com/place/old-town-herbal/) | Albuquerque | New Mexico | 1 |
| [Rosemary’s Herb Shop](https://littleherbplaces.com/place/rosemary-s-herb-shop/) | Ruidoso | New Mexico | 1 |
| [Milagro Herbs](https://littleherbplaces.com/place/milagro-herbs/) | Santa Fe | New Mexico | 1 |
| [Anima Mundi Apothecary — Brooklyn](https://littleherbplaces.com/place/anima-mundi-apothecary-brooklyn/) | Brooklyn | New York | 2 |
| [Remedies Herb Shop — Brooklyn](https://littleherbplaces.com/place/remedies-herb-shop-brooklyn/) | Brooklyn | New York | 1 |
| [Flower Power Herbs & Roots — East Village](https://littleherbplaces.com/place/flower-power-herbs-roots-east-village/) | New York | New York | 1 |
| [The Alchemist’s Kitchen](https://littleherbplaces.com/place/the-alchemist-s-kitchen/) | New York | New York | 1 |
| [Flower Power Herbs & Roots — Piermont](https://littleherbplaces.com/place/flower-power-herbs-roots-piermont/) | Piermont | New York | 1 |
| [Apothecary of Knightdale](https://littleherbplaces.com/place/apothecary-of-knightdale/) | Knightdale | North Carolina | 1 |
| [Earth Heart Health Food Store](https://littleherbplaces.com/place/earth-heart-health-food-store/) | Marion | North Carolina | 1 |
| [Terry’s Health Products](https://littleherbplaces.com/place/terry-s-health-products/) | Bismarck | North Dakota | 1 |
| [Spirit Apothecary Botanicals & Findings](https://littleherbplaces.com/place/spirit-apothecary-botanicals-findings/) | Bedford | Ohio | 1 |
| [Clintonville Natural Foods](https://littleherbplaces.com/place/clintonville-natural-foods/) | Columbus | Ohio | 1 |
| [Earthley Wellness - Columbus Store](https://littleherbplaces.com/place/earthley-wellness-columbus-store/) | Columbus | Ohio | 2 |
| [Melanated Ancestral Collective](https://littleherbplaces.com/place/melanated-ancestral-collective/) | Lawton | Oklahoma | 1 |
| [Dorothy’s Herb Shop & Herbal Apothecary](https://littleherbplaces.com/place/dorothy-s-herb-shop-herbal-apothecary/) | Butler | Pennsylvania | 1 |
| [Bluestem Botanicals](https://littleherbplaces.com/place/bluestem-botanicals/) | Doylestown | Pennsylvania | 1 |
| [The Rosemary House & Gardens](https://littleherbplaces.com/place/the-rosemary-house-gardens/) | Mechanicsburg | Pennsylvania | 1 |
| [Penn Herb Company — Factory Store](https://littleherbplaces.com/place/penn-herb-company-factory-store/) | Philadelphia | Pennsylvania | 1 |
| [Penn Herb Company — Flagship Store](https://littleherbplaces.com/place/penn-herb-company-flagship-store/) | Philadelphia | Pennsylvania | 1 |
| [Herbs and Mylk](https://littleherbplaces.com/place/herbs-and-mylk/) | North Kingstown | Rhode Island | 1 |
| [Herbal Passion](https://littleherbplaces.com/place/herbal-passion/) | Charleston | South Carolina | 2 |
| [The Herb Room Organic Apothecary](https://littleherbplaces.com/place/the-herb-room-organic-apothecary/) | Hilton Head Island | South Carolina | 1 |
| [Baldflower Apothecary](https://littleherbplaces.com/place/baldflower-apothecary/) | Spartanburg | South Carolina | 2 |
| [Juniper Apothecary](https://littleherbplaces.com/place/juniper-apothecary/) | Sioux Falls | South Dakota | 2 |
| [Synergy Herbal Works — Cookeville](https://littleherbplaces.com/place/synergy-herbal-works-cookeville/) | Cookeville | Tennessee | 2 |
| [Hummingbird Apothecary — North Knoxville](https://littleherbplaces.com/place/hummingbird-apothecary-north-knoxville/) | Knoxville | Tennessee | 2 |
| [Hummingbird Apothecary — South Knoxville](https://littleherbplaces.com/place/hummingbird-apothecary-south-knoxville/) | Knoxville | Tennessee | 2 |
| [KindFolk Apothecary + Wellness](https://littleherbplaces.com/place/kindfolk-apothecary-wellness/) | Cedar Park | Texas | 2 |
| [Sacred Moon Herbs](https://littleherbplaces.com/place/sacred-moon-herbs/) | Dripping Springs | Texas | 2 |
| [The Gathering Place](https://littleherbplaces.com/place/the-gathering-place/) | Seguin | Texas | 1 |
| [Angie’s Gardens Apothecary](https://littleherbplaces.com/place/angie-s-gardens-apothecary/) | Tomball | Texas | 1 |
| [Natural Law Apothecary](https://littleherbplaces.com/place/natural-law-apothecary/) | Salt Lake City | Utah | 1 |
| [Grian Herbs Apothecary](https://littleherbplaces.com/place/grian-herbs-apothecary/) | Montpelier | Vermont | 1 |
| [Forrest Green Farm](https://littleherbplaces.com/place/forrest-green-farm/) | Louisa | Virginia | 1 |
| [Mountain Rose Herbs Mercantile - Seattle](https://littleherbplaces.com/place/mountain-rose-herbs-mercantile-seattle/) | Seattle | Washington | 1 |
| [Wild Ginger & Spice](https://littleherbplaces.com/place/wild-ginger-spice/) | Davis | West Virginia | 1 |
| [Tonic Herb Shop](https://littleherbplaces.com/place/tonic-herb-shop/) | Shepherdstown | West Virginia | 1 |
| [Aurora’s Apothecary - Appleton](https://littleherbplaces.com/place/aurora-s-apothecary-appleton/) | Appleton | Wisconsin | 1 |
| [Aurora’s Apothecary - Fond du Lac](https://littleherbplaces.com/place/aurora-s-apothecary-fond-du-lac/) | Fond du Lac | Wisconsin | 1 |
| [Aurora’s Apothecary - Green Bay](https://littleherbplaces.com/place/aurora-s-apothecary-green-bay/) | Green Bay | Wisconsin | 1 |
| [Topaz Apothecary & Collective](https://littleherbplaces.com/place/topaz-apothecary-collective/) | Waukesha | Wisconsin | 2 |
| [Enchantment Creek Apothecary](https://littleherbplaces.com/place/enchantment-creek-apothecary/) | Powell | Wyoming | 1 |

## Photo gaps

The public image viewer is hidden for these profiles.

- Lisa Herbal Corporation

## State coverage added

Alabama, Alaska, Arkansas, Connecticut, Delaware, Hawaii, Illinois, Indiana, Iowa, Kansas, Kentucky, Louisiana, Maine, Michigan, Minnesota, Mississippi, Missouri, Nebraska, Nevada, New Hampshire, North Dakota, Ohio, Oklahoma, Rhode Island, South Carolina, South Dakota, Utah, West Virginia, Wisconsin, Wyoming
