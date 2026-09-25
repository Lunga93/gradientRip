export const parseComment = (v: unknown): string | null => {
	if (typeof v !== 'string') return null;
	const t = v.trim();
	if (t.length < 1 || t.length > 500) return null;
	return t;
};
