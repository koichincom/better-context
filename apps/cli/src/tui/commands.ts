import type { Command } from './types.ts';

// Simplified commands - config management is handled by server
export const COMMANDS: Command[] = [
	{
		name: 'clear',
		description: 'Clear chat history',
		mode: 'clear'
	}
];

export function filterCommands(query: string): Command[] {
	const lowerQuery = query.toLowerCase();
	return COMMANDS.filter((cmd) => cmd.name.toLowerCase().startsWith(lowerQuery));
}
