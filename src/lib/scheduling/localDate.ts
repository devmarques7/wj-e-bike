/**
 * Timezone-safe day key.
 *
 * `toISOString()` converts to UTC first, so in any timezone east of UTC a local
 * midnight Date silently becomes the previous day — which made week grids query
 * (and match) the wrong dates and render every column at 0%.
 */
export const localYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const todayYmd = () => localYmd(new Date());

export default localYmd;
