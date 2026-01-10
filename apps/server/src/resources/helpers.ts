import { Context, Data } from 'effect';
import { type BtcaFsResource, type BtcaResource } from './types.ts';

export const createResourceTag = (resourceId: string) =>
	Context.GenericTag<BtcaResource>(`btca/resource/${resourceId}`);

export const createFsResourceTag = (resourceId: string) =>
	Context.GenericTag<BtcaFsResource>(`btca/resource/${resourceId}`);

export class ResourceError extends Data.TaggedError('ResourceError')<{
	readonly message: string;
	readonly cause?: unknown;
	readonly stack?: string;
}> {}
