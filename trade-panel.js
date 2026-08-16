// The trade search panel, shared by every site the extension supports.
// A host page hands it an item plus a slot and it renders the search, so
// pobb.in and maxroll differ only in how they find the item, not in what the
// user sees or in the query that comes out the other side.

const TradePanel = {
  RARITY_CLASSES: {
    NORMAL: 'upoe-rarity-normal',
    MAGIC: 'upoe-rarity-magic',
    RARE: 'upoe-rarity-rare',
    UNIQUE: 'upoe-rarity-unique',
    RELIC: 'upoe-rarity-unique'
  },

  state: {
    node: null,
    league: null,
    leagues: [],
    status: null,
    minPercent: null,
    onKeyDown: null
  },

  configure(settings) {
    this.state.status = TradeSearch.normalizeStatus(settings.tradeStatusOption);
    this.state.minPercent = TradeSearch.normalizeMinPercent(
      settings.tradeMinPercent === undefined
        ? TradeSearch.DEFAULT_MIN_PERCENT
        : settings.tradeMinPercent
    );
  },

  close() {
    if (this.state.node) {
      this.state.node.remove();
      this.state.node = null;
    }
    if (this.state.onKeyDown) {
      document.removeEventListener('keydown', this.state.onKeyDown, true);
      this.state.onKeyDown = null;
    }
  },

  shell() {
    this.close();

    const panel = document.createElement('div');
    panel.className = 'upoe-panel';

    const header = document.createElement('div');
    header.className = 'upoe-panel-header';

    const title = document.createElement('span');
    title.className = 'upoe-panel-title';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'upoe-panel-close';
    close.textContent = 'x';
    close.title = 'Close';
    close.addEventListener('click', () => this.close());

    header.appendChild(title);
    header.appendChild(close);

    const body = document.createElement('div');
    body.className = 'upoe-panel-body';

    panel.appendChild(header);
    panel.appendChild(body);

    this.state.onKeyDown = event => {
      if (event.key === 'Escape') this.close();
    };
    document.addEventListener('keydown', this.state.onKeyDown, true);

    return panel;
  },

  message(text) {
    const panel = this.shell();
    panel.querySelector('.upoe-panel-title').textContent = 'Trade search';

    const message = document.createElement('p');
    message.className = 'upoe-panel-message';
    message.textContent = text;
    panel.querySelector('.upoe-panel-body').appendChild(message);

    document.body.appendChild(panel);
    this.state.node = panel;
  },

  // Loads the trade data once, then renders. Candidates are alternatives for
  // the same hover, which happens for tree jewels that share artwork.
  async open(candidates, options) {
    const list = (candidates || []).filter(Boolean);
    if (list.length === 0) {
      this.message('No item data for that slot.');
      return;
    }

    this.message('Loading trade data...');

    let index;
    try {
      index = await TradeSearch.getStatIndex();
      if (this.state.leagues.length === 0) {
        this.state.leagues = await TradeSearch.getLeagues();
      }
      if (!this.state.league) {
        this.state.league = this.state.leagues[0] || 'Standard';
      }
    } catch (error) {
      console.error('UPOE Trade Manager: could not load trade data', error);
      this.message('Could not reach the trade API. Try again in a moment.');
      return;
    }

    this.render(index, list, 0, options || {});
  },

  // Gems carry no modifiers, so the whole search is the name plus level,
  // quality and whether it is corrupted
  renderGem(gem) {
    const panel = this.shell();
    const body = panel.querySelector('.upoe-panel-body');

    panel.querySelector('.upoe-panel-title').textContent = gem.name;

    const base = document.createElement('div');
    base.className = 'upoe-panel-base upoe-rarity-gem';
    base.textContent = gem.support ? 'Support gem' : 'Skill gem';
    body.appendChild(base);

    const controls = document.createElement('div');
    controls.className = 'upoe-panel-controls';
    controls.appendChild(this.leaguePicker());
    controls.appendChild(this.statusPicker());
    body.appendChild(controls);

    const level = this.numberRow(body, 'Minimum level', gem.level, 0, gem.maxLevel || 21);
    const quality = this.numberRow(body, 'Minimum quality', gem.quality, 0, 23);
    const corrupted = this.gemCorruptedPicker(body, gem.corrupted);

    const actions = document.createElement('div');
    actions.className = 'upoe-panel-actions';

    const search = document.createElement('button');
    search.type = 'button';
    search.className = 'upoe-primary';
    search.textContent = 'Search on Trade';
    search.addEventListener('click', () => {
      const payload = TradeSearch.buildQuery({
        target: { type: gem.name },
        gem: {
          level: level.read(),
          quality: quality.read(),
          corrupted: corrupted.read()
        },
        minPercent: this.state.minPercent,
        status: this.state.status
      });

      window.open(TradeSearch.buildUrl(this.state.league, payload), '_blank', 'noopener');
      this.close();
    });

    actions.appendChild(search);
    body.appendChild(actions);

    document.body.appendChild(panel);
    this.state.node = panel;
  },

  // A labelled number box that can be cleared to drop the filter entirely
  numberRow(parent, name, value, min, max) {
    const wrapper = this.section(parent, name);

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'upoe-mod-min upoe-gem-number';
    input.min = String(min);
    input.max = String(max);
    input.placeholder = 'any';
    if (value !== null && value !== undefined) input.value = String(value);

    wrapper.appendChild(input);

    return {
      read() {
        if (input.value === '') return null;
        const parsed = Number(input.value);
        return Number.isNaN(parsed) ? null : parsed;
      }
    };
  },

  gemCorruptedPicker(parent, corrupted) {
    const wrapper = this.section(parent, 'Corrupted');
    const { label, select } = this.labelledSelect('');

    const choices = [
      { value: 'any', text: 'Either' },
      { value: 'false', text: 'Not corrupted' },
      { value: 'true', text: 'Corrupted' }
    ];

    // The build says what it uses, so that is the sensible starting point
    const initial = corrupted === true ? 'true' : (corrupted === false ? 'false' : 'any');

    for (const choice of choices) {
      const option = document.createElement('option');
      option.value = choice.value;
      option.textContent = choice.text;
      if (choice.value === initial) option.selected = true;
      select.appendChild(option);
    }

    wrapper.appendChild(label);

    return {
      read() {
        if (select.value === 'true') return true;
        if (select.value === 'false') return false;
        return undefined;
      }
    };
  },

  async openGem(gem) {
    this.message('Loading trade data...');

    try {
      if (this.state.leagues.length === 0) {
        this.state.leagues = await TradeSearch.getLeagues();
      }
      if (!this.state.league) {
        this.state.league = this.state.leagues[0] || 'Standard';
      }
    } catch (error) {
      console.error('UPOE Trade Manager: could not load trade data', error);
      this.message('Could not reach the trade API. Try again in a moment.');
      return;
    }

    this.renderGem(gem);
  },

  render(index, candidates, selected, options) {
    const item = candidates[selected];
    const plan = TradeSearch.describeItem(index, item, { slot: options.slot });

    const panel = this.shell();
    const body = panel.querySelector('.upoe-panel-body');

    panel.querySelector('.upoe-panel-title').textContent =
      item.name && item.name !== item.baseType ? item.name : item.baseType || 'Item';

    if (item.baseType && item.baseType !== item.name) {
      const base = document.createElement('div');
      base.className = `upoe-panel-base ${this.RARITY_CLASSES[item.rarity] || ''}`;
      base.textContent = item.baseType;
      body.appendChild(base);
    }

    if (candidates.length > 1) {
      body.appendChild(this.candidatePicker(index, candidates, selected, options));
    }

    const controls = document.createElement('div');
    controls.className = 'upoe-panel-controls';
    controls.appendChild(this.leaguePicker());
    controls.appendChild(this.statusPicker());
    body.appendChild(controls);

    const target = this.searchByChips(body, plan);
    const sockets = this.socketChips(body, plan);
    const properties = this.checkList(body, 'Properties', plan.properties,
      row => `${row.label}: ${row.value}`);
    const pseudo = this.checkList(body, 'Pseudo', plan.pseudo,
      row => `+${row.value} ${row.label}`);
    const mods = this.modList(body, plan);
    const corrupted = this.corruptedToggle(body, item);
    this.strictnessSlider(body);

    const actions = document.createElement('div');
    actions.className = 'upoe-panel-actions';

    const search = document.createElement('button');
    search.type = 'button';
    search.className = 'upoe-primary';
    search.textContent = 'Search on Trade';
    search.addEventListener('click', () => {
      const payload = TradeSearch.buildQuery({
        target: target.read(),
        pseudo: pseudo.read(),
        properties: properties.read(),
        rows: mods.read(),
        sockets: sockets.read(),
        corrupted: corrupted.read(),
        minPercent: this.state.minPercent,
        status: this.state.status
      });

      window.open(TradeSearch.buildUrl(this.state.league, payload), '_blank', 'noopener');
      this.close();
    });

    actions.appendChild(search);
    body.appendChild(actions);

    document.body.appendChild(panel);
    this.state.node = panel;
  },

  section(parent, name) {
    const wrapper = document.createElement('div');
    wrapper.className = 'upoe-section';

    const heading = document.createElement('div');
    heading.className = 'upoe-section-title';
    heading.textContent = name;

    wrapper.appendChild(heading);
    parent.appendChild(wrapper);

    return wrapper;
  },

  // Chips that widen the search from the exact item out to its whole category
  searchByChips(parent, plan) {
    const targets = plan.searchTargets;
    if (targets.length === 0) {
      return { read: () => ({}) };
    }

    const wrapper = this.section(parent, 'Search by');
    const row = document.createElement('div');
    row.className = 'upoe-chip-row';

    let chosen = 0;
    const chips = targets.map((target, position) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'upoe-chip';
      chip.textContent = target.label;
      if (position === chosen) chip.classList.add('upoe-chip-on');

      chip.addEventListener('click', () => {
        chosen = position;
        for (const other of chips) other.classList.remove('upoe-chip-on');
        chip.classList.add('upoe-chip-on');
      });

      row.appendChild(chip);
      return chip;
    });

    wrapper.appendChild(row);

    return { read: () => targets[chosen] };
  },

  socketChips(parent, plan) {
    const sockets = plan.sockets;
    if (!sockets || sockets.links < 2) {
      return { read: () => ({ mode: 'any' }) };
    }

    const wrapper = this.section(parent, 'Links');
    const row = document.createElement('div');
    row.className = 'upoe-chip-row';

    const options = [
      { mode: 'any', label: 'Any' },
      { mode: 'links', label: `${sockets.links}-link` },
      { mode: 'colours', label: `${sockets.links}-link + colours` }
    ];

    // A six link is the reason the item is worth what it is, so it leads
    let chosen = sockets.links >= 5 ? 1 : 0;

    const chips = options.map((option, position) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'upoe-chip';
      chip.textContent = option.label;
      if (position === chosen) chip.classList.add('upoe-chip-on');

      chip.addEventListener('click', () => {
        chosen = position;
        for (const other of chips) other.classList.remove('upoe-chip-on');
        chip.classList.add('upoe-chip-on');
      });

      row.appendChild(chip);
      return chip;
    });

    wrapper.appendChild(row);

    return {
      read: () => ({
        mode: options[chosen].mode,
        links: sockets.links,
        colours: sockets.colours
      })
    };
  },

  // Properties and pseudo totals share one shape: a checkbox and a label
  checkList(parent, name, rows, describe) {
    if (!rows || rows.length === 0) {
      return { read: () => [] };
    }

    const wrapper = this.section(parent, name);
    const entries = rows.map(row => {
      const label = document.createElement('label');
      label.className = 'upoe-check';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = row.enabled !== false;

      const caption = document.createElement('span');
      caption.textContent = describe(row);

      label.appendChild(input);
      label.appendChild(caption);
      wrapper.appendChild(label);

      return { row: row, input: input };
    });

    return {
      read: () => entries.map(entry => Object.assign({}, entry.row, {
        enabled: entry.input.checked
      }))
    };
  },

  modList(parent, plan) {
    const rows = plan.mods;
    if (rows.length === 0) {
      return { read: () => [] };
    }

    const wrapper = this.section(parent, 'Modifiers');

    const bulk = document.createElement('div');
    bulk.className = 'upoe-bulk-actions';
    wrapper.appendChild(bulk);

    const list = document.createElement('div');
    list.className = 'upoe-mod-list';
    wrapper.appendChild(list);

    const entries = rows.map(row => {
      const element = document.createElement('div');
      element.className = 'upoe-mod-row';
      if (!row.stat) element.classList.add('upoe-mod-unmatched');
      if (row.superseded) element.classList.add('upoe-mod-superseded');

      const label = document.createElement('label');
      label.className = 'upoe-mod-label';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = row.enabled;
      input.disabled = !row.stat;

      const text = document.createElement('span');
      text.textContent = row.text;
      if (row.implicit) text.classList.add('upoe-mod-implicit');

      label.appendChild(input);
      label.appendChild(text);

      // The badge says why a roll is switched off, so a search that looks
      // short is explainable rather than just wrong
      if (row.local) label.appendChild(this.badge('local'));
      else if (row.pseudoParts) label.appendChild(this.badge('pseudo'));

      element.appendChild(label);

      let minField = null;
      if (row.stat) {
        minField = document.createElement('input');
        minField.type = 'number';
        minField.className = 'upoe-mod-min';
        minField.step = 'any';
        minField.placeholder = 'min';
        element.appendChild(minField);
      } else {
        const note = document.createElement('span');
        note.className = 'upoe-mod-note';
        note.textContent = 'no trade stat';
        element.appendChild(note);
      }

      list.appendChild(element);

      return {
        row: row,
        toggle: input,
        read() {
          const typed = minField && minField.value !== '' ? Number(minField.value) : null;
          return {
            enabled: input.checked,
            stat: row.stat,
            // An empty box means "relax this like everything else", a typed
            // number means the user knows what they want
            min: typed === null || Number.isNaN(typed) ? row.min : typed,
            exact: typed !== null && !Number.isNaN(typed)
          };
        }
      };
    });

    bulk.appendChild(this.linkButton('Select all', () => {
      for (const entry of entries) {
        if (!entry.toggle.disabled) entry.toggle.checked = true;
      }
    }));
    bulk.appendChild(this.linkButton('Select none', () => {
      for (const entry of entries) entry.toggle.checked = false;
    }));
    bulk.appendChild(this.linkButton('Reset', () => {
      for (const entry of entries) entry.toggle.checked = entry.row.enabled;
    }));

    return { read: () => entries.map(entry => entry.read()) };
  },

  badge(text) {
    const badge = document.createElement('span');
    badge.className = 'upoe-badge';
    badge.textContent = text;
    return badge;
  },

  linkButton(text, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'upoe-link-button';
    button.textContent = text;
    button.addEventListener('click', onClick);
    return button;
  },

  corruptedToggle(parent, item) {
    if (!item.corrupted) {
      return { read: () => undefined };
    }

    const wrapper = this.section(parent, 'Corruption');
    const label = document.createElement('label');
    label.className = 'upoe-check';

    const input = document.createElement('input');
    input.type = 'checkbox';

    const caption = document.createElement('span');
    caption.textContent = 'Corrupted only';

    label.appendChild(input);
    label.appendChild(caption);
    wrapper.appendChild(label);

    return { read: () => (input.checked ? true : undefined) };
  },

  // One control relaxes every numeric roll at once, which is the difference
  // between a search that returns nothing and one that returns the market
  strictnessSlider(parent) {
    const wrapper = document.createElement('div');
    wrapper.className = 'upoe-strictness';

    const caption = document.createElement('span');
    caption.className = 'upoe-strictness-label';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.step = '5';
    slider.value = String(this.state.minPercent);

    const describe = () => {
      caption.textContent = `Min: ${this.state.minPercent}%`;
      caption.title = this.state.minPercent >= 100
        ? 'Every roll must match the build item or beat it'
        : 'Each roll is relaxed to this share of the build item';
    };

    // Redrawing on every nudge would lose the toggles, so the slider only
    // stores the value and the query reads it when the search is opened
    slider.addEventListener('input', () => {
      this.state.minPercent = TradeSearch.normalizeMinPercent(slider.value);
      describe();
    });

    describe();
    wrapper.appendChild(caption);
    wrapper.appendChild(slider);
    parent.appendChild(wrapper);
  },

  labelledSelect(name) {
    const label = document.createElement('label');

    const caption = document.createElement('span');
    caption.className = 'upoe-control-name';
    caption.textContent = name;

    const select = document.createElement('select');

    label.appendChild(caption);
    label.appendChild(select);

    return { label: label, select: select };
  },

  candidatePicker(index, candidates, selected, options) {
    const wrapper = document.createElement('div');
    wrapper.className = 'upoe-panel-controls';

    const { label, select } = this.labelledSelect('Item');

    candidates.forEach((candidate, position) => {
      const option = document.createElement('option');
      option.value = String(position);
      option.textContent = candidate.name || candidate.baseType || `Item ${position + 1}`;
      if (position === selected) option.selected = true;
      select.appendChild(option);
    });

    select.addEventListener('change', () => {
      this.render(index, candidates, Number(select.value), options);
    });

    wrapper.appendChild(label);
    return wrapper;
  },

  leaguePicker() {
    const { label, select } = this.labelledSelect('League');

    for (const league of this.state.leagues) {
      const option = document.createElement('option');
      option.value = league;
      option.textContent = league;
      if (league === this.state.league) option.selected = true;
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      this.state.league = select.value;
    });

    return label;
  },

  statusPicker() {
    const { label, select } = this.labelledSelect('Listing');

    for (const option of TradeSearch.STATUS_OPTIONS) {
      const element = document.createElement('option');
      element.value = option.id;
      element.textContent = option.text;
      if (option.id === this.state.status) element.selected = true;
      select.appendChild(element);
    }

    select.addEventListener('change', () => {
      this.state.status = select.value;
    });

    return label;
  }
};

if (typeof window !== 'undefined') {
  window.TradePanel = TradePanel;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TradePanel;
}
