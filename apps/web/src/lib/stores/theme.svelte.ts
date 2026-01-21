import { getContext, setContext } from 'svelte';
import { browser } from '$app/environment';

const THEME_KEY = Symbol('theme');

export type Theme = 'light' | 'dark';

class ThemeStore {
	private _theme = $state<Theme>('dark');

	constructor() {
		if (browser) {
			const stored = localStorage.getItem('theme') as Theme | null;
			const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
			const initialTheme =
				stored === 'light' || stored === 'dark' ? stored : prefersDark ? 'dark' : 'light';
			this.applyTheme(initialTheme, false);
		}
	}

	get theme() {
		return this._theme;
	}

	toggle() {
		this.applyTheme(this._theme === 'dark' ? 'light' : 'dark');
	}

	set(newTheme: Theme) {
		this.applyTheme(newTheme);
	}

	private applyTheme(newTheme: Theme, persist = true) {
		this._theme = newTheme;
		if (browser) {
			document.documentElement.classList.toggle('dark', newTheme === 'dark');
			if (persist) {
				localStorage.setItem('theme', newTheme);
			}
		}
	}
}

export const setThemeStore = () => {
	const store = new ThemeStore();
	setContext(THEME_KEY, store);
	return store;
};

export const getThemeStore = (): ThemeStore => {
	const store = getContext<ThemeStore>(THEME_KEY);
	if (!store) {
		throw new Error('ThemeStore not found. Did you call setThemeStore() in a parent component?');
	}
	return store;
};
