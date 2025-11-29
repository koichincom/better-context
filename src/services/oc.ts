import { createOpencode } from "@opencode-ai/sdk";
import { Effect } from "effect";
import { TaggedError } from "effect/Data";

class OcError extends TaggedError("OcError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

const ocService = Effect.gen(function* () {
  const { client, server } = yield* Effect.tryPromise({
    try: () =>
      createOpencode({
        port: 3420,
      }),
    catch: (err) =>
      new OcError({ message: "FAILED TO CREATE OPENCODE CLIENT", cause: err }),
  });

  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      console.log("CLOSING OPENCODE SERVER");
      server.close();
    })
  );

  return {
    testPrompting: (prompt: string) =>
      Effect.gen(function* () {
        const session = yield* Effect.promise(() => client.session.create());

        if (session.error) {
          return yield* Effect.fail(
            new OcError({
              message: "FAILED TO START OPENCODE SESSION",
              cause: session.error,
            })
          );
        }

        const resp = yield* Effect.promise(() => {
          return client.session.prompt({
            path: { id: session.data.id },
            body: {
              parts: [{ type: "text", text: prompt }],
            },
          });
        });

        if (resp.error) {
          return yield* Effect.fail(
            new OcError({
              message: "FAILED TO TEST PROMPTING",
              cause: resp.error,
            })
          );
        }

        resp.data.parts.map((part) => {
          console.log(part);
        });

        return null;
      }),
  };
});

export class OcService extends Effect.Service<OcService>()("OcService", {
  scoped: ocService,
}) {}
