import { expect, test } from '@playwright/test'

test('installed dockview-svelte renders a basic panel', async ({ page }) => {
	await page.goto('/')

	await expect(page.getByRole('tab', { name: /Hello/ })).toBeVisible()
	await expect(page.getByText('Hello from installed package')).toBeVisible()
})
