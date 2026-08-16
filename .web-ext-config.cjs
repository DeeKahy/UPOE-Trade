module.exports = {
  // Everything here is either development tooling or documentation. Note that
  // data/ is deliberately absent: data/maxroll-data.json is loaded at runtime.
  ignoreFiles: [
    'docs/',
    '.github/',
    'tools/',
    'web-ext-artifacts/',
    '.git/',
    '.gitignore',
    '.gitattributes',
    'README.md',
    'CHANGELOG.md',
    'QUICKSTART.md',
    // The update manifests are served from the repo, not from inside the XPI
    'updates.json',
    'beta-updates.json',
    '.web-ext-config.cjs'
  ],
  build: {
    overwriteDest: true
  }
};
