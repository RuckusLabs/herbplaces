import { escapeHtml } from './render.mjs';

export function shareCardHtml(place, { photo, font, logo }) {
  const location = [place.city, place.state].filter(Boolean).join(', ');
  const subtitle = place.subtitle || location;
  const button = place.button || 'Explore This Little Place';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:Editorial;src:url('${font}') format('woff2');font-weight:200}
  *{box-sizing:border-box}body{margin:0;width:1200px;height:630px;background:#f7f9f1;color:#2c542f;font-family:Arial,sans-serif;overflow:hidden}
  .brand{position:absolute;top:40px;left:54px}.brand img{width:85px;height:69px}
  .copy{position:absolute;left:56px;top:150px;width:550px}
  h1{font-family:Editorial,Georgia,serif;font-size:70px;line-height:1.04;letter-spacing:-1.5px;font-weight:200;margin:0 0 22px;max-height:225px;overflow:hidden;overflow-wrap:anywhere}
  .location{margin:0;font-size:23px;line-height:1.35}.tagline{margin:17px 0 0;font-size:19px;line-height:1.5;color:#58734f;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:510px}
  .photo{position:absolute;right:40px;top:40px;width:490px;height:550px;object-fit:cover;border-radius:245px 245px 24px 24px;border:8px solid white}
  .footer{position:absolute;left:56px;bottom:44px}.cta{display:inline-flex;align-items:center;gap:18px;background:#eaff82;border-radius:36px;padding:18px 30px;font-size:21px;line-height:1.3;font-weight:600}.arrow{font-size:25px;font-weight:400}
  </style></head><body><div class="brand"><img src="${logo}" alt=""></div><div class="copy"><h1>${escapeHtml(place.name)}</h1>${subtitle ? `<p class="location">${escapeHtml(subtitle)}</p>` : ''}<p class="tagline">${escapeHtml(place.tagline || 'Independent places. Rooted in plants. Full of heart.')}</p></div><img class="photo" src="${photo}" alt=""><div class="footer"><span class="cta">${escapeHtml(button)}<span class="arrow">↗</span></span></div></body></html>`;
}
