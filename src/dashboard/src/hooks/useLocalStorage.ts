import { useMemo } from 'react';
import * as localStorageService from '../lib/local-storage.service';

export function useLocalStorage() {
	return useMemo(
		() => ({
			setItem<T>(key: string, value: T) {
				try {
					localStorageService.store(key, JSON.stringify(value));
					return true;
				} catch (err: unknown) {
					console.error(`useLocalStorage: could not store "${key}"`, err);
					return false;
				}
			},
			getItem<T>(key: string) {
				try {
					const raw = localStorageService.get(key);

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