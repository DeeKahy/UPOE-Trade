# UPOE Trade Manager

A Firefox extension that helps you save, organize, and quickly access your Path of Exile trade searches with categories and optional fuzzy search enhancement.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Firefox](https://img.shields.io/badge/firefox-109%2B-orange)

## Features

### Save & Organize Trade Searches
- Save any Path of Exile trade search with a custom name
- Organize searches into custom categories
- Quick access via Firefox sidebar
- One-click to reopen saved searches

### Category Management
- Create unlimited custom categories (e.g., "Current Build", "Leveling", "Farming")
- Default "Uncategorized" category for quick saves
- Edit and delete categories
- Move searches between categories

### Fuzzy Search Enhancement
- Toggle fuzzy search on/off in settings
- Automatically prepends `~` to search inputs for fuzzy matching
- Opt-out by starting your search with a space
- Helps find items with similar names even without exact matches

### Import/Export
- Export all your saved searches as JSON
- Import searches from backup files
- Share search collections with friends

### Clean, Dark UI
- Native Firefox sidebar integration
- POE-themed dark design
- Filter saved searches by name
- Responsive and fast

## Installation

### From Source (Development)

1. **Clone this repository:**
   ```bash
   git clone https://github.com/yourusername/UPOE-Trade.git
   cd UPOE-Trade
   ```

2. **Load the extension in Firefox:**
   - Open Firefox and navigate to `about:debugging`
   - Click "This Firefox" in the left sidebar
   - Click "Load Temporary Add-on"
   - Navigate to the extension directory and select `manifest.json`

3. **Open the sidebar:**
   - Go to View → Sidebar → POE Trade Searches
   - Or press the keyboard shortcut if configured

### From Firefox Add-ons (Coming Soon)
The extension will be available on the Firefox Add-ons store once it's published.

## Usage

### Saving a Trade Search

**Method 1: Via Sidebar**
1. Navigate to [pathofexile.com/trade](https://www.pathofexile.com/trade)
2. Set up your search filters (item type, stats, prices, etc.)
3. Open the UPOE Trade Manager sidebar
4. Click "Save Current"
5. Enter a name and select a category
6. Click "Save"

**Method 2: Via Content Page Button**
1. Set up your search on the POE trade site
2. Click the "Save Search" button in the top-right corner
3. Enter a name (uses default category)

### Managing Categories

1. Open the sidebar
2. Click "New Category"
3. Enter a category name (e.g., "Caster Build", "Currency Trades")
4. Your new category appears in the list

To delete a category:
- Click the × button next to the category name
- All searches in that category move to "Uncategorized"

### Organizing Searches

- **Edit a search:** Hover over a search and click the Edit button
- **Delete a search:** Hover over a search and click the Delete button
- **Filter searches:** Use the search bar at the top of the sidebar
- **Collapse categories:** Click the arrow next to a category name

### Enabling Fuzzy Search

1. Right-click the extension icon or open the sidebar
2. Go to extension settings/options
3. Check "Enable Fuzzy Search"
4. Reload any open POE trade tabs

Now when you type in search boxes on the trade site, the extension automatically adds `~` for fuzzy matching.

**To opt-out for a specific search:** Start typing with a space character.

### Importing/Exporting

**Export:**
1. Open the sidebar
2. Click "Export"
3. Save the JSON file to your computer

**Import:**
1. Open the sidebar
2. Click "Import"
3. Select a previously exported JSON file
4. Your searches and categories are restored

## Configuration

Access the options page through:
- Firefox Add-ons Manager → UPOE Trade Manager → Options
- Right-click extension icon → Manage Extension → Options

### Available Settings

- **Enable Fuzzy Search:** Auto-prepend tilde to search inputs
- **Default Category:** Choose which category new searches use by default

## Development

### Project Structure

```
UPOE-Trade/
├── manifest.json           # Extension configuration
├── storage.js             # Data persistence layer
├── sidebar.html           # Sidebar UI
├── sidebar.js             # Sidebar logic
├── content-script.js      # Runs on POE trade pages
├── background.js          # Background service worker
├── options.html           # Settings page
├── options.js             # Settings logic
├── styles/
│   ├── sidebar.css       # Sidebar styling
│   └── content.css       # Injected page styles
├── icons/
│   ├── icon-48.svg       # Extension icons
│   ├── icon-96.svg
│   └── icon-128.svg
└── README.md
```

### Key Technologies

- **Manifest V3** - Modern Firefox extension architecture
- **browser.storage.local** - Unlimited local storage
- **Sidebar Action API** - Native Firefox sidebar integration
- **Content Scripts** - Page manipulation and fuzzy search
- **Vanilla JavaScript** - No dependencies

### Storage Schema

```javascript
{
  categories: [
    { id: 'default', name: 'Uncategorized', order: 0 },
    { id: '...', name: 'Custom Category', order: 1 }
  ],
  searches: [
    {
      id: '...',
      name: 'Life/Res Rings',
      category: 'default',
      url: 'https://www.pathofexile.com/trade/search/...',
      timestamp: 1234567890
    }
  ],
  settings: {
    fuzzySearchEnabled: true,
    defaultCategory: 'default'
  }
}
```

## Troubleshooting

### Save button doesn't appear
- Make sure you're on a page like `pathofexile.com/trade/search/...`
- Try refreshing the page
- Check that the extension is enabled in `about:addons`

### Fuzzy search not working
- Enable it in the extension options
- Reload the POE trade page after enabling
- Features only work on `.multiselect__input` elements

### Searches not saving
- Check Firefox console for errors (F12)
- Verify storage permissions in `about:addons`
- Try exporting/importing to reset storage

### Sidebar won't open
- Ensure you're using Firefox 109 or later
- Try View → Sidebar → POE Trade Searches
- Reload the extension in `about:debugging`

## Roadmap

Future features under consideration:
- [ ] Keyboard shortcuts for common actions
- [ ] Search notes and tags
- [ ] Pin favorite searches to top
- [ ] Duplicate search detection
- [ ] Last used timestamp tracking
- [ ] Drag-and-drop search reordering
- [ ] POE2 trade site support
- [ ] Chrome compatibility layer

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Credits

- Inspired by the Path of Exile trading community
- Fuzzy search functionality based on community user scripts
- Built for exiles, by an exile

## Support

If you encounter any issues or have suggestions:
- Open an issue on GitHub
- Join the discussion in the POE community

## Disclaimer

This is an unofficial extension and is not affiliated with or endorsed by Grinding Gear Games.

---

**Happy trading, Exile!**
