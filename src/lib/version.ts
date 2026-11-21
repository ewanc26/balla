import appConfig from '../../app.json';

/** Read from app.json so the in-app version cannot drift from the release. */
export const APP_VERSION: string = appConfig.expo.version;
