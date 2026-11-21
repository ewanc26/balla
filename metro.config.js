const { getDefaultConfig } = require('expo/metro-config');
const { resolve } = require('metro-resolver');

const config = getDefaultConfig(__dirname);

// @atproto/oauth-client-expo@0.2.14 ships expo-oauth-client.native.js and
// expo-oauth-client.web.js, but dist/index.js imports the plain .js path. Metro
// does not apply platform extensions to an import that already has one, so
// redirect that single internal import. Remove this when the package ships a
// plain entry or fixes the import.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === './expo-oauth-client.js' &&
    context.originModulePath.includes('@atproto/oauth-client-expo/dist/index.js')
  ) {
    const entry = platform === 'web' ? 'web' : 'native';
    return resolve(context, `./expo-oauth-client.${entry}.js`, platform);
  }

  return resolve(context, moduleName, platform);
};

module.exports = config;
