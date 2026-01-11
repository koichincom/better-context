import { Command } from 'commander';
import { ensureServer } from '../server/manager.ts';
import { createClient, getResources, askQuestionStream } from '../client/index.ts';
import { parseSSEStream } from '../client/stream.ts';
import type { BtcaStreamEvent } from '@btca/server/stream/types';

/**
 * Parse @mentions from query string
 */
function parseQuery(query: string): { query: string; resources: string[] } {
	const mentionRegex = /@(\w+)/g;
	const resources: string[] = [];
	let match;

	while ((match = mentionRegex.exec(query)) !== null) {
		if (match[1]) {
			resources.push(match[1]);
		}
	}

	// Remove @mentions from query
	const cleanQuery = query.replace(mentionRegex, '').trim();

	return { query: cleanQuery, resources };
}

/**
 * Merge CLI -r flags with @mentions, deduplicating
 */
function mergeResources(
	cliResources: string[],
	mentionedResources: string[],
	tech?: string
): string[] {
	const all = [...cliResources, ...mentionedResources];
	if (tech) all.push(tech);
	return [...new Set(all)];
}

export const askCommand = new Command('ask')
	.description('Ask a question about configured resources')
	.requiredOption('-q, --question <text>', 'Question to ask')
	.option('-r, --resource <name...>', 'Resources to search (can specify multiple)')
	.option('-t, --tech <name>', 'Single resource alias (same as -r)')
	.action(async (options, command) => {
		const globalOpts = command.parent?.opts() as { server?: string; port?: number } | undefined;

		try {
			const server = await ensureServer({
				serverUrl: globalOpts?.server,
				port: globalOpts?.port
			});

			const client = createClient(server.url);

			// Parse @mentions from question
			const parsed = parseQuery(options.question as string);

			// Merge CLI -r flags with @mentions
			const resourceNames = mergeResources(
				(options.resource as string[] | undefined) ?? [],
				parsed.resources,
				options.tech as string | undefined
			);

			// If no resources specified, validate that some exist
			if (resourceNames.length === 0) {
				const { resources } = await getResources(client);
				if (resources.length === 0) {
					console.error('Error: No resources configured.');
					console.error('Add resources to your btca config file.');
					process.exit(1);
				}
				// Use all resources if none specified
				resourceNames.push(...resources.map((r) => r.name));
			}

			console.log(`Searching resources: ${resourceNames.join(', ')}\n`);

			// Stream the response
			const response = await askQuestionStream(server.url, {
				question: parsed.query,
				resources: resourceNames,
				quiet: true
			});

			let fullText = '';
			let inReasoning = false;

			for await (const event of parseSSEStream(response)) {
				handleStreamEvent(event, {
					onTextDelta: (delta) => {
						if (inReasoning) {
							process.stdout.write('\n</thinking>\n\n');
							inReasoning = false;
						}
						process.stdout.write(delta);
						fullText += delta;
					},
					onReasoningDelta: (delta) => {
						if (!inReasoning) {
							process.stdout.write('\n<thinking>\n');
							inReasoning = true;
						}
						process.stdout.write(delta);
					},
					onToolUpdated: (tool, state) => {
						if (state === 'running') {
							console.log(`\n[Tool: ${tool}]`);
						}
					},
					onError: (message) => {
						console.error(`\nError: ${message}`);
					}
				});
			}

			if (inReasoning) {
				process.stdout.write('\n</thinking>\n');
			}

			console.log('\n');
			server.stop();
		} catch (error) {
			console.error('Error:', error instanceof Error ? error.message : String(error));
			process.exit(1);
		}
	});

interface StreamHandlers {
	onTextDelta: (delta: string) => void;
	onReasoningDelta: (delta: string) => void;
	onToolUpdated: (tool: string, state: string) => void;
	onError: (message: string) => void;
}

function handleStreamEvent(event: BtcaStreamEvent, handlers: StreamHandlers): void {
	switch (event.type) {
		case 'text.delta':
			handlers.onTextDelta(event.delta);
			break;
		case 'reasoning.delta':
			handlers.onReasoningDelta(event.delta);
			break;
		case 'tool.updated':
			handlers.onToolUpdated(event.tool, event.state.status);
			break;
		case 'error':
			handlers.onError(event.message);
			break;
		case 'meta':
		case 'done':
			// Informational, no action needed
			break;
	}
}
