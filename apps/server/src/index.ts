import {
	HttpRouter,
	HttpServer,
	HttpServerRequest,
	HttpServerResponse
} from "@effect/platform";
import { BunContext, BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Effect, Layer, Schema, Stream } from "effect";
import { Agent, AgentLive } from "./agent/index.ts";
import { CollectionError, Collections, CollectionsLive, getCollectionKey } from "./collections/index.ts";
import { Config, ConfigLive } from "./config/index.ts";
import { ResourcesLive } from "./resources/index.ts";

const ServerLayer = BunHttpServer.layer({ port: 8080 });

const QuestionRequestSchema = Schema.Struct({
	question: Schema.String,
	resources: Schema.optional(Schema.Array(Schema.String)),
	quiet: Schema.optional(Schema.Boolean),
	stream: Schema.optional(Schema.Boolean)
});

type QuestionRequest = typeof QuestionRequestSchema.Type;

const jsonResponse = (body: unknown, status = 200) =>
	HttpServerResponse.json(body, { status }).pipe(
		Effect.mapError((cause) => new Error(String(cause))),
		Effect.orDie
	);

const decodeQuestionRequest = (input: unknown): Effect.Effect<QuestionRequest, CollectionError> =>
	Schema.decodeUnknown(QuestionRequestSchema)(input).pipe(
		Effect.mapError(
			(cause) =>
				new CollectionError({
					message: "Invalid request body",
					cause
				})
		)
	);

const errorToResponse = (error: unknown) => {
	const tag =
		error && typeof error === "object" && "_tag" in error
			? String((error as any)._tag)
			: "UnknownError";
	const message =
		error && typeof error === "object" && "message" in error
			? String((error as any).message)
			: String(error);

	const status = tag === "CollectionError" || tag === "ResourceError" ? 400 : 500;
	return jsonResponse({ error: message, tag }, status);
};

const questionHandler = Effect.gen(function* () {
	const req = yield* HttpServerRequest.HttpServerRequest;
	const config = yield* Config;
	const collections = yield* Collections;
	const agent = yield* Agent;

	const body = yield* req.json.pipe(
		Effect.mapError((cause) => new CollectionError({ message: "Failed to parse request JSON", cause }))
	);

	const decoded = yield* decodeQuestionRequest(body);

	const resourceNames =
		decoded.resources && decoded.resources.length > 0
			? decoded.resources
			: config.resources.map((r) => r.name);

	const collection = yield* collections.load({
		resourceNames,
		quiet: decoded.quiet
	});

	if (decoded.stream === true) {
		const { stream: eventStream, model } = yield* agent.askStream({
			collection,
			question: decoded.question
		});

		const toSse = (payload: unknown) => `data: ${JSON.stringify(payload)}\n\n`;

		const streamingState = {
			partIds: [] as string[],
			partText: new Map<string, string>(),
			answer: ""
		};

		const chunkStream = eventStream.pipe(
			Stream.mapConcat((event) => {
				if (event.type === "message.part.updated") {
					const part: any = (event.properties as any).part;
					if (!part || part.type !== "text") return [];

					const partId = String(part.id);
					const nextText = String(part.text ?? "");

					if (!streamingState.partIds.includes(partId)) {
						streamingState.partIds.push(partId);
					}
					streamingState.partText.set(partId, nextText);

					const nextAnswer = streamingState.partIds
						.map((id) => streamingState.partText.get(id) ?? "")
						.join("");

					const delta = nextAnswer.startsWith(streamingState.answer)
						? nextAnswer.slice(streamingState.answer.length)
						: nextAnswer;

					streamingState.answer = nextAnswer;

					return delta.length > 0 ? [toSse({ type: "chunk", text: delta })] : [];
				}

				if (event.type === "session.idle") {
					return [toSse({ type: "done", answer: streamingState.answer })];
				}

				return [];
			}),
			Stream.catchAll((error) =>
				Stream.make(
					toSse({
						type: "error",
						tag:
							error && typeof error === "object" && "_tag" in error
							? String((error as any)._tag)
							: "UnknownError",
						message:
							error && typeof error === "object" && "message" in error
							? String((error as any).message)
							: String(error)
					})
				)
			)
		);

		const metaEvent = toSse({
			type: "meta",
			model,
			resources: resourceNames,
			collection: {
				key: getCollectionKey(resourceNames),
				path: collection.path
			}
		});

		const bodyStream = Stream.concat(Stream.make(metaEvent), chunkStream).pipe(Stream.encodeText);

		return HttpServerResponse.stream(bodyStream, {
			contentType: "text/event-stream",
			headers: {
				"cache-control": "no-cache",
				connection: "keep-alive"
			}
		});
	}

	const result = yield* agent.ask({
		collection,
		question: decoded.question
	});

	return yield* jsonResponse({
		answer: result.answer,
		model: result.model,
		resources: resourceNames,
		collection: {
			key: getCollectionKey(resourceNames),
			path: collection.path
		}
	});
}).pipe(Effect.catchAll(errorToResponse));

const PlatformLayer = BunContext.layer;

const ConfigLayer = ConfigLive.pipe(Layer.provide(PlatformLayer));
const ResourcesLayer = ResourcesLive.pipe(Layer.provide(ConfigLayer), Layer.provide(PlatformLayer));
const CollectionsLayer = CollectionsLive.pipe(
	Layer.provide(ResourcesLayer),
	Layer.provide(ConfigLayer),
	Layer.provide(PlatformLayer)
);
const AgentLayer = AgentLive.pipe(Layer.provide(ConfigLayer), Layer.provide(PlatformLayer));

const ServicesLayer = Layer.mergeAll(ConfigLayer, ResourcesLayer, CollectionsLayer, AgentLayer);
const MainLayer = Layer.mergeAll(ServerLayer, ServicesLayer);

const httpLive = HttpRouter.empty.pipe(
	HttpRouter.get("/", jsonResponse({ ok: true, service: "btca-server" })),
	HttpRouter.post("/question", questionHandler),
	HttpServer.serve(),
	HttpServer.withLogAddress
);

BunRuntime.runMain(Effect.provide(Layer.launch(httpLive), MainLayer));
