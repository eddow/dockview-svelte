import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
	testDir: './tests',
	webServer: {
		command: 'npm run dev',
		url: 'http://localhost:5180',
		reuseExistingServer: true,
		timeout: 30_000,
	},
	use: {
		baseURL: 'http://localhost:5180',
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
