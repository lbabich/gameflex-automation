import { useMemo } from 'react';

export function useLocalStorage() {
	return useMemo(
		() => ({
			setItem<T>(key: string, value: T) {
				try {
					localStorage.setItem(key, JSON.stringify(value));
					return true;
				} catch (err: unknown) {
					console.error(`useLocalStorage: could not store "${key}"`, err);
					return false;
				}
			},
			getItem<T>(key: string) {
				try {
					const raw = localStorage.getItem(key);

					if (raw === null) {
						return null;
					}

					try {
						return JSON.parse(raw) as T;
					} catch {
						return raw as T;
					}
				} catch (err: unknown) {
					console.error(`useLocalStorage: could not read "${key}"`, err);
					return null;
				}
			},
		}),
		[],
	);
}
