import { createClient, getConfig, getResources, askQuestionStream } from '../client/index.ts';
import { parseSSEStream } from '../client/stream.ts';
import type { BtcaStreamEvent } from '@btca/server/stream/types';
import type { Repo, BtcaChunk } from './types.ts';

// Get server URL from global (set by TUI launcher)
const getServerUrl = (): string => {
	const server = globalThis.__BTCA_SERVER__;
	if (!server) throw new Error('Server not initialized');
	return server.url;
};

// Current request abort controller for cancellation
let currentAbortController: AbortController | null = null;

export type ChunkUpdate =
	| { type: 'add'; chunk: BtcaChunk }
	| { type: 'update'; id: string; chunk: Partial<BtcaChunk> };

export const services = {
	/**
	 * Get all resources as Repos (only git resources for now)
	 */
	getRepos: async (): Promise<Repo[]> => {
		const client = createClient(getServerUrl());
		const { resources } = await getResources(client);
		return resources
			.filter((r) => r.type === 'git')
			.map((r) => ({
				name: r.name,
				url: r.url ?? '',
				branch: r.branch ?? 'main',
				specialNotes: r.specialNotes ?? undefined,
				searchPath: r.searchPath ?? undefined
			}));
	},

	/**
	 * Get current model config
	 */
	getModel: async (): Promise<{ provider: string; model: string }> => {
		const client = createClient(getServerUrl());
		const config = await getConfig(client);
		return { provider: config.provider, model: config.model };
	},

	/**
	 * Ask a question across multiple resources
	 */
	askQuestion: async (
		resourceNames: string[],
		question: string,
		onChunkUpdate: (update: ChunkUpdate) => void
	): Promise<BtcaChunk[]> => {
		const serverUrl = getServerUrl();

		// Create abort controller for this request
		currentAbortController = new AbortController();

		const response = await askQuestionStream(serverUrl, {
			question,
			resources: resourceNames,
			quiet: true
		});

		const chunks = new Map<string, BtcaChunk>();

		for await (const event of parseSSEStream(response)) {
			processStreamEvent(event, chunks, onChunkUpdate);
		}

		currentAbortController = null;
		return [...chunks.values()];
	},

	/**
	 * Cancel the current request
	 */
	cancelCurrentRequest: async (): Promise<void> => {
		if (currentAbortController) {
			currentAbortController.abort();
			currentAbortController = null;
		}
	}
};

function processStreamEvent(
	event: BtcaStreamEvent,
	chunks: Map<string, BtcaChunk>,
	onChunkUpdate: (update: ChunkUpdate) => void
): void {
	switch (event.type) {
		case 'text.delta': {
			// Accumulate text deltas into a single text chunk
			const textChunkId = '__text__';
			const existing = chunks.get(textChunkId);
			if (existing && existing.type === 'text') {
				existing.text += event.delta;
				onChunkUpdate({ type: 'update', id: textChunkId, chunk: { text: existing.text } });
			} else {
				const chunk: BtcaChunk = { type: 'text', id: textChunkId, text: event.delta };
				chunks.set(textChunkId, chunk);
				onChunkUpdate({ type: 'add', chunk });
			}
			break;
		}

		case 'reasoning.delta': {
			// Accumulate reasoning deltas
			const reasoningChunkId = '__reasoning__';
			const existing = chunks.get(reasoningChunkId);
			if (existing && existing.type === 'reasoning') {
				existing.text += event.delta;
				onChunkUpdate({ type: 'update', id: reasoningChunkId, chunk: { text: existing.text } });
			} else {
				const chunk: BtcaChunk = { type: 'reasoning', id: reasoningChunkId, text: event.delta };
				chunks.set(reasoningChunkId, chunk);
				onChunkUpdate({ type: 'add', chunk });
			}
			break;
		}

		case 'tool.updated': {
			const existing = chunks.get(event.callID);
			const state =
				event.state.status === 'pending'
					? 'pending'
					: event.state.status === 'running'
						? 'running'
						: 'completed';

			if (existing && existing.type === 'tool') {
				existing.state = state;
				onChunkUpdate({ type: 'update', id: event.callID, chunk: { state } });
			} else {
				const chunk: BtcaChunk = {
					type: 'tool',
					id: event.callID,
					toolName: event.tool,
					state
				};
				chunks.set(event.callID, chunk);
				onChunkUpdate({ type: 'add', chunk });
			}
			break;
		}

		case 'meta':
		case 'done':
		case 'error':
			// Handled elsewhere or informational
			break;
	}
}

export type Services = typeof services;
