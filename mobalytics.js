// Adds trade search to mobalytics Path of Exile build guides.
//
// Mobalytics publishes the build's Path of Building code in a field on the
// page, so unlike maxroll there is nothing to distil: the existing PobParser
// reads it directly. The work here is matching what the page draws back to
// what the code contains.
//
// Two surfaces carry items. Inline mentions are marked up as
// [data-testid="static-data-widget"] and name the item in their text, and the
// equipment grid draws bare images whose art file names the item. Class names
// are hashed by the build tooling and change between deploys, so nothing here
// depends on one.
(function() {
  'use strict';

  const state = {
    enabled: true,
    started: false,
    build: null,
    code: null,
    byName: null,
    chip: null,
    chipTarget: null,
    hideTimer: null
  };

  async function init() {
    let settings;
    try {
      settings = await Storage.getSettings();
      state.enabled = settings.mobalyticsTradeEnabled !== false;
    } catch (error) {
      settings = {};
      state.enabled = true;
    }

    TradePanel.configure(settings);

    if (!state.enabled) {
      console.log('UPOE Trade Manager: mobalytics trade search disabled');
      return;
    }
    if (state.started) return;

    state.started = true;

    createChip();
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('scroll', hideChipNow, true);

    console.log('UPOE Trade Manager: mobalytics trade search ready');
  }

  // The field is keyed by id, with a scan for a long deflate payload as backup
  // in case that id shifts. "eNr" is base64 for a zlib header.
  function readBuildCode() {
    const field = document.getElementById('poe2PobCode');
    if (field && field.value) return field.value.trim();

    for (const node of document.querySelectorAll('input, textarea')) {
      const value = (node.value || '').trim();
      if (value.length > 500 && /^eNr/.test(value)) return value;
    }

    return null;
  }

  async function loadBuild() {
    const code = readBuildCode();
    if (!code) return null;
    if (state.build && code === state.code) return state.build;

    const xml = await PobParser.decodeBuildCode(code);
    state.build = PobParser.parseBuild(xml);
    state.code = code;
    indexItems(state.build);

    return state.build;
  }

  // Everything is matched on a squashed name so that "Le Heup of All" lines up
  // with the Leheupofall its art file is called
  function squash(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function indexItems(build) {
    state.byName = {};

    for (const id of Object.keys(build.items)) {
      const entry = build.items[id];
      const item = PobParser.parseItem(entry.text, entry.variant);
      if (!item) continue;

      for (const label of [item.name, item.baseType]) {
        const key = squash(label);
        // A base type is a weaker claim than a name, so it never displaces one
        if (key && !state.byName[key]) state.byName[key] = item;
      }
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

  // Gem art is named after the gem, so PenanceBrandGem and FrostblinkSkillGem
  // both reduce to something the build code knows once the suffix is off. Gear
  // art mostly is not: a ring drawn from BreachlordRingUnique_AllCombined gives
  // nothing to match on, which is why an image without alt text usually ends up
  // with no button rather than a wrong one.
  function labelFromImage(image) {
    if ((image.alt || '').trim()) return image.alt.trim();

    const file = (image.getAttribute('src') || '').split('/').pop() || '';
    return file.replace(/\.\w+$/, '').replace(/(SkillGem|Gem|Unique\d*)$/, '');
  }

  function labelFor(node) {
    const raw = node.tagName === 'IMG'
      ? labelFromImage(node)
      : (node.textContent || '');

    // Mentions qualify the item for the reader, "Cinderswallow Urn (ES on
    // Kill)", and the qualifier is not part of the name
    return String(raw).replace(/\s*\([^)]*\)\s*$/, '').trim();
  }

  // A page element only earns a button if the build code actually knows it
  function hoverTarget(node) {
    if (!node || !node.closest) return null;

    const image = node.closest('img[src*="2DItems"], img[src*="/Gems/"]');
    if (image) return resolvable(image);

    const mention = node.closest('[data-testid="static-data-widget"]');
    if (mention) return resolvable(mention);

    return null;
  }

  function resolvable(node) {
    // Before the code is parsed everything is a candidate, checked on click
    if (!state.build) return { node: node };

    return lookup(labelFor(node)) ? { node: node } : null;
  }

  // Gems and items share both surfaces, so the build code decides which it is
  function lookup(label) {
    const key = squash(label);
    if (!key) return null;

    const gems = state.build.gems || {};
    for (const gem of Object.values(gems)) {
      if (squash(gem.name) === key || squash(gem.name.replace(/ Support$/, '')) === key) {
        return { kind: 'gem', gem: gem };
      }
    }

    const item = state.byName[key];
    return item ? { kind: 'item', item: item } : null;
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

    const box = target.node.getBoundingClientRect();
    const tile = target.node.tagName === 'IMG';
    state.chip.style.left = `${box.right - (tile ? 6 : 2)}px`;
    state.chip.style.top = `${box.top - (tile ? 4 : 18)}px`;
    state.chip.classList.add('upoe-visible');
  }

  function scheduleHideChip() {
    clearTimeout(state.hideTimer);
    state.hideTimer = setTimeout(hideChipNow, 250);
  }

  function hideChipNow() {
    if (state.chip) state.chip.classList.remove('upoe-visible');
  }

  async function openFor(target) {
    hideChipNow();
    TradePanel.message('Loading build data...');

    try {
      const build = await loadBuild();
      if (!build) {
        TradePanel.message('No Path of Building code on this page.');
        return;
      }
    } catch (error) {
      console.error('UPOE Trade Manager: could not decode the build code', error);
      TradePanel.message('Could not read the build code on this page.');
      return;
    }

    const found = lookup(labelFor(target.node));
    if (!found) {
      TradePanel.message('That one is not in the build code.');
      return;
    }

    if (found.kind === 'gem') {
      TradePanel.openGem({
        name: found.gem.name,
        support: found.gem.support,
        maxLevel: 21,
        level: found.gem.level,
        quality: found.gem.quality,
        corrupted: undefined
      });
      return;
    }

    TradePanel.open([found.item], {});
  }

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.settings) return;

    const settings = changes.settings.newValue || {};
    TradePanel.configure(settings);

    const enabled = settings.mobalyticsTradeEnabled !== false;
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
