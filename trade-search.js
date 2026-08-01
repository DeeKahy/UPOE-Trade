// Turns a parsed Path of Building item into an official trade site search.
// The trade site accepts a full query as a ?q= parameter, so no API POST and
// no rate limiting is involved.

const TradeSearch = {
  config: {
    STATS_URL: 'https://www.pathofexile.com/api/trade/data/stats',
    LEAGUES_URL: 'https://www.pathofexile.com/api/trade/data/leagues',
    TRADE_BASE: 'https://www.pathofexile.com/trade/search',
    STATS_CACHE_KEY: 'upoe-trade-stats',
    LEAGUES_CACHE_KEY: 'upoe-trade-leagues',
    CACHE_DURATION: 86400000 // 24 hours
  },

  // Which stat groups to try, in order, for a given kind of modifier
  LOOKUP_ORDER: {
    explicit: ['explicit', 'fractured', 'implicit', 'crafted', 'enchant'],
    implicit: ['implicit', 'explicit', 'enchant', 'fractured'],
    crafted: ['crafted', 'explicit', 'fractured', 'enchant'],
    fractured: ['fractured', 'explicit', 'crafted'],
    enchant: ['enchant', 'implicit', 'explicit']
  },

  // Listing types the trade site offers, straight from api/trade/data/filters
  STATUS_OPTIONS: [
    { id: 'available', text: 'Instant Buyout and In Person' },
    { id: 'securable', text: 'Instant Buyout' },
    { id: 'onlineleague', text: 'In Person (Online in League)' },
    { id: 'online', text: 'In Person (Online)' },
    { id: 'any', text: 'Any' }
  ],

  DEFAULT_STATUS: 'available',

  statIndex: null,
  leagues: null,

  // Builds the {group: {statText: statId}} lookup from the trade stats API.
  // Only this half is persisted, the loose lookup is derived from it on load.
  buildExactIndex(payload) {
    const exact = {};
    if (!payload || !Array.isArray(payload.result)) return exact;

    for (const group of payload.result) {
      if (!group.entries) continue;
      const bucket = {};

      for (const entry of group.entries) {
        // Option stats need a choice the item text does not carry
        if (entry.option) continue;

        // Some stats cover two printed lines, which PoB stores separately
        for (const line of entry.text.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !(trimmed in bucket)) bucket[trimmed] = entry.id;
        }
      }

      exact[group.id] = bucket;
    }

    return exact;
  },

  // Groups every stat text by its loose key so near misses can still resolve
  buildLooseIndex(exact) {
    const loose = {};

    for (const group of Object.keys(exact)) {
      const bucket = {};

      for (const text of Object.keys(exact[group])) {
        const key = this.toLooseKey(text);
        if (!key) continue;
        if (!bucket[key]) bucket[key] = [];
        if (bucket[key].length < 12) bucket[key].push({ id: exact[group][text], text: text });
      }

      loose[group] = bucket;
    }

    return loose;
  },

  buildStatIndex(payload) {
    const exact = this.buildExactIndex(payload);
    return { exact: exact, loose: this.buildLooseIndex(exact) };
  },

  // "+45 to maximum Life" becomes "+# to maximum Life"
  toStatKey(text) {
    return text.replace(/\d+(\.\d+)?/g, '#').trim();
  },

  // A deliberately lossy key that ignores numbers, case, punctuation, articles
  // and plurals, so "Projectiles Pierce an additional Target" lines up with
  // "Projectiles Pierce # additional Targets"
  toLooseKey(text) {
    const stripped = text
      .toLowerCase()
      .replace(/\(local\)/g, ' ')
      .replace(/-?\d+(\.\d+)?/g, ' ')
      .replace(/#/g, ' ')
      .replace(/[^a-z ]+/g, ' ');

    const words = [];
    for (const word of stripped.split(/\s+/)) {
      if (!word) continue;
      if (word === 'a' || word === 'an' || word === 'the') continue;
      if (word === 'are') { words.push('is'); continue; }
      words.push(word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word);
    }

    return words.join(' ');
  },

  firstValue(text) {
    const match = text.match(/-?\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : null;
  },

  // The trade site normalises several wordings that PoB keeps verbatim, so try
  // the obvious equivalents before falling back to a loose match
  statKeyCandidates(text) {
    const key = this.toStatKey(text);
    const candidates = [
      { key: key, negate: false },
      // Defence and weapon stats are suffixed on the trade site
      { key: key + ' (Local)', negate: false }
    ];

    if (key.startsWith('-')) {
      candidates.push({ key: '+' + key.slice(1), negate: false });
    }
    if (key.includes('reduced')) {
      candidates.push({ key: key.replace(/reduced/g, 'increased'), negate: true });
    }
    if (key.includes('less')) {
      candidates.push({ key: key.replace(/\bless\b/g, 'more'), negate: true });
    }
    if (key.includes('increased')) {
      candidates.push({ key: key.replace(/increased/g, 'reduced'), negate: true });
    }

    return candidates;
  },

  // Trade stat texts keep literal numbers for the parts that never roll, so a
  // candidate that matches those literals is a better hit than one that does not
  matchesLiterals(statText, modText) {
    const pattern = statText
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/#/g, '(-?\\d+(?:\\.\\d+)?)');

    try {
      return new RegExp('^' + pattern + '$', 'i').test(modText.trim());
    } catch (error) {
      return false;
    }
  },

  // Resolves one parsed modifier to a trade stat id plus a starting min value
  matchMod(index, mod, kind) {
    const groups = this.LOOKUP_ORDER[kind] || this.LOOKUP_ORDER.explicit;
    const value = this.firstValue(mod.text);
    const candidates = this.statKeyCandidates(mod.text);

    const result = (id, group, statText, negate) => {
      let min = value;
      if (min !== null && negate) min = -min;
      return { id: id, group: group, statText: statText, value: min };
    };

    for (const candidate of candidates) {
      for (const group of groups) {
        const bucket = index.exact[group];
        if (!bucket) continue;

        const id = bucket[candidate.key];
        if (id) return result(id, group, candidate.key, candidate.negate);
      }
    }

    const looseKey = this.toLooseKey(mod.text);
    if (!looseKey) return null;

    for (const group of groups) {
      const bucket = index.loose[group];
      if (!bucket || !bucket[looseKey]) continue;

      const entries = bucket[looseKey];
      const literalHit = entries.find(entry => this.matchesLiterals(entry.text, mod.text));

      // Without a literal hit only a stat that still has a rolling value is a
      // safe guess, otherwise "Has 2 Sockets" would land on "Has 1 Socket"
      const chosen = literalHit || entries.find(entry => entry.text.includes('#'));
      if (!chosen) continue;

      return result(chosen.id, group, chosen.text, false);
    }

    return null;
  },

  // Which lookup order applies to a modifier, based on its PoB tags
  modKind(mod, isImplicit) {
    if (mod.enchant) return 'enchant';
    if (mod.crafted) return 'crafted';
    if (mod.fractured) return 'fractured';
    return isImplicit ? 'implicit' : 'explicit';
  },

  // Produces the editable filter rows shown in the popup
  describeItem(index, item) {
    const rows = [];

    const collect = (mods, isImplicit) => {
      for (const mod of mods) {
        const kind = this.modKind(mod, isImplicit);
        const match = this.matchMod(index, mod, kind);

        rows.push({
          text: mod.text,
          kind: kind,
          implicit: isImplicit,
          stat: match,
          min: match ? match.value : null
        });
      }
    };

    collect(item.implicits, true);
    collect(item.explicits, false);

    return rows;
  },

  // PoB qualifies a few bases the trade site does not, such as
  // "Two-Stone Ring (Cold/Lightning)"
  toTradeType(baseType) {
    if (!baseType) return null;
    return baseType.replace(/\s*\([^)]*\)\s*$/, '').trim() || null;
  },

  normalizeStatus(status) {
    const known = this.STATUS_OPTIONS.some(option => option.id === status);
    return known ? status : this.DEFAULT_STATUS;
  },

  buildQuery(options) {
    const filters = [];
    const used = new Set();

    for (const row of options.rows || []) {
      if (!row.enabled || !row.stat) continue;

      // Two printed lines can resolve to the same stat, so only send it once
      if (used.has(row.stat.id)) continue;
      used.add(row.stat.id);

      const filter = { id: row.stat.id, disabled: false };
      if (row.min !== null && row.min !== undefined && !Number.isNaN(row.min)) {
        filter.value = { min: row.min };
      }

      filters.push(filter);
    }

    const query = {
      status: { option: this.normalizeStatus(options.status) },
      stats: [{ type: 'and', filters: filters }]
    };

    if (options.name) query.name = options.name;

    const type = this.toTradeType(options.type);
    if (type) query.type = type;

    if (options.corrupted === true || options.corrupted === false) {
      query.filters = {
        misc_filters: {
          filters: { corrupted: { option: String(options.corrupted) } }
        }
      };
    }

    return { query: query, sort: { price: 'asc' } };
  },

  buildUrl(league, payload) {
    const encodedLeague = encodeURIComponent(league);
    const encodedQuery = encodeURIComponent(JSON.stringify(payload));
    return `${this.config.TRADE_BASE}/${encodedLeague}?q=${encodedQuery}`;
  },

  // Fetches through the background script so the request is not blocked by
  // the page's own origin restrictions
  async fetchJson(url) {
    const response = await browser.runtime.sendMessage({ type: 'fetchTradeData', url: url });
    if (!response || !response.success) {
      throw new Error(response && response.error ? response.error : 'Request failed');
    }
    return response.data;
  },

  async readCache(key) {
    try {
      const stored = await browser.storage.local.get(key);
      const cached = stored[key];
      if (!cached) return null;
      if (Date.now() - cached.timestamp > this.config.CACHE_DURATION) return null;
      return cached.data;
    } catch (error) {
      return null;
    }
  },

  async writeCache(key, data) {
    try {
      await browser.storage.local.set({ [key]: { data: data, timestamp: Date.now() } });
    } catch (error) {
      console.warn('UPOE Trade Manager: could not cache', key, error);
    }
  },

  async getStatIndex() {
    if (this.statIndex) return this.statIndex;

    let exact = await this.readCache(this.config.STATS_CACHE_KEY);

    if (!exact || !exact.explicit) {
      const payload = await this.fetchJson(this.config.STATS_URL);
      exact = this.buildExactIndex(payload);
      await this.writeCache(this.config.STATS_CACHE_KEY, exact);
    }

    this.statIndex = { exact: exact, loose: this.buildLooseIndex(exact) };
    return this.statIndex;
  },

  async getLeagues() {
    if (this.leagues) return this.leagues;

    const cached = await this.readCache(this.config.LEAGUES_CACHE_KEY);
    if (cached) {
      this.leagues = cached;
      return this.leagues;
    }

    const payload = await this.fetchJson(this.config.LEAGUES_URL);
    const seen = new Set();
    const leagues = [];

    for (const league of (payload.result || [])) {
      if (league.realm && league.realm !== 'pc') continue;
      if (seen.has(league.id)) continue;
      seen.add(league.id);
      leagues.push(league.id);
    }

    this.leagues = leagues;
    await this.writeCache(this.config.LEAGUES_CACHE_KEY, leagues);

    return this.leagues;
  }
};

if (typeof window !== 'undefined') {
  window.TradeSearch = TradeSearch;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TradeSearch;
}
