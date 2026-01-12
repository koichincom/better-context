#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const platform = os.platform();
const arch = os.arch();

// Map to our binary names
function getBinaryName() {
	if (platform === 'darwin') {
		return arch === 'arm64' ? 'btca-darwin-arm64' : 'btca-darwin-x64';
	} else if (platform === 'linux') {
		return arch === 'arm64' ? 'btca-linux-arm64' : 'btca-linux-x64';
	} else if (platform === 'win32') {
		return 'btca-windows-x64.exe';
	}
	return null;
}

const binaryName = getBinaryName();

if (!binaryName) {
	console.error(`Unsupported platform: ${platform}-${arch}`);
	console.error('Please install bun and run: bun x @btca/cli');
	process.exit(1);
}

const binaryPath = path.join(__dirname, 'dist', binaryName);

if (!fs.existsSync(binaryPath)) {
	// Binary not found - try running with bun directly
	try {
		execSync('bun --version', { stdio: 'ignore' });
		// Bun is available, run with bun
		const result = spawn('bun', [path.join(__dirname, 'src', 'index.ts'), ...process.argv.slice(2)], {
			stdio: 'inherit'
		});
		result.on('exit', (code) => process.exit(code || 0));
	} catch {
		console.error(`Binary not found for your platform: ${platform}-${arch}`);
		console.error('Please install bun (https://bun.sh) and run: bun x @btca/cli');
		process.exit(1);
	}
} else {
	// Run the native binary
	const result = spawn(binaryPath, process.argv.slice(2), {
		stdio: 'inherit'
	});
	result.on('exit', (code) => process.exit(code || 0));
}
