export function store(key: string, value: string) {
	localStorage.setItem(key, value);
}

export function get(key: string): string | null {
	return localStorage.getItem(key);
}

