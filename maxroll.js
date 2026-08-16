// Adds trade search to maxroll Path of Exile build guides.
//
// Guides name their items in prose rather than drawing a gear grid, but every
// mention is tagged, <span class="poe-item" data-poe-id="UniqueWand22">, and the
// page carries the id of the planner behind the guide. So the planner is fetched
// once and each mention is resolved back to a real item with real modifiers.
(function() {
  'use strict';

  const state = {
    enabled: true,
    started: false,
    plannerId: null,
    build: null,
    byUnique: null,
    byName: null,
    chip: null,
    chipTarget: null,
    hideTimer: null
  };

  async function init() {
    let settings;
    try {
      settings = await Storage.getSettings();
      state.enabled = settings.maxrollTradeEnabled !== false;
    } catch (error) {
      settings = {};
      state.enabled = true;
    }

    TradePanel.configure(settings);

    if (!state.enabled) {
      console.log('UPOE Trade Manager: maxroll trade search disabled');
      return;
    }
    if (state.started) return;

    state.plannerId = findPlannerId();
    if (!state.plannerId) {
      console.log('UPOE Trade Manager: no planner on this page');
      return;
    }

    state.started = true;

    createChip();
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('scroll', hideChipNow, true);

    console.log('UPOE Trade Manager: maxroll trade search ready, planner', state.plannerId);
  }

  // Every planner backed block on the page carries the same profile id
  function findPlannerId() {
    const node = document.querySelector('[data-poe-profile]');
    if (node) return node.getAttribute('data-poe-profile');

    const match = document.body.innerHTML.match(/maxroll\.gg\/poe\/planner\/([A-Za-z0-9]+)/);
    return match ? match[1] : null;
  }

  // Fetched once, on the first hover that needs it, so a guide nobody trades
  // from costs nothing
  async function loadBuild() {
    if (state.build) return state.build;

    const url = `https://planners.maxroll.gg/profiles/poe/${state.plannerId}`;
    const payload = await TradeSearch.fetchJson(url);

    await MaxrollParser.load();

    const build = MaxrollParser.parseProfile(payload);
    if (!build) throw new Error('planner payload had no profiles');

    state.build = build;
    indexItems(build);

    return build;
  }

  // Mentions point at a unique id or a base id, so both are indexed. The name
  // index is the fallback for an item the planner never equipped.
  function indexItems(build) {
    state.byUnique = {};
    state.byName = {};

    for (const raw of Object.values(build.items)) {
      const item = MaxrollParser.parseItem(raw);
      if (!item) continue;

      if (raw.unique) state.byUnique[raw.unique] = item;
      if (item.name) state.byName[item.name.toLowerCase()] = item;

      const base = raw.base ? raw.base.split('/').pop() : null;
      if (base && !state.byUnique[base]) state.byUnique[base] = item;
    }
  }

  function createChip() {
    const chip = document.createElement('button');
    chip.className = 'upoe-trade-chip';
    chip.type = 'button';
    chip.textContent = 'Trade';
    chip.title = 'Search this item on the official trade site';

    chip.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (state.chipTarget) openFor(state.chipTarget);
    });

    chip.addEventListener('mouseenter', () => clearTimeout(state.hideTimer));
    chip.addEventListener('mouseleave', scheduleHideChip);

    document.body.appendChild(chip);
    state.chip = chip;
  }

  // The interactive equipment widget hydrates well after the page loads, so it
  // is reached by delegation rather than by wiring elements up front. Its gear
  // cells carry the slot in a class, poe-PaperdollSlot poe-slot-Weapon, which
  // is the same vocabulary the planner uses for its own slot keys.
  const SLOT_ALIASES = {
    Helmet: 'Helm',
    Weapon1: 'Weapon',
    Weapon2: 'Offhand',
    Shield: 'Offhand',
    Ring1: 'Ring'
  };

  function slotNameOf(node) {
    for (const name of node.classList) {
      if (name.startsWith('poe-slot-')) return name.slice('poe-slot-'.length);
    }
    return null;
  }

  // Which gear set the widget is showing. The header buttons are labelled with
  // the profile names, and the active one carries a hashed _active_ class.
  function activeProfile() {
    const buttons = document.querySelectorAll('[class*="PlannerEquipment__headerButton"]');

    for (const button of buttons) {
      if (!/(^|\s|_)active(_|\s|$)/.test(button.className)) continue;

      const label = (button.textContent || '').trim();
      const match = state.build.profiles.find(profile => profile.name === label);
      if (match) return match;
    }

    // Before anything is clicked the embed still names its starting variant
    const embed = document.querySelector('[data-poe-type=plannerEquipment]');
    const variant = embed && embed.getAttribute('data-poe-variant');
    const byId = variant && state.build.profiles.find(profile => profile.id === variant);

    return byId || state.build.profiles[0] || null;
  }

  function itemInSlot(node) {
    const slot = slotNameOf(node);
    if (!slot) return null;

    const profile = activeProfile();
    if (!profile) return null;

    const slots = profile.slots || {};
    const itemId = slots[slot] !== undefined ? slots[slot]
      : slots[SLOT_ALIASES[slot]];
    if (itemId === undefined) return null;

    const raw = state.build.items[String(itemId)];
    return raw ? MaxrollParser.parseItem(raw) : null;
  }

  // Items and gems share the markup. Items are keyed by an id opening on a
  // capital, gems by a hash, so gems are recognised by their printed name
  // instead. Either way the mention only earns a button if it resolves.
  function mentionKind(node) {
    if (!node || !node.classList || !node.classList.contains('poe-item')) return null;

    const id = node.getAttribute('data-poe-id');
    if (!id) return null;
    if (/^[A-Z]/.test(id)) return 'item';

    // The gem table is only loaded once a build has been fetched, so before
    // that every hash is treated as a candidate and checked on click
    if (!state.build) return 'gem';
    return MaxrollParser.gemByName((node.textContent || '').trim()) ? 'gem' : null;
  }

  // A gear cell in the widget, or an item or gem named in the prose
  function hoverTarget(node) {
    if (!node || !node.closest) return null;

    const cell = node.closest('.poe-PaperdollSlot');
    if (cell) return slotNameOf(cell) ? { kind: 'slot', node: cell } : null;

    const mention = node.closest('span.poe-item');
    const kind = mentionKind(mention);
    return kind ? { kind: kind, node: mention } : null;
  }

  function onMouseOver(event) {
    if (!state.enabled) return;

    const target = hoverTarget(event.target);

    if (!target) {
      if (state.chip && !state.chip.contains(event.target)) scheduleHideChip();
      return;
    }

    clearTimeout(state.hideTimer);
    state.chipTarget = target;

    // A gear cell is a tile with room for the chip inside it, a mention is a
    // run of text that the chip has to sit above
    const box = target.node.getBoundingClientRect();
    const inset = target.kind === 'slot';
    state.chip.style.left = `${box.right - (inset ? 6 : 2)}px`;
    state.chip.style.top = `${box.top - (inset ? 4 : 18)}px`;
    state.chip.classList.add('upoe-visible');
  }

  function scheduleHideChip() {
    clearTimeout(state.hideTimer);
    state.hideTimer = setTimeout(hideChipNow, 250);
  }

  function hideChipNow() {
    if (state.chip) state.chip.classList.remove('upoe-visible');
  }

  // An item the planner equipped comes with its rolls. One it only mentions is
  // still worth searching, and for a unique the name is the whole query anyway.
  function resolve(node) {
    const id = node.getAttribute('data-poe-id');
    const label = (node.textContent || '').trim();

    const equipped = state.byUnique[id] || state.byName[label.toLowerCase()];
    if (equipped) return equipped;

    if (!label) return null;

    return {
      rarity: /^Unique/i.test(id) ? 'UNIQUE' : 'NORMAL',
      name: label,
      baseType: label,
      itemLevel: null, quality: null, corrupted: false,
      armour: null, evasion: null, energyShield: null, sockets: null,
      influences: [], implicits: [], explicits: [],
      mentionOnly: true
    };
  }

  // A gem mention opens on the level and quality the build actually runs,
  // which is the search the reader wants far more often than a blank one
  function openGem(node) {
    const gem = MaxrollParser.gemByName((node.textContent || '').trim());
    if (!gem) return false;

    const setup = (state.build.gemSetups || {})[gem.id] || {};

    TradePanel.openGem({
      name: gem.name,
      maxLevel: gem.maxLevel,
      support: / Support$/.test(gem.name),
      level: setup.level || null,
      quality: setup.quality || null,
      corrupted: setup.corrupted
    });

    return true;
  }

  async function openFor(target) {
    hideChipNow();
    TradePanel.message('Loading build data...');

    try {
      await loadBuild();
    } catch (error) {
      console.error('UPOE Trade Manager: could not load the maxroll planner', error);
      TradePanel.message('Could not load the build data from maxroll.');
      return;
    }

    if (target.kind === 'slot') {
      const equipped = itemInSlot(target.node);
      if (!equipped) {
        TradePanel.message('That slot is empty in the set being shown.');
        return;
      }
      TradePanel.open([equipped], { slot: equipped.slot });
      return;
    }

    if (target.kind === 'gem') {
      if (openGem(target.node)) return;
      TradePanel.message('No gem data for that mention.');
      return;
    }

    const item = resolve(target.node);
    if (!item) {
      TradePanel.message('No item data for that mention.');
      return;
    }

    TradePanel.open([item], { slot: item.slot });
  }

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.settings) return;

    const settings = changes.settings.newValue || {};
    TradePanel.configure(settings);

    const enabled = settings.maxrollTradeEnabled !== false;
    if (enabled === state.enabled) return;

    state.enabled = enabled;
    if (enabled) {
      init();
    } else {
      hideChipNow();
      TradePanel.close();
    }
  });

  init();
})();
