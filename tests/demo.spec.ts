import { expect, test } from '@playwright/test'

test('demo renders three panels with shared tab/content state', async ({ page }) => {
	await page.goto('/')

	// Three tabs: First, Second, plain (default title = widget key).
	await expect(page.getByRole('tab', { name: /First/ })).toBeVisible()
	await expect(page.getByRole('tab', { name: /Second/ })).toBeVisible()
	await expect(page.getByRole('tab', { name: /plain/ })).toBeVisible()

	// Active panel content shows its params.
	await expect(page.getByRole('tabpanel').getByText('no custom tab')).toBeVisible()
})

test('custom channel round-trips from content to tab badge', async ({ page }) => {
	await page.goto('/')

	// The `example` widget has a custom tab with an unread badge; `plain` uses
	// DefaultTab (no badge). Activate "First", bump unread, check its tab badge.
	await page.getByRole('tab', { name: /First/ }).click()
	await page.getByRole('tabpanel').getByRole('button', { name: 'unread++' }).click()
	await expect(page.getByRole('tab', { name: /First/ }).getByText('1')).toBeVisible()
})

test('layout round-trips through bind:layout', async ({ page }) => {
	await page.goto('/')

	// Close one panel; layout serialization must still include the others.
	await page
		.getByRole('tab', { name: /Second/ })
		.getByRole('button', { name: /close/i })
		.click()
	await expect(page.getByRole('tab', { name: /Second/ })).toHaveCount(0)
	await expect(page.getByRole('tab', { name: /First/ })).toBeVisible()
})
