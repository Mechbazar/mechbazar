// Android/iOS build only (Metro picks this file over webPush.web.ts) --
// native push already works via services/notifications.ts's Expo push
// pipeline, so web push registration is a no-op here.
export async function registerForWebPushAsync(): Promise<string | undefined> {
  return undefined;
}
