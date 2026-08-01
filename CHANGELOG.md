# Changelog

All notable changes to the UPOE Trade Manager extension will be documented in this file.

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
