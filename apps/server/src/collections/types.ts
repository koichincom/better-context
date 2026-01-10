import { Data } from 'effect';

export interface CollectionResult {
	path: string;
	agentInstructions: string;
}

export class CollectionError extends Data.TaggedError('CollectionError')<{
	readonly message: string;
	readonly cause?: unknown;
}> {}

export const getCollectionKey = (resourceNames: string[]): string => {
	if (resourceNames.length === 0) {
		throw new Error('Cannot generate collection key from empty resource list');
	}
	return [...resourceNames].sort().join('+');
};
