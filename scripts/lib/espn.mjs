/**
 * ESPN adapter — cookie-authenticated fetches against the private league
 * (league 201), plus the paged kona_player_info universe with the seen-ID
 * repeat-page guard. Cookie handling, user-agent and paging lived in five
 * script copies before this; two of them could loop forever if ESPN regressed
 * to repeated pages.
 */

const LEAGUE_API = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba';

export function espnClient({
  espnS2 = process.env.ESPN_S2,
  espnSwid = process.env.ESPN_SWID,
} = {}) {
  if (!espnS2 || !espnSwid) throw new Error('Missing ESPN_S2 / ESPN_SWID env vars.');
  const cookie = `espn_s2=${espnS2}; SWID=${espnSwid};`;

  async function fetchJson(url, { timeoutMs = 30000, extraHeaders = {} } = {}) {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Cookie: cookie, ...extraHeaders },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 401) {
        throw new Error(
          `ESPN API 401: ${body.slice(0, 200)}\nCookies expired or invalid. Re-grab espn_s2/SWID from a logged-in browser.`,
        );
      }
      throw new Error(`ESPN API ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json();
  }

  return {
    fetchJson,

    /** League payload with the given views (e.g. mTeam + mRoster). */
    async league(season, views, { leagueId = 201 } = {}) {
      const query = views.map((v) => `view=${v}`).join('&');
      return fetchJson(`${LEAGUE_API}/seasons/${season}/segments/0/leagues/${leagueId}?${query}`);
    },

    /**
     * Page the full player universe via kona_player_info. The players filter
     * must go in the X-Fantasy-Filter header (the query-param form silently
     * ignores `offset`), and ESPN requires an explicit sort with limit/offset.
     * A seen-ID guard stops paging even if ESPN regresses to repeated pages.
     */
    async allPlayers(season, { leagueId = 201, page = 50, log = () => {} } = {}) {
      const seen = new Set();
      const all = [];
      for (let offset = 0; ; offset += page) {
        const filter = JSON.stringify({
          players: { limit: page, offset, sortStatId: { sortPriority: 1, sortAsc: true, value: 0 } },
        });
        const json = await fetchJson(
          `${LEAGUE_API}/seasons/${season}/segments/0/leagues/${leagueId}?view=kona_player_info`,
          { extraHeaders: { 'X-Fantasy-Filter': filter } },
        );
        if (json.messages?.length) {
          throw new Error(`ESPN filter rejected (offset ${offset}): ${json.messages.join('; ')}`);
        }
        const players = json.players ?? [];
        const fresh = players.filter((w) => w.player?.id && !seen.has(String(w.player.id)));
        for (const w of fresh) seen.add(String(w.player.id));
        all.push(...fresh);
        log(`  fetched offset ${offset}: ${players.length} players, ${fresh.length} new (total ${all.length})`);
        if (players.length < page || fresh.length === 0) break;
      }
      return all;
    },
  };
}
