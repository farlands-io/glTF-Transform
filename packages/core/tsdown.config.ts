import { defineConfig } from 'tsdown';
import baseConfig from '../../tsdown.config.ts';

export default defineConfig({
	...baseConfig,
	deps: {
		alwaysBundle: ['property-graph'],
		onlyBundle: ['property-graph'],
		neverBundle: ['node:fs', 'node:path'],
	},
});
