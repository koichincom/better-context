import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { Config, DEFAULT_MODEL, DEFAULT_PROVIDER, DEFAULT_RESOURCES } from './index.ts';

describe('Config', () => {
	let testDir: string;
	let originalCwd: string;
	let originalHome: string | undefined;

	beforeEach(async () => {
		testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'btca-config-test-'));
		originalCwd = process.cwd();
		originalHome = process.env.HOME;
		// Point HOME to test dir so global config goes there
		process.env.HOME = testDir;
	});

	afterEach(async () => {
		process.chdir(originalCwd);
		process.env.HOME = originalHome;
		await fs.rm(testDir, { recursive: true, force: true });
	});

	describe('Config.load', () => {
		it('creates default config when no config exists', async () => {
			process.chdir(testDir);

			const config = await Config.load();

			expect(config.provider).toBe(DEFAULT_PROVIDER);
			expect(config.model).toBe(DEFAULT_MODEL);
			expect(config.resources.length).toBe(DEFAULT_RESOURCES.length);
			expect(config.getResource('svelte')).toBeDefined();
		});

		it('loads project config when btca.config.jsonc exists in cwd (merged with global)', async () => {
			const projectConfig = {
				$schema: 'https://btca.dev/btca.schema.json',
				provider: 'test-provider',
				model: 'test-model',
				resources: [
					{
						name: 'test-resource',
						type: 'git',
						url: 'https://github.com/test/repo',
						branch: 'main'
					}
				]
			};

			await fs.writeFile(path.join(testDir, 'btca.config.jsonc'), JSON.stringify(projectConfig));
			process.chdir(testDir);

			const config = await Config.load();

			// Project provider/model should take priority
			expect(config.provider).toBe('test-provider');
			expect(config.model).toBe('test-model');
			// Resources are merged: 1 project resource + 3 default resources = 4 total
			expect(config.resources.length).toBe(1 + DEFAULT_RESOURCES.length);
			expect(config.getResource('test-resource')).toBeDefined();
			// Default resources should still be present
			expect(config.getResource('svelte')).toBeDefined();
		});

		it('handles JSONC with comments', async () => {
			const projectConfigWithComments = `{
				// This is a comment
				"$schema": "https://btca.dev/btca.schema.json",
				"provider": "commented-provider",
				"model": "commented-model",
				/* Multi-line
				   comment */
				"resources": [
					{
						"name": "commented-resource",
						"type": "git",
						"url": "https://github.com/test/repo",
						"branch": "main",
					}
				],
			}`;

			await fs.writeFile(path.join(testDir, 'btca.config.jsonc'), projectConfigWithComments);
			process.chdir(testDir);

			const config = await Config.load();

			expect(config.provider).toBe('commented-provider');
			expect(config.model).toBe('commented-model');
		});

		it('getResource returns undefined for unknown resource', async () => {
			process.chdir(testDir);

			const config = await Config.load();

			expect(config.getResource('nonexistent')).toBeUndefined();
		});

		it('throws ConfigError for invalid JSON', async () => {
			await fs.writeFile(path.join(testDir, 'btca.config.jsonc'), 'not valid json {{{');
			process.chdir(testDir);

			expect(Config.load()).rejects.toThrow('Failed to parse config file');
		});

		it('throws ConfigError for invalid schema', async () => {
			const invalidConfig = {
				provider: 'test'
				// missing required fields
			};

			await fs.writeFile(path.join(testDir, 'btca.config.jsonc'), JSON.stringify(invalidConfig));
			process.chdir(testDir);

			expect(Config.load()).rejects.toThrow('Invalid config');
		});

		it('merges project config with global config (project takes priority)', async () => {
			// Create global config with some resources
			const globalConfigDir = path.join(testDir, '.config', 'btca');
			await fs.mkdir(globalConfigDir, { recursive: true });
			const globalConfig = {
				$schema: 'https://btca.dev/btca.schema.json',
				provider: 'global-provider',
				model: 'global-model',
				resources: [
					{
						name: 'shared-resource',
						type: 'git',
						url: 'https://github.com/global/repo',
						branch: 'main'
					},
					{
						name: 'global-only-resource',
						type: 'git',
						url: 'https://github.com/global/only',
						branch: 'main'
					}
				]
			};
			await fs.writeFile(
				path.join(globalConfigDir, 'btca.config.jsonc'),
				JSON.stringify(globalConfig)
			);

			// Create project config that overrides some settings
			const projectDir = path.join(testDir, 'my-project');
			await fs.mkdir(projectDir, { recursive: true });
			const projectConfig = {
				$schema: 'https://btca.dev/btca.schema.json',
				provider: 'project-provider',
				model: 'project-model',
				resources: [
					{
						name: 'shared-resource',
						type: 'git',
						url: 'https://github.com/project/repo', // Different URL - should override
						branch: 'develop'
					},
					{
						name: 'project-only-resource',
						type: 'git',
						url: 'https://github.com/project/only',
						branch: 'main'
					}
				]
			};
			await fs.writeFile(path.join(projectDir, 'btca.config.jsonc'), JSON.stringify(projectConfig));
			process.chdir(projectDir);

			const config = await Config.load();

			// Project provider/model should take priority
			expect(config.provider).toBe('project-provider');
			expect(config.model).toBe('project-model');

			// Should have 3 resources: shared (from project), global-only, project-only
			expect(config.resources.length).toBe(3);

			// shared-resource should have project's URL (override)
			const sharedResource = config.getResource('shared-resource');
			expect(sharedResource).toBeDefined();
			expect(sharedResource?.type).toBe('git');
			if (sharedResource?.type === 'git') {
				expect(sharedResource.url).toBe('https://github.com/project/repo');
				expect(sharedResource.branch).toBe('develop');
			}

			// global-only-resource should still be present
			const globalOnlyResource = config.getResource('global-only-resource');
			expect(globalOnlyResource).toBeDefined();
			if (globalOnlyResource?.type === 'git') {
				expect(globalOnlyResource.url).toBe('https://github.com/global/only');
			}

			// project-only-resource should be present
			const projectOnlyResource = config.getResource('project-only-resource');
			expect(projectOnlyResource).toBeDefined();
			if (projectOnlyResource?.type === 'git') {
				expect(projectOnlyResource.url).toBe('https://github.com/project/only');
			}
		});

		it('uses only global config when no project config exists', async () => {
			// Create global config
			const globalConfigDir = path.join(testDir, '.config', 'btca');
			await fs.mkdir(globalConfigDir, { recursive: true });
			const globalConfig = {
				$schema: 'https://btca.dev/btca.schema.json',
				provider: 'global-provider',
				model: 'global-model',
				resources: [
					{
						name: 'global-resource',
						type: 'git',
						url: 'https://github.com/global/repo',
						branch: 'main'
					}
				]
			};
			await fs.writeFile(
				path.join(globalConfigDir, 'btca.config.jsonc'),
				JSON.stringify(globalConfig)
			);

			// Create project directory without config
			const projectDir = path.join(testDir, 'my-project');
			await fs.mkdir(projectDir, { recursive: true });
			process.chdir(projectDir);

			const config = await Config.load();

			expect(config.provider).toBe('global-provider');
			expect(config.model).toBe('global-model');
			expect(config.resources.length).toBe(1);
			expect(config.getResource('global-resource')).toBeDefined();
		});
	});
});
