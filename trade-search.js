// Turns a parsed build item into an official trade site search.
// The trade site accepts a full query as a ?q= parameter, so no API POST and
// no rate limiting is involved.
//
// The job this file really does is narrowing. A build item carries its exact
// rolls, and searching for those verbatim returns nothing, because nobody is
// selling that item. So the mods are rewritten into the filters the trade site
// actually indexes: life and resistances roll up into pseudo totals, local
// defence mods drop out because the property filters already cover them, and
// every remaining roll is relaxed to a share of its value.

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
    enchant: ['enchant', 'implicit', 'explicit'],
    scourge: ['scourge', 'explicit', 'implicit']
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

  // Anything below this and the search stops resembling the item. Anything
  // above and it returns nothing. 80 is the point most build items still find
  // real listings at.
  DEFAULT_MIN_PERCENT: 80,

  // Pseudo stat ids, verified against api/trade/data/stats
  PSEUDO: {
    life: { id: 'pseudo.pseudo_total_life', label: 'total maximum Life' },
    mana: { id: 'pseudo.pseudo_total_mana', label: 'total maximum Mana' },
    energyShield: { id: 'pseudo.pseudo_total_energy_shield', label: 'total maximum Energy Shield' },
    fire: { id: 'pseudo.pseudo_total_fire_resistance', label: 'total to Fire Resistance' },
    cold: { id: 'pseudo.pseudo_total_cold_resistance', label: 'total to Cold Resistance' },
    lightning: { id: 'pseudo.pseudo_total_lightning_resistance', label: 'total to Lightning Resistance' },
    chaos: { id: 'pseudo.pseudo_total_chaos_resistance', label: 'total to Chaos Resistance' },
    elemental: { id: 'pseudo.pseudo_total_elemental_resistance', label: 'total Elemental Resistance' },
    strength: { id: 'pseudo.pseudo_total_strength', label: 'total to Strength' },
    dexterity: { id: 'pseudo.pseudo_total_dexterity', label: 'total to Dexterity' },
    intelligence: { id: 'pseudo.pseudo_total_intelligence', label: 'total to Intelligence' }
  },

  // Each rule maps a normalised mod line onto the pseudo totals it feeds.
  // Ten strength is five life on the trade site, hence the 0.5 weights.
  PSEUDO_RULES: [
    { key: '+# to maximum Life', parts: { life: 1 } },
    { key: '+# to maximum Mana', parts: { mana: 1 } },
    { key: '+# to maximum Energy Shield', parts: { energyShield: 1 } },

    { key: '+#% to Fire Resistance', parts: { fire: 1 } },
    { key: '+#% to Cold Resistance', parts: { cold: 1 } },
    { key: '+#% to Lightning Resistance', parts: { lightning: 1 } },
    { key: '+#% to Chaos Resistance', parts: { chaos: 1 } },

    { key: '+#% to Fire and Cold Resistances', parts: { fire: 1, cold: 1 } },
    { key: '+#% to Fire and Lightning Resistances', parts: { fire: 1, lightning: 1 } },
    { key: '+#% to Cold and Lightning Resistances', parts: { cold: 1, lightning: 1 } },
    { key: '+#% to Fire and Chaos Resistances', parts: { fire: 1, chaos: 1 } },
    { key: '+#% to Cold and Chaos Resistances', parts: { cold: 1, chaos: 1 } },
    { key: '+#% to Lightning and Chaos Resistances', parts: { lightning: 1, chaos: 1 } },
    { key: '+#% to all Elemental Resistances', parts: { fire: 1, cold: 1, lightning: 1 } },

    { key: '+# to Strength', parts: { strength: 1, life: 0.5 } },
    { key: '+# to Dexterity', parts: { dexterity: 1 } },
    { key: '+# to Intelligence', parts: { intelligence: 1 } },
    { key: '+# to Strength and Dexterity', parts: { strength: 1, dexterity: 1, life: 0.5 } },
    { key: '+# to Strength and Intelligence', parts: { strength: 1, intelligence: 1, life: 0.5 } },
    { key: '+# to Dexterity and Intelligence', parts: { dexterity: 1, intelligence: 1 } },
    { key: '+# to all Attributes', parts: { strength: 1, dexterity: 1, intelligence: 1, life: 0.5 } }
  ],

  // Defence and weapon rolls that describe the item itself rather than the
  // character. The trade site indexes these as "(Local)" stats, but a global
  // stat of the same wording usually exists too and would win the lookup, so
  // the decision is made from the item's shape instead of the matched text.
  LOCAL_DEFENCE_KEYS: new Set([
    '#% increased Armour',
    '#% increased Evasion Rating',
    '#% increased Energy Shield',
    '#% increased Armour and Evasion',
    '#% increased Armour and Energy Shield',
    '#% increased Evasion and Energy Shield',
    '#% increased Armour, Evasion and Energy Shield',
    '+# to Armour',
    '+# to Evasion Rating',
    '+# to maximum Energy Shield',
    '#% increased Stun and Block Recovery'
  ]),

  LOCAL_WEAPON_KEYS: new Set([
    '#% increased Physical Damage',
    'Adds # to # Physical Damage',
    'Adds # to # Fire Damage',
    'Adds # to # Cold Damage',
    'Adds # to # Lightning Damage',
    'Adds # to # Chaos Damage',
    '#% increased Attack Speed',
    '#% increased Critical Strike Chance',
    '+#% to Critical Strike Multiplier',
    '#% increased Accuracy Rating',
    '+# to Accuracy Rating'
  ]),

  WEAPON_SLOTS: new Set(['Weapon 1', 'Weapon 2', 'Weapon', 'Weapon 1 Swap', 'Weapon 2 Swap']),

  // Build slot names, as PoB writes them, mapped onto trade categories.
  // Used for the Search by chips, so a search can widen past the exact base.
  SLOT_CATEGORY: {
    'Helmet': 'armour.helmet',
    'Body Armour': 'armour.chest',
    'Gloves': 'armour.gloves',
    'Boots': 'armour.boots',
    'Belt': 'accessory.belt',
    'Amulet': 'accessory.amulet',
    'Ring 1': 'accessory.ring',
    'Ring 2': 'accessory.ring',
    'Ring': 'accessory.ring',
    'Weapon 1': 'weapon',
    'Weapon 2': 'weapon',
    'Weapon': 'weapon',
    'Offhand': 'armour.shield',
    'Flask 1': 'flask',
    'Flask 2': 'flask',
    'Flask 3': 'flask',
    'Flask 4': 'flask',
    'Flask 5': 'flask',
    'Jewel': 'jewel'
  },

  CATEGORY_LABELS: {
    'armour': 'Any Armour',
    'armour.helmet': 'Any Helmet',
    'armour.chest': 'Any Body Armour',
    'armour.gloves': 'Any Gloves',
    'armour.boots': 'Any Boots',
    'armour.shield': 'Any Shield',
    'armour.quiver': 'Any Quiver',
    'accessory': 'Any Accessory',
    'accessory.belt': 'Any Belt',
    'accessory.amulet': 'Any Amulet',
    'accessory.ring': 'Any Ring',
    'weapon': 'Any Weapon',
    'jewel': 'Any Jewel',
    'jewel.cluster': 'Any Cluster Jewel',
    'jewel.abyss': 'Any Abyss Jewel',
    'flask': 'Any Flask'
  },

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
      { key: key, negate: false, local: false },
      // Defence and weapon stats are suffixed on the trade site
      { key: key + ' (Local)', negate: false, local: true }
    ];

    if (key.startsWith('-')) {
      candidates.push({ key: '+' + key.slice(1), negate: false, local: false });
    }
    if (key.includes('reduced')) {
      candidates.push({ key: key.replace(/reduced/g, 'increased'), negate: true, local: false });
    }
    if (key.includes('less')) {
      candidates.push({ key: key.replace(/\bless\b/g, 'more'), negate: true, local: false });
    }
    if (key.includes('increased')) {
      candidates.push({ key: key.replace(/increased/g, 'reduced'), negate: true, local: false });
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

    const result = (id, group, statText, negate, local) => {
      let min = value;
      if (min !== null && negate) min = -min;
      return { id: id, group: group, statText: statText, value: min, local: local };
    };

    for (const candidate of candidates) {
      for (const group of groups) {
        const bucket = index.exact[group];
        if (!bucket) continue;

        const id = bucket[candidate.key];
        if (id) return result(id, group, candidate.key, candidate.negate, candidate.local);
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

      return result(chosen.id, group, chosen.text, false, /\(Local\)/i.test(chosen.text));
    }

    return null;
  },

  // Which lookup order applies to a modifier, based on its PoB tags
  modKind(mod, isImplicit) {
    if (mod.enchant) return 'enchant';
    if (mod.scourge) return 'scourge';
    if (mod.crafted) return 'crafted';
    if (mod.fractured) return 'fractured';
    return isImplicit ? 'implicit' : 'explicit';
  },

  // Both wordings exist for most defence rolls, and the global one is matched
  // first, so a mod known to be local is swapped onto its "(Local)" twin. It
  // stays switched off either way, but a user who turns it back on should get
  // the stat that actually describes the item.
  preferLocalStat(index, match, text) {
    if (!match) return match;
    if (/\(Local\)/i.test(match.statText || '')) return match;

    const localKey = this.toStatKey(text) + ' (Local)';
    const groups = this.LOOKUP_ORDER[match.group] || this.LOOKUP_ORDER.explicit;

    for (const group of [match.group].concat(groups)) {
      const bucket = index.exact[group];
      if (bucket && bucket[localKey]) {
        return Object.assign({}, match, {
          id: bucket[localKey], group: group, statText: localKey, local: true
        });
      }
    }

    return match;
  },

  // A mod is local when the item it sits on is the thing it describes: defence
  // rolls on a piece that has defences, weapon rolls in a weapon slot.
  isLocalMod(item, slot, text) {
    const key = this.toStatKey(text);

    const hasDefences = Boolean(item.armour || item.evasion || item.energyShield);
    if (hasDefences && this.LOCAL_DEFENCE_KEYS.has(key)) return true;

    if (slot && this.WEAPON_SLOTS.has(slot) && this.LOCAL_WEAPON_KEYS.has(key)) return true;

    return false;
  },

  // Finds the pseudo totals a mod line contributes to
  pseudoPartsFor(text) {
    const key = this.toStatKey(text);
    const rule = this.PSEUDO_RULES.find(entry => entry.key === key);
    return rule ? rule.parts : null;
  },

  // Sums every mod's pseudo contributions into one row per total.
  // Elemental resistance only earns its own row when more than one element
  // feeds it, otherwise it just restates the single resistance row.
  collectPseudo(rows) {
    const totals = {};
    const elements = new Set();

    for (const row of rows) {
      if (!row.pseudoParts) continue;
      const value = this.firstValue(row.text);
      if (value === null) continue;

      for (const name of Object.keys(row.pseudoParts)) {
        totals[name] = (totals[name] || 0) + value * row.pseudoParts[name];
        if (name === 'fire' || name === 'cold' || name === 'lightning') elements.add(name);
      }
    }

    if (elements.size > 1) {
      totals.elemental = ['fire', 'cold', 'lightning']
        .reduce((sum, name) => sum + (totals[name] || 0), 0);
    }

    const order = ['life', 'energyShield', 'mana', 'elemental', 'fire', 'cold',
      'lightning', 'chaos', 'strength', 'dexterity', 'intelligence'];

    // When the elemental total is in play the individual elements start off.
    // Asking for 85 total elemental resistance finds an item rolled 80 cold and
    // 5 fire; asking for that plus each element separately finds nothing.
    const hasElementalTotal = Boolean(totals.elemental);
    const individual = new Set(['fire', 'cold', 'lightning']);

    return order
      .filter(name => totals[name])
      .map(name => ({
        key: name,
        id: this.PSEUDO[name].id,
        label: this.PSEUDO[name].label,
        value: Math.round(totals[name] * 10) / 10,
        enabled: !(hasElementalTotal && individual.has(name))
      }));
  },

  // PoB qualifies a few bases the trade site does not, such as
  // "Two-Stone Ring (Cold/Lightning)"
  toTradeType(baseType) {
    if (!baseType) return null;
    return baseType.replace(/\s*\([^)]*\)\s*$/, '').trim() || null;
  },

  parentCategory(category) {
    if (!category || category.indexOf('.') < 0) return null;
    return category.split('.')[0];
  },

  // The Search by chips, from the most specific target to the broadest
  buildSearchTargets(item, slot) {
    const targets = [];
    const isUnique = item.rarity === 'UNIQUE' || item.rarity === 'RELIC';
    const base = this.toTradeType(item.baseType);

    if (isUnique && item.name && item.name !== item.baseType) {
      targets.push({ id: 'name', label: item.name, name: item.name, type: base });
    }
    if (base) {
      targets.push({ id: 'base', label: base, type: base });
    }

    const category = this.SLOT_CATEGORY[slot] || null;
    if (category) {
      targets.push({
        id: 'category',
        label: this.CATEGORY_LABELS[category] || category,
        category: category
      });

      const parent = this.parentCategory(category);
      if (parent) {
        targets.push({
          id: 'parent',
          label: this.CATEGORY_LABELS[parent] || parent,
          category: parent
        });
      }
    }

    return targets;
  },

  // Sockets come out of PoB as "R-W-W-W G B", groups split on spaces and
  // links joined by hyphens
  describeSockets(sockets) {
    if (!sockets) return null;

    const groups = String(sockets).trim().split(/\s+/).filter(Boolean);
    if (groups.length === 0) return null;

    const colours = [];
    let best = 0;

    for (const group of groups) {
      const parts = group.split('-').filter(Boolean);
      if (parts.length > best) best = parts.length;
      for (const part of parts) colours.push(part);
    }

    return { count: colours.length, links: best, colours: colours };
  },

  // Rows for the Properties block. Local defence mods are dropped from the mod
  // list, so these carry the item's actual armour and energy shield instead.
  buildProperties(item) {
    const rows = [];
    const add = (key, label, value) => {
      if (value === null || value === undefined || !value) return;
      rows.push({ key: key, label: label, value: value, enabled: true });
    };

    add('armour', 'Armour', item.armour);
    add('evasion', 'Evasion', item.evasion);
    add('energyShield', 'Energy Shield', item.energyShield);

    return rows;
  },

  // Produces everything the panel renders for one item
  describeItem(index, item, options) {
    const settings = options || {};
    const rows = [];

    const collect = (mods, isImplicit) => {
      for (const mod of mods) {
        const kind = this.modKind(mod, isImplicit);
        let match = this.matchMod(index, mod, kind);

        // Local wins over pseudo: "+# to maximum Energy Shield" is a global
        // roll on a ring but the item's own defence on a body armour, and
        // rolling the latter into a pseudo total would be plainly wrong.
        const local = this.isLocalMod(item, settings.slot, mod.text)
          || Boolean(match && match.local);
        if (local) match = this.preferLocalStat(index, match, mod.text);

        const pseudoParts = local ? null : this.pseudoPartsFor(mod.text);

        // A local defence roll is already expressed by the property filters, and
        // a roll folded into a pseudo total would double count, so both are
        // listed but switched off.
        const superseded = local || Boolean(pseudoParts);

        rows.push({
          text: mod.text,
          kind: kind,
          implicit: isImplicit,
          stat: match,
          local: local,
          pseudoParts: pseudoParts,
          superseded: superseded,
          min: match ? match.value : null,
          enabled: Boolean(match) && !superseded
        });
      }
    };

    collect(item.implicits || [], true);
    collect(item.explicits || [], false);

    return {
      item: item,
      searchTargets: this.buildSearchTargets(item, settings.slot),
      properties: this.buildProperties(item),
      pseudo: this.collectPseudo(rows),
      sockets: this.describeSockets(item.sockets),
      mods: rows
    };
  },

  normalizeStatus(status) {
    const known = this.STATUS_OPTIONS.some(option => option.id === status);
    return known ? status : this.DEFAULT_STATUS;
  },

  normalizeMinPercent(percent) {
    const value = Number(percent);
    if (!Number.isFinite(value)) return this.DEFAULT_MIN_PERCENT;
    return Math.min(100, Math.max(0, Math.round(value)));
  },

  // Relaxes a roll to the chosen share of its value. Negative rolls relax
  // upward, since a smaller penalty is the better item.
  relax(value, percent) {
    if (value === null || value === undefined || Number.isNaN(value)) return null;
    if (percent >= 100) return value;

    const scaled = value * (percent / 100);
    const rounded = Number.isInteger(value)
      ? (value < 0 ? Math.ceil(scaled) : Math.floor(scaled))
      : Math.round(scaled * 10) / 10;

    return rounded;
  },

  buildQuery(options) {
    const percent = this.normalizeMinPercent(options.minPercent);
    const filters = [];
    const used = new Set();

    const push = (id, value) => {
      if (!id || used.has(id)) return;
      used.add(id);

      const filter = { id: id, disabled: false };
      if (value !== null && value !== undefined && !Number.isNaN(value)) {
        filter.value = { min: value };
      }
      filters.push(filter);
    };

    for (const row of options.pseudo || []) {
      if (!row.enabled) continue;
      push(row.id, this.relax(row.value, percent));
    }

    for (const row of options.rows || []) {
      if (!row.enabled || !row.stat) continue;
      // A row the user typed a value into keeps that value verbatim
      const value = row.exact ? row.min : this.relax(row.min, percent);
      push(row.stat.id, value);
    }

    const query = {
      status: { option: this.normalizeStatus(options.status) },
      stats: [{ type: 'and', filters: filters }]
    };

    const target = options.target || {};
    if (target.name) query.name = target.name;
    if (target.type) query.type = this.toTradeType(target.type);

    const filterGroups = {};

    if (target.category) {
      filterGroups.type_filters = {
        filters: { category: { option: target.category } }
      };
    }

    // Several things land in misc_filters, so it is merged rather than assigned
    const misc = {};

    if (options.corrupted === true || options.corrupted === false) {
      misc.corrupted = { option: String(options.corrupted) };
    }

    const gem = options.gem;
    if (gem) {
      if (gem.level !== null && gem.level !== undefined) {
        misc.gem_level = { min: gem.level };
      }
      if (gem.quality !== null && gem.quality !== undefined) {
        misc.quality = { min: gem.quality };
      }
      if (gem.corrupted === true || gem.corrupted === false) {
        misc.corrupted = { option: String(gem.corrupted) };
      }
    }

    if (Object.keys(misc).length > 0) {
      filterGroups.misc_filters = { filters: misc };
    }

    const sockets = options.sockets;
    if (sockets && sockets.mode && sockets.mode !== 'any') {
      const socketFilters = {};

      if (sockets.mode === 'links' || sockets.mode === 'colours') {
        socketFilters.links = { min: sockets.links };
      }
      if (sockets.mode === 'colours' && sockets.colours) {
        const counts = { R: 0, G: 0, B: 0, W: 0 };
        for (const colour of sockets.colours) {
          if (counts[colour] !== undefined) counts[colour]++;
        }
        socketFilters.links = {
          min: sockets.links,
          r: counts.R, g: counts.G, b: counts.B, w: counts.W
        };
      }

      filterGroups.socket_filters = { filters: socketFilters };
    }

    const properties = (options.properties || []).filter(row => row.enabled);
    if (properties.length > 0) {
      const armourFilters = {};
      const names = { armour: 'ar', evasion: 'ev', energyShield: 'es' };

      for (const row of properties) {
        const name = names[row.key];
        if (!name) continue;
        armourFilters[name] = { min: this.relax(row.value, percent) };
      }

      if (Object.keys(armourFilters).length > 0) {
        filterGroups.armour_filters = { filters: armourFilters };
      }
    }

    if (Object.keys(filterGroups).length > 0) query.filters = filterGroups;

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
