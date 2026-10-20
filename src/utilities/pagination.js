export const PLACES_PER_PAGE = 15;

export function paginatePlaces(items, value) {
  const pageCount = Math.max(1, Math.ceil(items.length / PLACES_PER_PAGE));
  const requested = Number(value);
  const page = Math.min(pageCount, Number.isSafeInteger(requested) && requested > 0 ? requested : 1);
  const offset = (page - 1) * PLACES_PER_PAGE;
  return { items: items.slice(offset, offset + PLACES_PER_PAGE), page, pageCount, total: items.length,
    start: items.length ? offset + 1 : 0, end: Math.min(offset + PLACES_PER_PAGE, items.length) };
}
