import type { Href, Router } from 'expo-router';

/**
 * Go back when this screen was reached through in-app navigation. If it was
 * opened directly (for example after a reload or deep link), return to a safe
 * screen instead of dispatching an unhandled GO_BACK action.
 */
export function goBackOrReplace(router: Router, fallback: Href) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallback);
}
