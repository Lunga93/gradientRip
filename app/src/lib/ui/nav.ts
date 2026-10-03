// app/src/lib/ui/nav.ts
export interface Tab {
	key: 'home' | 'map' | 'explore' | 'activity' | 'me';
	label: string;
	href: '/home' | '/map' | '/explore' | '/activity' | '/me';
}

export const TABS: Tab[] = [
	{ key: 'home', label: 'Home', href: '/home' },
	{ key: 'map', label: 'Map', href: '/map' },
	{ key: 'explore', label: 'Explore', href: '/explore' },
	{ key: 'activity', label: 'Activity', href: '/activity' },
	{ key: 'me', label: 'Me', href: '/me' }
];

export const isTabActive = (tabHref: string, pathname: string): boolean =>
	pathname === tabHref ||
	pathname.startsWith(`${tabHref}/`) ||
	(detailParent(pathname) === tabHref || (detailParent(pathname)?.startsWith(`${tabHref}/`) ?? false));

const DETAIL_PARENTS: [prefix: string, parent: string][] = [
	['/crew/', '/explore/crews'],
	['/route/', '/explore/routes'],
	['/event/', '/explore/events']
];

export const detailParent = (pathname: string): string | null => {
	for (const [prefix, parent] of DETAIL_PARENTS) {
		if (pathname.startsWith(prefix)) return parent;
	}
	return null;
};

export const stripParams = (href: string, names: string[]): string => {
	const url = new URL(href);
	for (const name of names) url.searchParams.delete(name);
	return url.pathname + url.search + url.hash;
};
