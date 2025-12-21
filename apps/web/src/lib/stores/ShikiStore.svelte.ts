import { createContext, onDestroy, onMount } from 'svelte';
import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

class ShikiStore {
	private highlighterPromise = createHighlighterCore({
		langs: [import('@shikijs/langs/bash'), import('@shikijs/langs/json')],
		themes: [import('@shikijs/themes/dark-plus'), import('@shikijs/themes/light-plus')],
		engine: createJavaScriptRegexEngine()
	});

	highlighter = $state<HighlighterCore | null>(null);

	constructor() {
		onMount(async () => {
			this.highlighter = await this.highlighterPromise;
		});
		onDestroy(() => {
			this.highlighter?.dispose();
		});
	}
}

const [internalGet, internalSet] = createContext<ShikiStore>();

export const getShikiStore = () => {
	const store = internalGet();
	if (!store) {
		throw new Error('ShikiStore not found, did you call setShikiStore() in a parent component?');
	}
	return store;
};

export const setShikiStore = () => {
	const newStore = new ShikiStore();
	return internalSet(newStore);
};
