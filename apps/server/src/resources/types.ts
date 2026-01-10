import type { Effect } from 'effect';

export const FS_RESOURCE_SYSTEM_NOTE =
	'This is a btca resource - a searchable knowledge source the agent can reference.';

export interface BtcaFsResource {
	readonly _tag: 'fs-based';
	readonly name: string;
	readonly type: 'git';
	readonly getAbsoluteDirectoryPath: Effect.Effect<string>;
	readonly getAgentInstructions: Effect.Effect<string>;
}

export interface BtcaToolResource {
	readonly _tag: 'tool-based';
	readonly name: string;
	readonly type: 'todoist';
	// TODO: figure out how these all get actually passed into the agent and called
	readonly getTools: Effect.Effect<string[]>;
}

export type BtcaResource = BtcaFsResource | BtcaToolResource;

// SPECIFIC RESOURCE TYPES

export interface BtcaGitResourceArgs {
	readonly type: 'git';
	readonly name: string;
	readonly url: string;
	readonly branch: string;
	readonly repoSubPath: string;
	readonly resourcesDirectoryPath: string;
	readonly specialAgentInstructions: string;
	readonly quiet: boolean;
}
