import { hc } from 'hono/client';
import type { AppType } from '@btca/server';

export type Client = ReturnType<typeof hc<AppType>>;

/**
 * Create a typed Hono RPC client for the btca server
 */
export function createClient(baseUrl: string): Client {
	return hc<AppType>(baseUrl);
}

/**
 * Get server configuration
 */
export async function getConfig(client: Client) {
	const res = await client.config.$get();
	if (!res.ok) {
		throw new Error(`Failed to get config: ${res.status}`);
	}
	return res.json();
}

/**
 * Get available resources
 */
export async function getResources(client: Client) {
	const res = await client.resources.$get();
	if (!res.ok) {
		throw new Error(`Failed to get resources: ${res.status}`);
	}
	return res.json();
}

/**
 * Ask a question (non-streaming)
 */
export async function askQuestion(
	client: Client,
	options: {
		question: string;
		resources?: string[];
		quiet?: boolean;
	}
) {
	const res = await client.question.$post({
		json: {
			question: options.question,
			resources: options.resources,
			quiet: options.quiet
		}
	});

	if (!res.ok) {
		const error = (await res.json()) as { error?: string };
		throw new Error(error.error ?? `Failed to ask question: ${res.status}`);
	}

	return res.json();
}

/**
 * Get OpenCode instance URL for a collection
 */
export async function getOpencodeInstance(
	client: Client,
	options: {
		resources?: string[];
		quiet?: boolean;
	}
) {
	const res = await client.opencode.$post({
		json: {
			resources: options.resources,
			quiet: options.quiet
		}
	});

	if (!res.ok) {
		const error = (await res.json()) as { error?: string };
		throw new Error(error.error ?? `Failed to get opencode instance: ${res.status}`);
	}

	return res.json();
}

/**
 * Ask a question (streaming) - returns the raw Response for SSE parsing
 */
export async function askQuestionStream(
	baseUrl: string,
	options: {
		question: string;
		resources?: string[];
		quiet?: boolean;
	}
): Promise<Response> {
	// Use raw fetch for streaming since Hono client doesn't handle SSE well
	const res = await fetch(`${baseUrl}/question/stream`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			question: options.question,
			resources: options.resources,
			quiet: options.quiet
		})
	});

	if (!res.ok) {
		const error = (await res.json()) as { error?: string };
		throw new Error(error.error ?? `Failed to ask question: ${res.status}`);
	}

	return res;
}
