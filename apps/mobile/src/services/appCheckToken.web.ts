// Web entrypoint (Metro picks this over appCheckToken.ts for web builds) --
// re-exports the reCAPTCHA v3-backed token getter from the web-only Firebase
// init, under the same name the native variant exports, so api.ts's
// interceptor can import from './appCheckToken' without a Platform.OS branch.
export { getWebAppCheckToken as getAppCheckToken } from './firebase';
