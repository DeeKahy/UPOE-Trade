// Decodes Path of Building build codes and pulls item data out of them.
// Pure logic, no browser UI, so it can be unit tested outside the extension.

const PobParser = {
  // Lines in the PoB item format that are metadata rather than modifiers
  FLAG_LINES: new Set([
    'Corrupted',
    'Mirrored',
    'Split',
    'Unidentified',
    'Relic',
    'Fractured Item',
    'Synthesised Item',
    'Shaper Item',
    'Elder Item',
    'Warlord Item',
    'Crusader Item',
    'Redeemer Item',
    'Hunter Item',
    'Searing Exarch Item',
    'Eater of Worlds Item'
  ]),

  INFLUENCE_LINES: {
    'Shaper Item': 'shaper',
    'Elder Item': 'elder',
    'Warlord Item': 'warlord',
    'Crusader Item': 'crusader',
    'Redeemer Item': 'redeemer',
    'Hunter Item': 'hunter'
  },

  // Base64url + zlib deflate, which is how PoB and pobb.in share builds
  async decodeBuildCode(code) {
    const normalized = String(code).trim().replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);

    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
    return await new Response(stream).text();
  },

  // Pulls items, item sets and tree jewel sockets out of the build XML.
  // Regex rather than DOMParser because the item bodies are raw text nodes
  // and we only ever need three sections.
  parseBuild(xml) {
    const itemsTag = xml.match(/<Items\s([^>]*)>/);
    const treeTag = xml.match(/<Tree\s([^>]*)>/);

    const itemsAttrs = itemsTag ? this.parseAttributes(itemsTag[1]) : {};
    const treeAttrs = treeTag ? this.parseAttributes(treeTag[1]) : {};

    const itemSets = this.parseItemSets(xml);
    const activeSetIndex = itemSets.findIndex(set => set.id === itemsAttrs.activeItemSet);

    return {
      items: this.parseItemBlocks(xml),
      gems: this.parseGems(xml),
      itemSets: itemSets,
      treeSpecs: this.parseTreeSpecs(xml),
      activeItemSet: activeSetIndex >= 0 ? activeSetIndex : 0,
      // activeSpec is stored one-based
      activeSpec: treeAttrs.activeSpec ? Number(treeAttrs.activeSpec) - 1 : 0
    };
  },

  // Gems live in <Gem/> nodes on the skill groups. The trade site keeps the
  // "Support" suffix that nameSpec drops, and the gemId is what says whether a
  // gem is one: Metadata/Items/Gems/SupportGemRapidDecay is Swift Affliction.
  parseGems(xml) {
    const gems = {};
    const pattern = /<Gem\s([^>]*)\/>/g;
    let match;

    while ((match = pattern.exec(xml)) !== null) {
      const attrs = this.parseAttributes(match[1]);
      const name = attrs.nameSpec && this.decodeEntities(attrs.nameSpec).trim();
      if (!name) continue;

      const support = /\/SupportGem/.test(attrs.gemId || '');
      const tradeName = support && !/ Support$/.test(name) ? `${name} Support` : name;

      const level = attrs.level ? Number(attrs.level) : null;
      const quality = attrs.quality ? Number(attrs.quality) : null;

      // The same gem shows up in several skill groups, at different levels in a
      // levelling section. The highest is the one worth searching.
      const key = tradeName.toLowerCase();
      const current = gems[key];

      if (!current) {
        gems[key] = { name: tradeName, support: support, level: level, quality: quality };
        continue;
      }

      if (level !== null && (current.level === null || level > current.level)) {
        current.level = level;
      }
      if (quality !== null && (current.quality === null || quality > current.quality)) {
        current.quality = quality;
      }
    }

    return gems;
  },

  parseItemBlocks(xml) {
    const items = {};
    const blockPattern = /<Item\s([^>]*)>([\s\S]*?)<\/Item>/g;
    let match;

    while ((match = blockPattern.exec(xml)) !== null) {
      const attrs = this.parseAttributes(match[1]);
      if (!attrs.id) continue;

      // Strip child elements such as <ModRange/>, keeping only the item text
      const text = this.decodeEntities(match[2].replace(/<[^>]*>/g, ''));
      items[attrs.id] = { id: attrs.id, variant: attrs.variant || null, text: text };
    }

    return items;
  },

  parseItemSets(xml) {
    const sets = [];
    const setPattern = /<ItemSet\s([^>]*)>([\s\S]*?)<\/ItemSet>/g;
    let match;

    while ((match = setPattern.exec(xml)) !== null) {
      const attrs = this.parseAttributes(match[1]);
      const slots = {};

      const slotPattern = /<Slot\s([^>]*?)\/>/g;
      let slotMatch;
      while ((slotMatch = slotPattern.exec(match[2])) !== null) {
        const slotAttrs = this.parseAttributes(slotMatch[1]);
        if (slotAttrs.itemId && slotAttrs.itemId !== '0') {
          slots[slotAttrs.name] = slotAttrs.itemId;
        }
      }

      sets.push({ id: attrs.id, title: attrs.title || '', slots: slots });
    }

    return sets;
  },

  // Socketed jewels live on the passive tree spec, not on the item set
  parseTreeSpecs(xml) {
    const specs = [];
    const specPattern = /<Spec\s([^>]*)>([\s\S]*?)<\/Spec>/g;
    let match;

    while ((match = specPattern.exec(xml)) !== null) {
      const attrs = this.parseAttributes(match[1]);
      const jewels = [];

      const socketPattern = /<Socket\s([^>]*?)\/>/g;
      let socketMatch;
      while ((socketMatch = socketPattern.exec(match[2])) !== null) {
        const socketAttrs = this.parseAttributes(socketMatch[1]);
        if (socketAttrs.itemId && socketAttrs.itemId !== '0') {
          jewels.push({ nodeId: socketAttrs.nodeId, itemId: socketAttrs.itemId });
        }
      }

      specs.push({ title: attrs.title || '', jewels: jewels });
    }

    return specs;
  },

  parseAttributes(source) {
    const attrs = {};
    const pattern = /([\w:.-]+)="([^"]*)"/g;
    let match;

    while ((match = pattern.exec(source)) !== null) {
      attrs[match[1]] = this.decodeEntities(match[2]);
    }

    return attrs;
  },

  decodeEntities(text) {
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (full, code) => String.fromCharCode(Number(code)))
      .replace(/&amp;/g, '&');
  },

  // Turns one PoB item text block into a structured item
  parseItem(rawText, variantAttr) {
    const lines = String(rawText)
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) return null;

    const item = {
      rarity: 'NORMAL',
      name: null,
      baseType: null,
      itemLevel: null,
      quality: null,
      corrupted: false,
      // Defence values and sockets drive the property and link filters, which
      // stand in for the local mods the trade site does not index as stats
      armour: null,
      evasion: null,
      energyShield: null,
      sockets: null,
      influences: [],
      implicits: [],
      explicits: [],
      unmatchedHeader: []
    };

    let index = 0;

    const rarityMatch = lines[0].match(/^Rarity:\s*(\w+)/i);
    if (rarityMatch) {
      item.rarity = rarityMatch[1].toUpperCase();
      index = 1;
    }

    // Name lines run until the first metadata or flag line
    const nameLines = [];
    while (index < lines.length && !this.isHeaderLine(lines[index])) {
      nameLines.push(lines[index]);
      index++;
    }

    if (nameLines.length >= 2) {
      item.name = nameLines[0];
      item.baseType = nameLines[1];
    } else if (nameLines.length === 1) {
      // Normal and magic items only carry a single display line
      item.baseType = nameLines[0];
      item.name = nameLines[0];
    }

    let selectedVariant = variantAttr ? Number(variantAttr) : null;
    let implicitCount = 0;
    let modStart = lines.length;

    for (let i = index; i < lines.length; i++) {
      const line = lines[i];

      const implicitMatch = line.match(/^Implicits:\s*(\d+)/i);
      if (implicitMatch) {
        implicitCount = Number(implicitMatch[1]);
        modStart = i + 1;
        break;
      }

      const levelMatch = line.match(/^Item Level:\s*(\d+)/i);
      if (levelMatch) item.itemLevel = Number(levelMatch[1]);

      const qualityMatch = line.match(/^Quality:\s*(\d+)/i);
      if (qualityMatch) item.quality = Number(qualityMatch[1]);

      // "Armour: 2320", and the percentile sibling that must not be mistaken
      // for it, plus the socket layout as "R-W-W-W G B"
      const armourMatch = line.match(/^Armour:\s*(\d+)/i);
      if (armourMatch) item.armour = Number(armourMatch[1]);

      const evasionMatch = line.match(/^Evasion(?:\s*Rating)?:\s*(\d+)/i);
      if (evasionMatch) item.evasion = Number(evasionMatch[1]);

      const energyShieldMatch = line.match(/^Energy\s*Shield:\s*(\d+)/i);
      if (energyShieldMatch) item.energyShield = Number(energyShieldMatch[1]);

      const socketsMatch = line.match(/^Sockets:\s*(.+)$/i);
      if (socketsMatch) item.sockets = socketsMatch[1].trim();

      const variantMatch = line.match(/^Selected Variant:\s*(\d+)/i);
      if (variantMatch && selectedVariant === null) selectedVariant = Number(variantMatch[1]);

      if (this.INFLUENCE_LINES[line]) item.influences.push(this.INFLUENCE_LINES[line]);
      if (line === 'Corrupted') item.corrupted = true;
    }

    const mods = [];
    for (let i = modStart; i < lines.length; i++) {
      const line = lines[i];

      if (line === 'Corrupted') {
        item.corrupted = true;
        continue;
      }
      if (this.INFLUENCE_LINES[line]) {
        item.influences.push(this.INFLUENCE_LINES[line]);
        continue;
      }
      if (this.isHeaderLine(line)) continue;

      const mod = this.parseMod(line, selectedVariant);
      if (mod) mods.push(mod);
    }

    item.implicits = mods.slice(0, implicitCount);
    item.explicits = mods.slice(implicitCount);

    return item;
  },

  isHeaderLine(line) {
    if (this.FLAG_LINES.has(line)) return true;
    if (/^Requires\b/.test(line)) return true;
    // Metadata lines are always "Key: value" with a short alphabetic key
    return /^[A-Za-z][A-Za-z' ]{0,24}:/.test(line);
  },

  // Strips PoB's inline tags and resolves rolled ranges into real numbers
  parseMod(rawLine, selectedVariant) {
    let remaining = rawLine;
    const tags = {};
    let variants = null;
    let range = null;

    let tagMatch;
    while ((tagMatch = remaining.match(/^\{([^}]*)\}/)) !== null) {
      const tag = tagMatch[1];
      remaining = remaining.slice(tagMatch[0].length);

      if (tag.startsWith('range:')) {
        range = parseFloat(tag.slice(6));
      } else if (tag.startsWith('variant:')) {
        variants = tag.slice(8).split(',').map(part => Number(part.trim()));
      } else if (tag.startsWith('tags:')) {
        tags.modTags = tag.slice(5).split(',');
      } else {
        tags[tag] = true;
      }
    }

    // Variant-gated lines only apply to the variant the build has selected
    if (variants && selectedVariant !== null && !variants.includes(selectedVariant)) {
      return null;
    }

    const text = this.resolveRanges(remaining.trim(), range);
    if (!text) return null;

    return {
      text: text,
      crafted: tags.crafted === true,
      fractured: tags.fractured === true,
      enchant: tags.enchant === true || tags.crucible === true,
      scourge: tags.scourge === true
    };
  },

  resolveRanges(text, range) {
    const rollPosition = range === null || Number.isNaN(range) ? 0.5 : range;

    return text.replace(/\((-?[\d.]+)-(-?[\d.]+)\)/g, (full, lowText, highText) => {
      const low = parseFloat(lowText);
      const high = parseFloat(highText);
      const value = low + (high - low) * rollPosition;
      const fractional = lowText.includes('.') || highText.includes('.');
      return fractional ? String(Math.round(value * 10) / 10) : String(Math.round(value));
    });
  }
};

if (typeof window !== 'undefined') {
  window.PobParser = PobParser;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PobParser;
}
