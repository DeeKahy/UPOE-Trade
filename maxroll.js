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

  // Gem and skill mentions share the markup but are keyed by a hash, and an
  // item id always opens on a capital
  function isItemMention(node) {
    if (!node || !node.classList || !node.classList.contains('poe-item')) return false;
    const id = node.getAttribute('data-poe-id');
    return Boolean(id) && /^[A-Z]/.test(id);
  }

  function onMouseOver(event) {
    if (!state.enabled) return;

    const node = event.target.closest ? event.target.closest('span.poe-item') : null;

    if (!isItemMention(node)) {
      if (state.chip && !state.chip.contains(event.target)) scheduleHideChip();
      return;
    }

    clearTimeout(state.hideTimer);
    state.chipTarget = node;

    const box = node.getBoundingClientRect();
    state.chip.style.left = `${box.right - 2}px`;
    state.chip.style.top = `${box.top - 18}px`;
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

  async function openFor(node) {
    hideChipNow();
    TradePanel.message('Loading build data...');

    try {
      await loadBuild();
    } catch (error) {
      console.error('UPOE Trade Manager: could not load the maxroll planner', error);
      TradePanel.message('Could not load the build data from maxroll.');
      return;
    }

    const item = resolve(node);
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
