import { createContext, onDestroy, onMount } from 'svelte';
import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createOnigurumaEngine } from 'shiki/engine/oniguruma';
import darkPlus from '@shikijs/themes/dark-plus';
import lightPlus from '@shikijs/themes/light-plus';
import json from '@shikijs/langs/json';
import bash from '@shikijs/langs/bash';

class ShikiStore {
	private highlighterPromise = createHighlighterCore({
		langs: [bash, json],
		themes: [darkPlus, lightPlus],
		engine: createOnigurumaEngine(import('shiki/wasm'))
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
