const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// apps/mobile is now a member of the root npm workspace (see root
// package.json), matching apps/rider, apps/mechanic, apps/admin-mobile and
// apps/seller-mobile. This mirrors their metro.config.js exactly: watch only
// the shared package this app actually uses, and resolve node_modules from
// both this project and the hoisted workspace root, in that order.
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const sharedPackageRoot = path.resolve(workspaceRoot, 'packages/shared');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [sharedPackageRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
