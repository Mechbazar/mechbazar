const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// apps/mobile is intentionally NOT part of the npm workspace rooted at the
// repo root (that workspace only covers apps/admin-mobile, apps/seller-mobile,
// and packages/shared). The repo root's package-lock.json still makes Expo's
// automatic monorepo detection treat the repo root as this app's workspace
// root, which breaks resolution of this app's own node_modules. Pin this app
// to single-project mode to opt out of that detection.
const config = getDefaultConfig(__dirname);

config.watchFolders = [__dirname];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
