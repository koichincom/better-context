import {
	createOpencode,
	createOpencodeClient,
	type Config as OpenCodeConfig,
	type OpencodeClient,
	type ProviderConfig,
	type Event as OcEvent
} from "@opencode-ai/sdk";
import { FileSystem } from "@effect/platform";
import { Context, Data, Deferred, Effect, Layer, Stream } from "effect";
import { Config } from "../config/index.ts";
import type { CollectionResult } from "../collections/types.ts";
import type { AgentResult, SessionState } from "./types.ts";

export class AgentError extends Data.TaggedError("AgentError")<{
	readonly message: string;
	readonly cause?: unknown;
}> {}

export class InvalidProviderError extends Data.TaggedError("InvalidProviderError")<{
	readonly providerId: string;
	readonly availableProviders: string[];
}> {}

export class InvalidModelError extends Data.TaggedError("InvalidModelError")<{
	readonly providerId: string;
	readonly modelId: string;
	readonly availableModels: string[];
}> {}

export class ProviderNotConnectedError extends Data.TaggedError("ProviderNotConnectedError")<{
	readonly providerId: string;
	readonly connectedProviders: string[];
}> {}

const BTCA_PRESET_MODELS: Record<string, ProviderConfig> = {
	opencode: {
		models: {
			"btca-gemini-3-flash": {
				id: "gemini-3-flash",
				options: {
					generationConfig: {
						thinkingConfig: {
							thinkingLevel: "low"
						}
					}
				}
			}
		}
	}
};

const buildOpenCodeConfig = (args: { agentInstructions: string }): OpenCodeConfig => {
	const prompt = [
		"You are the btca server agent.",
		"You operate inside a collection directory.",
		"Only use relative paths within '.' and never use '..' or absolute paths.",
		"Do not leave the collection directory.",
		"",
		args.agentInstructions
	].join("\n");

	return {
		provider: BTCA_PRESET_MODELS,
		agent: {
			build: { disable: true },
			explore: { disable: true },
			general: { disable: true },
			plan: { disable: true },
			docs: {
				prompt,
				description: "Answer questions by searching the collection",
				permission: {
					webfetch: "deny",
					edit: "deny",
					bash: "deny",
					external_directory: "deny",
					doom_loop: "deny"
				},
				mode: "primary",
				tools: {
					write: false,
					bash: false,
					delete: false,
					read: true,
					grep: true,
					glob: true,
					list: true,
					path: false,
					todowrite: false,
					todoread: false,
					websearch: false,
					webfetch: false,
					skill: false,
					task: false,
					mcp: false,
					edit: false
				}
			}
		}
	};
};

const validateProviderAndModel = (client: OpencodeClient, providerId: string, modelId: string) =>
	Effect.gen(function* () {
		const response = yield* Effect.tryPromise(() => client.provider.list()).pipe(Effect.option);

		if (response._tag === "None" || !response.value.data) {
			return;
		}

		const { all, connected } = response.value.data;
		const provider = all.find((p) => p.id === providerId);
		if (!provider) {
			return yield* Effect.fail(
				new InvalidProviderError({
					providerId,
					availableProviders: all.map((p) => p.id)
				})
			);
		}

		if (!connected.includes(providerId)) {
			return yield* Effect.fail(
				new ProviderNotConnectedError({
					providerId,
					connectedProviders: connected
				})
			);
		}

		const modelIds = Object.keys(provider.models);
		if (!modelIds.includes(modelId)) {
			return yield* Effect.fail(
				new InvalidModelError({
					providerId,
					modelId,
					availableModels: modelIds
				})
			);
		}
	});

const getOpencodeInstance = (args: { collectionPath: string; ocConfig: OpenCodeConfig }) =>
	Effect.gen(function* () {
		const maxAttempts = 10;
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			const port = Math.floor(Math.random() * 3000) + 3000;
			const result = yield* Effect.tryPromise(() =>
				createOpencode({
					port,
					config: args.ocConfig
				})
			).pipe(
				Effect.catchAll((err) => {
					if (err.cause instanceof Error && err.cause.stack?.includes("port")) {
						return Effect.succeed(null);
					}
					return Effect.fail(new AgentError({ message: "Failed to create OpenCode instance", cause: err }));
				})
			);

			if (result !== null) {
				const client = createOpencodeClient({
					baseUrl: `http://localhost:${port}`,
					directory: args.collectionPath
				});
				return { client, server: result.server };
			}
		}

		return yield* Effect.fail(
			new AgentError({
				message: "Failed to create OpenCode instance - all port attempts exhausted"
			})
		);
	});

const streamSessionEvents = (args: { sessionID: string; client: OpencodeClient }) =>
	Effect.gen(function* () {
		const events = yield* Effect.tryPromise({
			try: () => args.client.event.subscribe(),
			catch: (cause) => new AgentError({ message: "Failed to subscribe to events", cause })
		});

		return Stream.fromAsyncIterable(events.stream, (cause) => new AgentError({ message: "Event stream error", cause }))
			.pipe(
				Stream.filter((event) => {
					const props = event.properties as any;
					if (!props || !("sessionID" in props)) return true;
					return props.sessionID === args.sessionID;
				}),
				Stream.takeUntil(
					(event) => event.type === "session.idle" && (event.properties as any).sessionID === args.sessionID
				)
			);
	});

const firePrompt = (args: {
	sessionID: string;
	text: string;
	errorDeferred: Deferred.Deferred<never, AgentError>;
	client: OpencodeClient;
	provider: string;
	model: string;
}) =>
	Effect.promise(() =>
		args.client.session.prompt({
			path: { id: args.sessionID },
			body: {
				agent: "docs",
				model: {
					providerID: args.provider,
					modelID: args.model
				},
				parts: [{ type: "text", text: args.text }]
			}
		})
	).pipe(
		Effect.catchAll((cause) =>
			Deferred.fail(args.errorDeferred, new AgentError({ message: "Prompt failed", cause }))
		)
	);

const extractAnswerFromEvents = (events: readonly OcEvent[]): string => {
	const partIds: string[] = [];
	const partText = new Map<string, string>();

	for (const event of events) {
		if (event.type !== "message.part.updated") continue;
		const part: any = (event.properties as any).part;
		if (!part || part.type !== "text") continue;
		if (!partIds.includes(part.id)) partIds.push(part.id);
		partText.set(part.id, String(part.text ?? ""));
	}

	return partIds
		.map((id) => partText.get(id) ?? "")
		.join("")
		.trim();
};

export interface AgentService {
	readonly askStream: (args: {
		collection: CollectionResult;
		question: string;
	}) => Effect.Effect<
		{
			stream: Stream.Stream<OcEvent, AgentError>;
			model: { provider: string; model: string };
		},
		AgentError,
		FileSystem.FileSystem
	>;

	readonly ask: (args: {
		collection: CollectionResult;
		question: string;
	}) => Effect.Effect<AgentResult, AgentError, FileSystem.FileSystem>;
}

export class Agent extends Context.Tag("btca/Agent")<Agent, AgentService>() {}

export const AgentLive = Layer.effect(
	Agent,
	Effect.gen(function* () {
		const config = yield* Config;

		const askStream: AgentService["askStream"] = ({ collection, question }) =>
			Effect.gen(function* () {
				const ocConfig = buildOpenCodeConfig({ agentInstructions: collection.agentInstructions });
				const { client, server } = yield* getOpencodeInstance({
					collectionPath: collection.path,
					ocConfig
				});

				yield* validateProviderAndModel(client, config.provider, config.model).pipe(
					Effect.mapError((cause) => new AgentError({ message: "Provider/model validation failed", cause }))
				);

				const session = yield* Effect.tryPromise(() => client.session.create()).pipe(
					Effect.mapError((cause) => new AgentError({ message: "Failed to create session", cause }))
				);

				if (session.error) {
					server.close();
					return yield* Effect.fail(
						new AgentError({ message: "Failed to create session", cause: session.error })
					);
				}

				const sessionState: SessionState = {
					client,
					server,
					sessionID: session.data.id,
					collectionPath: collection.path
				};

				const eventStream = yield* streamSessionEvents({
					sessionID: sessionState.sessionID,
					client
				});

				const errorDeferred = yield* Deferred.make<never, AgentError>();

				yield* firePrompt({
					sessionID: sessionState.sessionID,
					text: question,
					errorDeferred,
					client,
					provider: config.provider,
					model: config.model
				}).pipe(Effect.forkDaemon);

				const filtered = eventStream.pipe(
					Stream.mapEffect((event) => {
						if (event.type === "session.error") {
							const props: any = event.properties;
							return Effect.fail(
								new AgentError({
									message: props?.error?.name ?? "Unknown session error",
									cause: props?.error
								})
							);
						}
						return Effect.succeed(event);
					}),
					Stream.interruptWhen(Deferred.await(errorDeferred)),
					Stream.ensuring(Effect.sync(() => server.close()))
				);

				return {
					stream: filtered,
					model: { provider: config.provider, model: config.model }
				};
			});

		const ask: AgentService["ask"] = ({ collection, question }) =>
			Effect.gen(function* () {
				const { stream, model } = yield* askStream({ collection, question });
				const events = yield* stream.pipe(Stream.runCollect).pipe(Effect.map((chunk) => Array.from(chunk)));
				return {
					answer: extractAnswerFromEvents(events),
					model,
					events
				};
			});

		return { askStream, ask };
	})
);
