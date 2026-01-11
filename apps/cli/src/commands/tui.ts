import { ensureServer, type ServerManager } from '../server/manager.ts';

// Store server reference globally so TUI can access it
declare global {
	// eslint-disable-next-line no-var
	var __BTCA_SERVER__: ServerManager | undefined;
}

export interface TuiOptions {
	server?: string;
	port?: number;
}

/**
 * Launch the interactive TUI
 */
export async function launchTui(options: TuiOptions): Promise<void> {
	const server = await ensureServer({
		serverUrl: options.server,
		port: options.port
	});

	// Store server reference for TUI to use
	globalThis.__BTCA_SERVER__ = server;

	// Import and run TUI (dynamic import to avoid loading TUI deps when not needed)
	await import('../tui/App.tsx');
}
