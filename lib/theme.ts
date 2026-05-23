export type ThemePreference = "light" | "dark" | "system";

export const THEME_COOKIE = "mvl-theme";
export const VALID_THEMES: ThemePreference[] = ["light", "dark", "system"];

export function isValidTheme(v: unknown): v is ThemePreference {
  return typeof v === "string" && (VALID_THEMES as string[]).includes(v);
}

// Runs in <head> before React hydrates — prevents flash of wrong theme.
// Reads <html data-theme-pref> rendered server-side (highest priority), then
// the cookie, then defaults to system. Resolves against prefers-color-scheme
// and applies data-theme to <html>.
export const themeInitScript = `
(function() {
  try {
    var html = document.documentElement;
    var serverPref = html.getAttribute('data-theme-pref');
    var pref = serverPref;
    if (!pref) {
      var match = document.cookie.match(/(?:^|; )mvl-theme=([^;]+)/);
      pref = match ? decodeURIComponent(match[1]) : 'system';
    }
    if (pref !== 'light' && pref !== 'dark' && pref !== 'system') pref = 'system';
    var resolved = pref;
    if (pref === 'system') {
      resolved = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    html.setAttribute('data-theme', resolved);
    html.setAttribute('data-theme-pref', pref);
  } catch (e) {}
})();
`;
