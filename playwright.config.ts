import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
	testDir: './tests',
	webServer: {
		command: 'npm run dev -- --port 5174',
		url: 'http://localhost:5174',
		reuseExistingServer: true,
		timeout: 30_000,
	},
	use: {
		baseURL: 'http://localhost:5174',
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
