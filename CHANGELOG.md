# Changelog

All notable changes to the UPOE Trade Manager extension will be documented in this file.

## [1.1.0] - 2026-08-16

### Added
- Trade search on maxroll Path of Exile build guides, covering the items named
  in the guide text and the gear cells in the interactive equipment widget.
  Switching between the Campaign, Early, Midgame, Late and Aspirational sets
  changes which item a cell searches for
- Trade search on mobalytics build guides, covering the items named in the
  guide text and the gear tab. Gear tiles are read from the tooltip the page
  shows on hover, so they carry their real modifiers
- Gem searches, with minimum level, minimum quality and a corrupted choice.
  The panel opens on the level and quality the build actually runs. Available
  on maxroll, mobalytics and pobb.in
- Pseudo modifiers. Life and resistance rolls are combined into the total life
  and total resistance filters the trade site indexes, which is what makes a
  rare search return results at all
- Property filters for armour, evasion and energy shield, replacing the local
  modifiers that the trade site does not index separately
- Search by options for widening a search from a unique name to its base type
  or to the whole item category
- Link and socket colour filters for linked items
- Roll strictness, defaulting to 80%, so a search asks for a share of the
  build item's roll rather than the exact value. Configurable in the settings

### Changed
- Rewrote the pobb.in trade search around the filters the trade site actually
  indexes. Local modifiers such as increased armour are no longer searched as
  modifiers, since the property filters already cover them
- The trade panel is shared by every supported site, so a search built on
  maxroll, mobalytics and pobb.in behaves identically

### Fixed
- Stable releases never reached the add-on site. The same version was signed on
  both channels, which is not allowed, and the failure was being swallowed

## [1.0.2] - 2026-08-01

### Added
- pobb.in trade search. Hovering a piece of gear on a pobb.in build page shows a
  Trade button that opens a prefilled search on the official trade site
- Modifier picker so each roll can be included, excluded or given a different
  minimum before the search is opened
- Default Listing Type setting, covering all five listing types the trade site
  offers: Instant Buyout and In Person, Instant Buyout, In Person (Online in
  League), In Person (Online) and Any
- League picker, per-search listing type override and a corrupted-only toggle
  for corrupted items
- Option to turn the pobb.in integration off in the extension settings

### Changed
- Trade stat definitions and the league list are fetched from the official trade
  API and cached locally for a day

## [1.0.0] - 2026-02-09

### Added
- Initial release of UPOE Trade Manager
- Save trade searches with custom names
- Organize searches into categories
- Default "Uncategorized" category
- Create, edit, and delete categories
- Move searches between categories
- Native Firefox sidebar integration
- Filter searches by name
- Export searches to JSON
- Import searches from JSON backup
- Toggle fuzzy search feature
- Auto-prepend tilde (~) to search inputs for fuzzy matching
- Options page for configuration
- Dark POE-themed UI
- Click saved searches to reopen them
- Save button injected into POE trade pages
- Automatic URL detection for trade searches
- Edit search names and categories
- Delete individual searches
- Category collapse/expand functionality
- Search timestamp tracking
- Real-time settings synchronization

### Features
- **Storage**: Unlimited local storage using browser.storage.local API
- **Fuzzy Search**: Automatically adds "~" for fuzzy matching (toggleable)
- **Categories**: Unlimited custom categories with search organization
- **Import/Export**: Full backup and restore capability
- **Sidebar UI**: Native Firefox sidebar with clean, responsive design
- **Content Integration**: Seamless integration with pathofexile.com/trade
- **Quick Access**: One-click search reopening from sidebar

### Technical
- Manifest V3 architecture
- Vanilla JavaScript (no dependencies)
- Modular storage layer
- Content script for page integration
- Background script for lifecycle management
- SVG icons for crisp display at any size

### Browser Support
- Firefox 109 or later
- Uses Firefox-specific sidebar_action API

---

## [Unreleased]

### Planned Features
- Keyboard shortcuts for common actions
- Search notes and tags
- Pin favorite searches to top
- Duplicate search detection
- Last used timestamp display
- Drag-and-drop search reordering
- POE2 trade site support
- Chrome compatibility layer
- Search history tracking
- Bulk operations (multi-select searches)
- Context menu integration
- Badge counter showing number of saved searches

---

## Version Number Scheme

This project follows [Semantic Versioning](https://semver.org/):
- **Major** (1.x.x): Breaking changes or major feature additions
- **Minor** (x.1.x): New features, backward compatible
- **Patch** (x.x.1): Bug fixes, small improvements

---

[1.0.0]: https://github.com/yourusername/UPOE-Trade/releases/tag/v1.0.0
