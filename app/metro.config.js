// Metro for an app that shares the web app's plain JavaScript (../js) with the website.
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const root = path.resolve(__dirname, '..');
const config = getDefaultConfig(__dirname);

// The shared logic (data, steps, timer, store, ...) sits outside this folder: watched and bundled too.
config.watchFolders = [path.join(root, 'js')];
// Packages are looked up here first, so a module in ../js never reaches for ../node_modules.
config.resolver.nodeModulesPaths = [path.join(__dirname, 'node_modules')];

module.exports = config;
