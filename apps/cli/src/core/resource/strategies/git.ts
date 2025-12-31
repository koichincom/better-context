import { FileSystem } from '@effect/platform';
import { Effect } from 'effect';
import type { GitResource } from '../types.ts';
import { ResourceError } from '../errors.ts';
import { directoryExists } from '../../../lib/utils/files.ts';

/** clone a git repo with degit */
export const cloneWithDegit = (args: {
	repoDir: string;
	url: string;
	branch: string;
	searchPath?: string;
	quiet?: boolean;
}) =>
	Effect.tryPromise({
		try: async () => {
			const { repoDir, url, branch, searchPath, quiet } = args;
			const source = searchPath ? `${url}/${searchPath}#${branch}` : `${url}#${branch}`;
			const proc = Bun.spawn(['bunx', 'degit', source, repoDir, '--force'], {
				stdout: quiet ? 'ignore' : 'inherit',
				stderr: quiet ? 'ignore' : 'inherit'
			});
			const exitCode = await proc.exited;
			if (exitCode !== 0) {
				throw new Error(`Failed to clone repo with degit: ${exitCode}`);
			}
		},
		catch: (error) =>
			new ResourceError({ message: 'Failed to clone repo with degit', cause: error })
	});

/**
 * Ensure a git resource is cached locally using degit.
 * Always does a fresh clone (degit uses --force).
 */
export const ensureGitResource = (args: {
	resource: GitResource;
	resourcesDir: string;
	quiet?: boolean;
}) =>
	Effect.gen(function* () {
		const { resource, resourcesDir, quiet = false } = args;
		const repoDir = `${resourcesDir}/${resource.name}`;

		yield* cloneWithDegit({
			repoDir,
			url: resource.url,
			branch: resource.branch,
			searchPath: resource.searchPath,
			quiet
		});

		return {
			name: resource.name,
			type: 'git' as const,
			specialNotes: resource.specialNotes
		};
	});

/**
 * Check if a git resource is cached
 */
export const isGitResourceCached = (args: {
	resource: GitResource;
	resourcesDir: string;
}): Effect.Effect<boolean, ResourceError, FileSystem.FileSystem> =>
	directoryExists(`${args.resourcesDir}/${args.resource.name}`).pipe(
		Effect.mapError((e) => new ResourceError({ message: e.message, cause: e }))
	);
