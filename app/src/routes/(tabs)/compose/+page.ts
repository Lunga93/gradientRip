// The composer renders fully client-side (gallery/camera picks, authed
// fetches after mount) — no server load needed. Full-screen: tab bar hidden
// via noTabs (post detail stays tabbed).
export const load = () => ({ noTabs: true });
