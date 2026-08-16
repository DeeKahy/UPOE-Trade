// Adds a trade search button to the gear on pobb.in build pages.
// Reads the Path of Building code the page already publishes, resolves each
// hovered slot back to its item, and hands it to the shared trade panel.
(function() {
  'use strict';

  // pobb.in tags every gear image with the slot it occupies
  const SLOT_CLASSES = {
    weapon1: 'Weapon 1',
    weapon2: 'Weapon 2',
    helmet: 'Helmet',
    body_armour: 'Body Armour',
    gloves: 'Gloves',
    boots: 'Boots',
    belt: 'Belt',
    amulet: 'Amulet',
    ring1: 'Ring 1',
    ring2: 'Ring 2',
    flask1: 'Flask 1',
    flask2: 'Flask 2',
    flask3: 'Flask 3',
    flask4: 'Flask 4',
    flask5: 'Flask 5'
  };

  const state = {
    enabled: true,
    started: false,
    build: null,
    buildCode: null,
    chip: null,
    chipTarget: null,
    hideTimer: null
  };

  async function init() {
    let settings;
    try {
      settings = await Storage.getSettings();
      state.enabled = settings.pobbinTradeEnabled !== false;
    } catch (error) {
      settings = {};
      state.enabled = true;
    }

    TradePanel.configure(settings);

    if (!state.enabled) {
      console.log('UPOE Trade Manager: pobb.in trade search disabled');
      return;
    }

    if (state.started) return;

    const loaded = await loadBuild();
    if (!loaded) {
      console.log('UPOE Trade Manager: no Path of Building code on this page');
      return;
    }

    state.started = true;

    createChip();
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('scroll', hideChipNow, true);

    // pobb.in swaps the build in place when navigating between pages
    watchForBuildChanges();

    console.log('UPOE Trade Manager: pobb.in trade search ready');
  }

  // The build code sits in a readonly textarea, with the raw endpoint as backup
  async function loadBuild() {
    const code = readBuildCode() || await fetchBuildCode();
    if (!code || code === state.buildCode) return Boolean(state.build);

    try {
      const xml = await PobParser.decodeBuildCode(code);
      state.build = PobParser.parseBuild(xml);
      state.buildCode = code;
      return true;
    } catch (error) {
      console.error('UPOE Trade Manager: could not decode the build code', error);
      return false;
    }
  }

  function readBuildCode() {
    const field = document.querySelector('textarea[aria-label="Path of Building buildcode"]');
    return field && field.value ? field.value.trim() : null;
  }

  async function fetchBuildCode() {
    const id = window.location.pathname.split('/').filter(Boolean).pop();
    if (!id) return null;

    try {
      const response = await fetch(`${window.location.origin}/${id}/raw`);
      if (!response.ok) return null;
      return (await response.text()).trim();
    } catch (error) {
      return null;
    }
  }

  function watchForBuildChanges() {
    let pending = null;

    const observer = new MutationObserver(() => {
      clearTimeout(pending);
      pending = setTimeout(() => {
        const code = readBuildCode();
        if (code && code !== state.buildCode) loadBuild();
      }, 400);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Floating button, kept outside the page's own tree so re-renders cannot
  // clobber it
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

  function onMouseOver(event) {
    if (!state.enabled) return;

    const image = event.target.closest ? event.target.closest('img.item') : null;

    if (!image) {
      if (state.chip && !state.chip.contains(event.target)) scheduleHideChip();
      return;
    }

    clearTimeout(state.hideTimer);
    state.chipTarget = image;

    const box = image.getBoundingClientRect();
    state.chip.style.left = `${box.right - 6}px`;
    state.chip.style.top = `${box.top - 4}px`;
    state.chip.classList.add('upoe-visible');
  }

  function scheduleHideChip() {
    clearTimeout(state.hideTimer);
    state.hideTimer = setTimeout(hideChipNow, 250);
  }

  function hideChipNow() {
    if (state.chip) state.chip.classList.remove('upoe-visible');
  }

  function selectedIndexFor(label) {
    const select = document.querySelector(`select[aria-label="${label}"]`);
    return select ? select.selectedIndex : -1;
  }

  // Which gear set the page is currently showing
  function activeItemSet() {
    const index = selectedIndexFor('Select gear set');
    const sets = state.build.itemSets;
    if (index >= 0 && sets[index]) return sets[index];
    return sets[state.build.activeItemSet] || sets[0] || null;
  }

  // Socketed jewels come from the passive tree, which the loadout picker drives.
  // Its first option is a placeholder, so the values are shifted by one.
  function activeTreeSpec() {
    const select = document.querySelector('select[aria-label="Select loadout"]');
    const specs = state.build.treeSpecs;

    if (select) {
      const value = Number(select.value);
      if (value > 0 && specs[value - 1]) return specs[value - 1];
    }

    return specs[state.build.activeSpec] || specs[specs.length - 1] || null;
  }

  function itemFor(itemId) {
    const entry = state.build.items[itemId];
    if (!entry) return null;

    const parsed = PobParser.parseItem(entry.text, entry.variant);
    if (parsed) parsed.itemId = itemId;
    return parsed;
  }

  // Returns the slot plus every item the hovered image could be, likeliest first
  function resolve(image) {
    const slotClass = Array.from(image.classList).find(name => name !== 'item');
    if (!slotClass) return null;

    if (slotClass === 'socket') {
      return { slot: 'Jewel', candidates: jewelCandidates(image) };
    }

    const slotName = SLOT_CLASSES[slotClass];
    if (!slotName) return null;

    const set = activeItemSet();
    const itemId = set && set.slots[slotName];
    const item = itemId ? itemFor(itemId) : null;

    return { slot: slotName, candidates: item ? [item] : [] };
  }

  // Jewel images are not labelled with their socket, so match on the artwork
  // name and fall back to document order when a build has duplicates
  function jewelCandidates(image) {
    const spec = activeTreeSpec();
    if (!spec) return [];

    const jewels = spec.jewels
      .map(socket => itemFor(socket.itemId))
      .filter(Boolean);

    const alt = image.getAttribute('alt') || '';
    const matching = jewels.filter(item => item.name === alt || item.baseType === alt);
    if (matching.length <= 1) return matching.length ? matching : jewels;

    const images = Array.from(document.querySelectorAll('img.item.socket'))
      .filter(candidate => (candidate.getAttribute('alt') || '') === alt);
    const position = images.indexOf(image);

    if (position <= 0) return matching;

    // Put the positional guess first but keep the rest selectable
    const ordered = matching.slice();
    const [guess] = ordered.splice(Math.min(position, ordered.length - 1), 1);
    ordered.unshift(guess);

    return ordered;
  }

  function openFor(image) {
    hideChipNow();

    const resolved = resolve(image);
    if (!resolved) {
      TradePanel.message('No item data for that slot.');
      return;
    }

    TradePanel.open(resolved.candidates, { slot: resolved.slot });
  }

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.settings) return;

    const settings = changes.settings.newValue || {};
    TradePanel.configure(settings);

    const enabled = settings.pobbinTradeEnabled !== false;
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
