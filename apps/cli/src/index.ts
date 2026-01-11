import { Command } from 'commander';
import { askCommand } from './commands/ask.ts';
import { chatCommand } from './commands/chat.ts';
import { launchTui } from './commands/tui.ts';

const VERSION = '0.7.0';

const program = new Command()
	.name('btca')
	.description('CLI for asking questions about technologies using btca server')
	.version(VERSION)
	.option('--server <url>', 'Use an existing btca server URL')
	.option('--port <port>', 'Port for auto-started server (default: random)', parseInt);

program.addCommand(askCommand);
program.addCommand(chatCommand);

// Default action (no subcommand) → launch TUI
program.action(async (options: { server?: string; port?: number }) => {
	try {
		await launchTui(options);
	} catch (error) {
		console.error('Error:', error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
});

program.parse();
