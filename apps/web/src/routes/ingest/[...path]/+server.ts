import type { RequestHandler } from './$types';

const POSTHOG_HOST = 'https://us.i.posthog.com';

export const GET: RequestHandler = async ({ params, request }) => {
	const url = new URL(request.url);
	const targetUrl = `${POSTHOG_HOST}/${params.path}${url.search}`;

	const response = await fetch(targetUrl, {
		method: 'GET',
		headers: filterHeaders(request.headers)
	});

	return new Response(response.body, {
		status: response.status,
		headers: filterResponseHeaders(response.headers)
	});
};

export const POST: RequestHandler = async ({ params, request }) => {
	const url = new URL(request.url);
	const targetUrl = `${POSTHOG_HOST}/${params.path}${url.search}`;

	const response = await fetch(targetUrl, {
		method: 'POST',
		headers: filterHeaders(request.headers),
		body: await request.text()
	});

	return new Response(response.body, {
		status: response.status,
		headers: filterResponseHeaders(response.headers)
	});
};

const filterHeaders = (headers: Headers): HeadersInit => {
	const filtered: Record<string, string> = {};
	const skipHeaders = new Set(['host', 'connection', 'content-length']);

	headers.forEach((value, key) => {
		if (!skipHeaders.has(key.toLowerCase())) {
			filtered[key] = value;
		}
	});

	return filtered;
};

const filterResponseHeaders = (headers: Headers): HeadersInit => {
	const filtered: Record<string, string> = {};
	const skipHeaders = new Set(['content-encoding', 'transfer-encoding', 'connection']);

	headers.forEach((value, key) => {
		if (!skipHeaders.has(key.toLowerCase())) {
			filtered[key] = value;
		}
	});

	return filtered;
};
