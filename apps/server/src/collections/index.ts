import { FileSystem } from '@effect/platform';
import { Context, Effect, Layer, Scope } from 'effect';
import { Config } from '../config/index.ts';
import { createFsResourceTag } from '../resources/helpers.ts';
import { loadGitResource } from '../resources/impls/git.ts';
import { isGitResource, type ResourceDefinition } from '../resources/schema.ts';
import type { BtcaFsResource, BtcaGitResourceArgs } from '../resources/types.ts';
import { CollectionError, getCollectionKey, type CollectionResult } from './types.ts';

interface LoadCollectionArgs {
	resourceNames: readonly string[];
	quiet?: boolean;
}

const resourceDefinitionToGitArgs = (
	def: ResourceDefinition,
	resourcesDirectory: string,
	quiet: boolean
): BtcaGitResourceArgs => ({
	type: 'git',
	name: def.name,
	url: def.url,
	branch: def.branch,
	repoSubPath: def.searchPath ?? '',
	resourcesDirectoryPath: resourcesDirectory,
	specialAgentInstructions: def.specialNotes ?? '',
	quiet
});

const loadResourceFromDefinition = (
	def: ResourceDefinition,
	resourcesDirectory: string,
	quiet: boolean
): Effect.Effect<BtcaFsResource, CollectionError, FileSystem.FileSystem | Scope.Scope> => {
	if (isGitResource(def)) {
		const args = resourceDefinitionToGitArgs(def, resourcesDirectory, quiet);
		const layer = loadGitResource(args);

		return Effect.gen(function* () {
			const scope = yield* Scope.Scope;
			const context = yield* Layer.buildWithScope(layer, scope);
			const tag = createFsResourceTag(`git:${def.name}`);
			return Context.get(context, tag);
		}).pipe(
			Effect.mapError(
				(e) => new CollectionError({ message: `Failed to load resource ${def.name}`, cause: e })
			)
		);
	}

	return Effect.fail(new CollectionError({ message: `Unknown resource type` }));
};

export const loadCollection = (
	args: LoadCollectionArgs
): Effect.Effect<CollectionResult, CollectionError, FileSystem.FileSystem | Scope.Scope | Config> =>
	Effect.gen(function* () {
		const { resourceNames, quiet = false } = args;
		const config = yield* Config;
		const fs = yield* FileSystem.FileSystem;

		if (resourceNames.length === 0) {
			return yield* Effect.fail(
				new CollectionError({ message: 'Cannot create collection with no resources' })
			);
		}

		const resources: ResourceDefinition[] = [];
		for (const name of resourceNames) {
			const resource = config.getResource(name);
			if (!resource) {
				return yield* Effect.fail(
					new CollectionError({ message: `Resource "${name}" not found in config` })
				);
			}
			resources.push(resource);
		}

		const sortedResources = [...resources].sort((a, b) => a.name.localeCompare(b.name));
		const key = getCollectionKey(sortedResources.map((r) => r.name));
		const collectionPath = `${config.collectionsDirectory}/${key}`;

		const loadedResources: BtcaFsResource[] = [];
		for (const def of sortedResources) {
			const resource = yield* loadResourceFromDefinition(def, config.resourcesDirectory, quiet);
			loadedResources.push(resource);
		}

		yield* fs
			.makeDirectory(collectionPath, { recursive: true })
			.pipe(
				Effect.mapError(
					(e) => new CollectionError({ message: 'Failed to create collection directory', cause: e })
				)
			);

		for (const resource of loadedResources) {
			const resourcePath = yield* resource.getAbsoluteDirectoryPath.pipe(
				Effect.mapError(
					(e) =>
						new CollectionError({ message: `Failed to get path for ${resource.name}`, cause: e })
				)
			);
			const linkPath = `${collectionPath}/${resource.name}`;

			const linkExists = yield* fs.exists(linkPath).pipe(Effect.orElseSucceed(() => false));

			if (!linkExists) {
				yield* fs.symlink(resourcePath, linkPath).pipe(
					Effect.mapError(
						(e) =>
							new CollectionError({
								message: `Failed to create symlink for ${resource.name}`,
								cause: e
							})
					)
				);
			}
		}

		const instructionBlocks: string[] = [];
		for (const resource of loadedResources) {
			const instructions = yield* resource.getAgentInstructions.pipe(
				Effect.mapError(
					(e) =>
						new CollectionError({
							message: `Failed to get instructions for ${resource.name}`,
							cause: e
						})
				)
			);
			instructionBlocks.push(instructions);
		}

		return {
			path: collectionPath,
			agentInstructions: instructionBlocks.join('\n\n')
		};
	});

export { CollectionError, getCollectionKey, type CollectionResult } from './types.ts';
