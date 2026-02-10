# Quick Start Guide

## Installing the Extension in Firefox

1. **Open Firefox Developer Tools**
   - Type `about:debugging` in the address bar and press Enter
   - Or go to: Menu → More Tools → Remote Debugging

2. **Load the Extension**
   - Click "This Firefox" in the left sidebar
   - Click the "Load Temporary Add-on..." button
   - Navigate to the UPOE-Trade folder
   - Select the `manifest.json` file

3. **Verify Installation**
   - You should see "UPOE Trade Manager" appear in your list of extensions
   - The extension icon should appear in your Firefox toolbar

## Opening the Sidebar

**Method 1: Via Menu**
- Click the Firefox menu
- Go to View → Sidebar → POE Trade Searches

**Method 2: Via Keyboard** (if configured)
- Press your configured keyboard shortcut

**Method 3: On the Trade Site**
- The sidebar will automatically activate when you visit pathofexile.com/trade

## Testing the Extension

### Test 1: Save a Search
1. Go to https://www.pathofexile.com/trade/search/Standard (or your preferred league)
2. Set up some search filters (e.g., search for Rings, add some life/resistance filters)
3. Open the UPOE Trade Manager sidebar
4. Click "Save Current"
5. Enter a name like "Test Ring Search"
6. Click Save

### Test 2: Reopen a Saved Search
1. Clear your trade search filters or navigate away
2. Open the sidebar
3. Click on your saved "Test Ring Search"
4. Verify it reopens with all your filters intact

### Test 3: Create a Category
1. Open the sidebar
2. Click "New Category"
3. Enter a name like "My Builds"
4. Click Create
5. Verify your new category appears

### Test 4: Enable Fuzzy Search
1. Right-click the extension icon
2. Select "Manage Extension" → "Options"
3. Check "Enable Fuzzy Search"
4. Go to the POE trade site
5. Try typing in a search box - it should automatically add "~" at the start
6. Type a space first to opt-out of fuzzy search for that input

### Test 5: Export/Import
1. Create a few saved searches
2. Click "Export" in the sidebar
3. Save the JSON file
4. Click "Import" and select the file you just exported
5. Verify all searches are preserved

## Troubleshooting

### Extension Won't Load
- Make sure you selected `manifest.json` (not a folder)
- Check for error messages in the about:debugging page
- Look at the Browser Console (Ctrl+Shift+J / Cmd+Shift+J) for errors

### Sidebar Won't Open
- Make sure the extension loaded successfully
- Try closing and reopening Firefox
- Check View → Sidebar menu to see if "POE Trade Searches" appears

### Save Button Not Working
- Make sure you're on a URL that looks like: `pathofexile.com/trade/search/...`
- The URL must have search parameters (after you've applied filters)
- Try refreshing the page

### Fuzzy Search Not Working
- Enable it in the extension options
- Reload any open POE trade tabs after enabling
- It only works on the trade site's search input fields

## Development Tips

### Viewing Console Logs
- Open the sidebar
- Right-click in the sidebar and select "Inspect Element"
- Go to the Console tab to see logs from sidebar.js

### Viewing Content Script Logs
- Open the POE trade site
- Press F12 to open Developer Tools
- Go to the Console tab
- Look for messages starting with "UPOE Trade Manager:"

### Reloading the Extension
- After making code changes
- Go to about:debugging
- Click "Reload" next to UPOE Trade Manager
- Refresh any open POE trade tabs

### Inspecting Storage
- In the Browser Console (Ctrl+Shift+J / Cmd+Shift+J)
- Run: `browser.storage.local.get().then(console.log)`
- This shows all saved data

## Next Steps

Once you've verified everything works:

1. **Customize Categories** - Create categories that match your playstyle
2. **Save Your Searches** - Start building your collection of useful searches
3. **Try Fuzzy Search** - Enable it and see if you like the fuzzy matching behavior
4. **Export Backup** - Save a backup of your searches before each league

## Need Help?

- Check the main README.md for detailed documentation
- Look at the Troubleshooting section
- Open an issue on GitHub if you find bugs
- Share your feedback for improvements!

---

**Enjoy your organized trading experience!**
