// Turns a maxroll planner item into the same shape PobParser produces, so the
// trade search and the panel do not need to know which site an item came from.
//
// Maxroll stores items as internal stat ids and numbers, "base_maximum_life":
// 90, with no display text. The text is rebuilt here from the table in
// data/maxroll-data.json, which tools/build-maxroll-data.py distils out of the
// planner's own game data.

const MaxrollParser = {
  data: null,
  statIndex: null,

  SOCKET_COLOURS: { red: 'R', green: 'G', blue: 'B', white: 'W', abyss: 'A' },

  RARITY: { normal: 'NORMAL', magic: 'MAGIC', rare: 'RARE', unique: 'UNIQUE', relic: 'RELIC' },

  // Maxroll item classes mapped onto the slot names TradeSearch already knows
  CLASS_SLOT: {
    'Helmet': 'Helmet',
    'Body Armour': 'Body Armour',
    'Gloves': 'Gloves',
    'Boots': 'Boots',
    'Belt': 'Belt',
    'Amulet': 'Amulet',
    'Ring': 'Ring 1',
    'Shield': 'Offhand',
    'Quiver': 'Offhand'
  },

  async load() {
    if (this.data) return this.data;

    const url = browser.runtime.getURL('data/maxroll-data.json');
    const response = await fetch(url);
    if (!response.ok) throw new Error('could not read the maxroll stat table');

    this.data = await response.json();
    this.statIndex = this.buildStatIndex(this.data.stats);
    return this.data;
  },

  // stat id -> the entry keys that mention it, longest first so a line covering
  // two ids is preferred over two separate single id lines
  buildStatIndex(stats) {
    const index = {};

    for (const key of Object.keys(stats)) {
      const ids = key.split('\t');
      for (const id of ids) {
        if (!index[id]) index[id] = [];
        index[id].push(key);
      }
    }

    for (const id of Object.keys(index)) {
      index[id].sort((a, b) => b.split('\t').length - a.split('\t').length);
    }

    return index;
  },

  conditionMatches(condition, value) {
    if (!condition) return true;
    if (condition.min !== undefined && value < condition.min) return false;
    if (condition.max !== undefined && value > condition.max) return false;
    return true;
  },

  pickVariant(variants, values) {
    for (const variant of variants) {
      const conditions = variant[0] || [];
      let ok = true;

      for (let i = 0; i < values.length; i++) {
        if (!this.conditionMatches(conditions[i], values[i])) { ok = false; break; }
      }

      if (ok) return variant;
    }

    return null;
  },

  // The handlers the item mod pool actually uses. Anything unrecognised falls
  // through unchanged, which prints a wrong number rather than losing the line.
  applyHandlers(value, handlers) {
    let result = value;
    let decimals = 0;

    for (const handler of handlers || []) {
      switch (handler) {
        case 'negate': result = -result; break;
        case 'double': result = result * 2; break;
        case 'negate_and_double': result = -result * 2; break;
        case 'divide_by_two_0dp': result = result / 2; break;
        case 'divide_by_four': result = result / 4; break;
        case 'divide_by_ten_0dp': result = result / 10; break;
        case 'divide_by_ten_1dp':
        case 'divide_by_ten_1dp_if_required': result = result / 10; decimals = 1; break;
        case 'divide_by_twenty_then_double_0dp': result = (result / 20) * 2; break;
        case 'divide_by_one_hundred': result = result / 100; break;
        case 'divide_by_one_hundred_2dp':
        case 'divide_by_one_hundred_2dp_if_required': result = result / 100; decimals = 2; break;
        case 'milliseconds_to_seconds': result = result / 1000; decimals = 1; break;
        case 'milliseconds_to_seconds_0dp': result = result / 1000; break;
        case 'milliseconds_to_seconds_1dp': result = result / 1000; decimals = 1; break;
        case 'milliseconds_to_seconds_2dp':
        case 'milliseconds_to_seconds_2dp_if_required': result = result / 1000; decimals = 2; break;
        case 'per_minute_to_per_second': result = result / 60; decimals = 1; break;
        case 'per_minute_to_per_second_0dp': result = result / 60; break;
        case 'per_minute_to_per_second_2dp':
        case 'per_minute_to_per_second_2dp_if_required': result = result / 60; decimals = 2; break;
        case 'locations_to_metres': result = result / 10; decimals = 1; break;
        default: break;
      }
    }

    return { value: result, decimals: decimals };
  },

  formatValue(value, format, handlers) {
    const applied = this.applyHandlers(value, handlers);
    let text;

    if (applied.decimals > 0) {
      text = applied.value.toFixed(applied.decimals);
      // The "if required" handlers drop a trailing zero, and so does the game
      if (text.indexOf('.') >= 0) text = text.replace(/\.?0+$/, '');
    } else {
      text = String(Math.round(applied.value * 100) / 100);
    }

    if (format === '+#' && applied.value >= 0) text = '+' + text;

    return text;
  },

  // Some lines interpolate a passive skill name rather than a number, and the
  // name lives in the passive tree data this table does not carry. Printing the
  // raw hash would be worse than saying nothing, so those lines are dropped.
  UNRESOLVABLE: new Set(['passive_hash']),

  // A few unique mods name a gem by its index into one of the game's lists
  INDEXABLE: {
    display_indexable_skill: 'skill',
    display_indexable_support: 'support',
    display_indexable_non_active_support: 'non_active_support'
  },

  lookupIndexable(value, handlers) {
    for (const handler of handlers || []) {
      const list = this.INDEXABLE[handler];
      if (!list) continue;

      const names = (this.data.indexable || {})[list] || [];
      const name = names[value];
      if (name) return name;
    }

    return null;
  },

  renderVariant(variant, values) {
    const template = variant[1];
    const formats = variant[2] || [];
    const handlers = variant[3] || [];

    for (const list of handlers) {
      for (const handler of list || []) {
        if (this.UNRESOLVABLE.has(handler)) return null;
      }
    }

    return template.replace(/\{(\d+)(?::[^}]*)?\}/g, (full, position) => {
      const slot = Number(position);
      if (formats[slot] === 'ignore') return '';
      if (values[slot] === undefined) return full;

      const named = this.lookupIndexable(values[slot], handlers[slot]);
      if (named !== null) return named;

      return this.formatValue(values[slot], formats[slot], handlers[slot]);
    }).replace(/\s+/g, ' ').trim();
  },

  // Turns one {statId: value} block into printed modifier lines
  renderStats(stats) {
    if (!stats) return [];

    const remaining = Object.assign({}, stats);
    const lines = [];

    for (const id of Object.keys(stats)) {
      if (!(id in remaining)) continue;

      const keys = this.statIndex[id];
      if (!keys) { delete remaining[id]; continue; }

      let rendered = null;

      for (const key of keys) {
        const ids = key.split('\t');
        if (!ids.every(other => other in remaining)) continue;

        const values = ids.map(other => remaining[other]);
        const variant = this.pickVariant(this.data.stats[key], values);
        if (!variant) continue;

        const text = this.renderVariant(variant, values);
        for (const other of ids) delete remaining[other];
        if (text) rendered = text;
        break;
      }

      if (rendered) lines.push(rendered);
      else delete remaining[id];
    }

    return lines;
  },

  toMods(stats, tags) {
    return this.renderStats(stats).map(text => Object.assign({
      text: text, crafted: false, fractured: false, enchant: false, scourge: false
    }, tags || {}));
  },

  // "B-B-B-B-B B", the layout PoB writes and TradeSearch already reads
  toSocketString(sockets) {
    if (!Array.isArray(sockets) || sockets.length === 0) return null;

    let out = '';
    sockets.forEach((socket, position) => {
      out += this.SOCKET_COLOURS[socket.color] || 'W';
      if (position < sockets.length - 1) out += socket.link ? '-' : ' ';
    });

    return out;
  },

  baseFor(metadata) {
    const entry = this.data.bases[metadata];
    return entry ? { name: entry[0], itemClass: entry[1] } : null;
  },

  slotFor(metadata) {
    const base = this.baseFor(metadata);
    if (!base) return null;
    if (this.CLASS_SLOT[base.itemClass]) return this.CLASS_SLOT[base.itemClass];
    if (/Jewel/i.test(base.itemClass)) return 'Jewel';
    if (/Flask/i.test(base.itemClass)) return 'Flask 1';
    // Everything left in the equippable set is a weapon of some kind
    return 'Weapon 1';
  },

  parseItem(raw) {
    if (!raw || !raw.base) return null;

    const base = this.baseFor(raw.base);
    const properties = raw.properties || {};
    const stats = raw.stats || {};

    const explicits = []
      .concat(this.toMods(stats.explicit))
      .concat(this.toMods(stats.fractured, { fractured: true }))
      .concat(this.toMods(stats.crafted, { crafted: true }))
      .concat(this.toMods(stats.enchant, { enchant: true }));

    return {
      rarity: this.RARITY[raw.rarity] || 'NORMAL',
      // Rare planner items carry a placeholder label rather than a rolled name,
      // so only uniques get one and everything else falls back to the base
      name: raw.rarity === 'unique' ? (raw.name || null) : (base ? base.name : null),
      baseType: base ? base.name : null,
      itemLevel: raw.ilvl || null,
      quality: raw.quality || null,
      corrupted: Boolean(raw.flags & 1),
      armour: properties.armour || null,
      evasion: properties.evasion || null,
      energyShield: properties.energy_shield || null,
      sockets: this.toSocketString(raw.sockets),
      influences: [],
      implicits: this.toMods(stats.implicit),
      explicits: explicits,
      slot: this.slotFor(raw.base)
    };
  },

  // The planner payload keeps its real content as a JSON string under "data"
  parseProfile(payload) {
    const body = typeof payload.data === 'string' ? JSON.parse(payload.data) : payload.data;
    if (!body || !body.profiles) return null;

    return {
      items: body.items || {},
      profiles: body.profiles.map(profile => {
        const equipment = profile.equipment || {};
        const variants = equipment.variants || [];
        const active = variants[equipment.active] || variants[0] || { items: {} };

        return {
          id: profile.id,
          name: profile.name || 'Build',
          level: profile.level || null,
          slots: active.items || {}
        };
      })
    };
  }
};

if (typeof window !== 'undefined') {
  window.MaxrollParser = MaxrollParser;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MaxrollParser;
}
