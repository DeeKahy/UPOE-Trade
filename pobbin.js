// Adds a trade search button to the gear on pobb.in build pages.
// Reads the Path of Building code the page already publishes, resolves each
// hovered slot back to its item, and opens a prefilled official trade search.
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

  const RARITY_CLASSES = {
    NORMAL: 'upoe-rarity-normal',
    MAGIC: 'upoe-rarity-magic',
    RARE: 'upoe-rarity-rare',
    UNIQUE: 'upoe-rarity-unique',
    RELIC: 'upoe-rarity-unique'
  };

  const state = {
    enabled: true,
    started: false,
    build: null,
    buildCode: null,
    statIndex: null,
    leagues: null,
    league: null,
    status: null,
    chip: null,
    chipTarget: null,
    hideTimer: null,
    panel: null
  };

  async function init() {
    try {
      const settings = await Storage.getSettings();
      state.enabled = settings.pobbinTradeEnabled !== false;
      state.status = TradeSearch.normalizeStatus(settings.tradeStatusOption);
    } catch (error) {
      state.enabled = true;
      state.status = TradeSearch.DEFAULT_STATUS;
    }

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
      if (state.chipTarget) openPanel(state.chipTarget);
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

  // Returns every item the hovered image could be, most likely first
  function candidatesFor(image) {
    const slotClass = Array.from(image.classList).find(name => name !== 'item');
    if (!slotClass) return [];

    if (slotClass === 'socket') return jewelCandidates(image);

    const slotName = SLOT_CLASSES[slotClass];
    if (!slotName) return [];

    const set = activeItemSet();
    const itemId = set && set.slots[slotName];
    const item = itemId ? itemFor(itemId) : null;

    return item ? [item] : [];
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

  async function openPanel(image) {
    hideChipNow();

    const candidates = candidatesFor(image);
    if (candidates.length === 0) {
      showMessage('No item data for that slot.');
      return;
    }

    showMessage('Loading trade data...');

    try {
      if (!state.statIndex) state.statIndex = await TradeSearch.getStatIndex();
      if (!state.leagues) state.leagues = await TradeSearch.getLeagues();
      if (!state.league) state.league = state.leagues[0] || 'Standard';
    } catch (error) {
      console.error('UPOE Trade Manager: could not load trade data', error);
      showMessage('Could not reach the trade API. Try again in a moment.');
      return;
    }

    renderPanel(candidates, 0);
  }

  function closePanel() {
    if (state.panel) {
      state.panel.remove();
      state.panel = null;
    }
    document.removeEventListener('keydown', onPanelKeyDown, true);
  }

  function onPanelKeyDown(event) {
    if (event.key === 'Escape') closePanel();
  }

  function showMessage(text) {
    closePanel();

    const panel = buildShell();
    const body = panel.querySelector('.upoe-panel-body');
    const message = document.createElement('p');
    message.className = 'upoe-panel-message';
    message.textContent = text;
    body.appendChild(message);

    document.body.appendChild(panel);
    state.panel = panel;
  }

  function buildShell() {
    const panel = document.createElement('div');
    panel.className = 'upoe-panel';

    const header = document.createElement('div');
    header.className = 'upoe-panel-header';

    const title = document.createElement('span');
    title.className = 'upoe-panel-title';
    title.textContent = 'Trade search';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'upoe-panel-close';
    close.textContent = 'x';
    close.title = 'Close';
    close.addEventListener('click', closePanel);

    header.appendChild(title);
    header.appendChild(close);

    const body = document.createElement('div');
    body.className = 'upoe-panel-body';

    panel.appendChild(header);
    panel.appendChild(body);

    document.addEventListener('keydown', onPanelKeyDown, true);

    return panel;
  }

  function renderPanel(candidates, selected) {
    closePanel();

    const item = candidates[selected];
    const rows = TradeSearch.describeItem(state.statIndex, item);

    const panel = buildShell();
    const body = panel.querySelector('.upoe-panel-body');

    panel.querySelector('.upoe-panel-title').textContent =
      item.name && item.name !== item.baseType ? item.name : item.baseType || 'Item';

    if (item.baseType && item.baseType !== item.name) {
      const base = document.createElement('div');
      base.className = `upoe-panel-base ${RARITY_CLASSES[item.rarity] || ''}`;
      base.textContent = item.baseType;
      body.appendChild(base);
    }

    if (candidates.length > 1) {
      body.appendChild(buildCandidatePicker(candidates, selected));
    }

    const controls = document.createElement('div');
    controls.className = 'upoe-panel-controls';
    controls.appendChild(buildLeaguePicker());
    controls.appendChild(buildStatusPicker());
    body.appendChild(controls);

    const options = document.createElement('div');
    options.className = 'upoe-panel-options';

    const isUnique = item.rarity === 'UNIQUE' || item.rarity === 'RELIC';
    const nameToggle = isUnique && item.name
      ? addToggle(options, `Name: ${item.name}`, true)
      : null;
    const typeToggle = item.baseType && item.rarity !== 'MAGIC'
      ? addToggle(options, `Base type: ${item.baseType}`, true)
      : null;
    const corruptedToggle = item.corrupted
      ? addToggle(options, 'Corrupted only', false)
      : null;

    if (options.childElementCount > 0) body.appendChild(options);

    // Uniques are identified by name, so their rolls start switched off.
    // Rares only exist as a bundle of modifiers, so those start switched on.
    const modList = document.createElement('div');
    modList.className = 'upoe-mod-list';

    const modRows = rows.map(row => buildModRow(row, !isUnique && Boolean(row.stat)));
    for (const entry of modRows) modList.appendChild(entry.element);

    if (modRows.length > 0) {
      const bulk = document.createElement('div');
      bulk.className = 'upoe-bulk-actions';
      bulk.appendChild(bulkButton('Select all', modRows, true));
      bulk.appendChild(bulkButton('Select none', modRows, false));
      body.appendChild(bulk);
    }

    body.appendChild(modList);

    const actions = document.createElement('div');
    actions.className = 'upoe-panel-actions';

    const search = document.createElement('button');
    search.type = 'button';
    search.className = 'upoe-primary';
    search.textContent = 'Open trade search';
    search.addEventListener('click', () => {
      const payload = TradeSearch.buildQuery({
        name: nameToggle && nameToggle.checked ? item.name : null,
        type: typeToggle && typeToggle.checked ? item.baseType : null,
        corrupted: corruptedToggle && corruptedToggle.checked ? true : undefined,
        status: state.status,
        rows: modRows.map(entry => entry.read())
      });

      window.open(TradeSearch.buildUrl(state.league, payload), '_blank', 'noopener');
      closePanel();
    });

    actions.appendChild(search);
    body.appendChild(actions);

    document.body.appendChild(panel);
    state.panel = panel;
  }

  // Label plus dropdown, sharing one column width so the rows line up
  function labelledSelect(name) {
    const label = document.createElement('label');

    const caption = document.createElement('span');
    caption.className = 'upoe-control-name';
    caption.textContent = name;

    const select = document.createElement('select');

    label.appendChild(caption);
    label.appendChild(select);

    return { label: label, select: select };
  }

  function buildCandidatePicker(candidates, selected) {
    const wrapper = document.createElement('div');
    wrapper.className = 'upoe-panel-controls';

    const { label, select } = labelledSelect('Jewel');

    candidates.forEach((candidate, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = candidate.name || candidate.baseType || `Item ${index + 1}`;
      if (index === selected) option.selected = true;
      select.appendChild(option);
    });

    select.addEventListener('change', () => {
      renderPanel(candidates, Number(select.value));
    });

    wrapper.appendChild(label);

    return wrapper;
  }

  function buildLeaguePicker() {
    const { label, select } = labelledSelect('League');

    for (const league of state.leagues) {
      const option = document.createElement('option');
      option.value = league;
      option.textContent = league;
      if (league === state.league) option.selected = true;
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      state.league = select.value;
    });

    return label;
  }

  // Overrides the default listing type from the options page for this one search
  function buildStatusPicker() {
    const { label, select } = labelledSelect('Listing');

    for (const option of TradeSearch.STATUS_OPTIONS) {
      const element = document.createElement('option');
      element.value = option.id;
      element.textContent = option.text;
      if (option.id === state.status) element.selected = true;
      select.appendChild(element);
    }

    select.addEventListener('change', () => {
      state.status = select.value;
    });

    return label;
  }

  function addToggle(container, text, checked) {
    const label = document.createElement('label');
    label.className = 'upoe-toggle';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;

    const caption = document.createElement('span');
    caption.textContent = text;

    label.appendChild(input);
    label.appendChild(caption);
    container.appendChild(label);

    return input;
  }

  function buildModRow(row, checked) {
    const element = document.createElement('div');
    element.className = 'upoe-mod-row';
    if (!row.stat) element.classList.add('upoe-mod-unmatched');

    const label = document.createElement('label');
    label.className = 'upoe-mod-label';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = Boolean(row.stat) && checked;
    input.disabled = !row.stat;

    const text = document.createElement('span');
    text.textContent = row.text;
    if (row.implicit) text.classList.add('upoe-mod-implicit');

    label.appendChild(input);
    label.appendChild(text);
    element.appendChild(label);

    let minField = null;
    if (row.stat) {
      minField = document.createElement('input');
      minField.type = 'number';
      minField.className = 'upoe-mod-min';
      minField.step = 'any';
      minField.placeholder = 'min';
      if (row.min !== null && row.min !== undefined) minField.value = String(row.min);
      element.appendChild(minField);
    } else {
      const note = document.createElement('span');
      note.className = 'upoe-mod-note';
      note.textContent = 'no trade stat';
      element.appendChild(note);
    }

    return {
      element: element,
      toggle: input,
      read() {
        const raw = minField && minField.value !== '' ? Number(minField.value) : null;
        return {
          enabled: input.checked,
          stat: row.stat,
          min: raw === null || Number.isNaN(raw) ? null : raw
        };
      }
    };
  }

  function bulkButton(text, modRows, checked) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'upoe-link-button';
    button.textContent = text;

    button.addEventListener('click', () => {
      for (const entry of modRows) {
        if (!entry.toggle.disabled) entry.toggle.checked = checked;
      }
    });

    return button;
  }

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.settings) return;

    state.status = TradeSearch.normalizeStatus(changes.settings.newValue.tradeStatusOption);

    const enabled = changes.settings.newValue.pobbinTradeEnabled !== false;
    if (enabled === state.enabled) return;

    state.enabled = enabled;
    if (enabled) {
      init();
    } else {
      hideChipNow();
      closePanel();
    }
  });

  init();
})();
