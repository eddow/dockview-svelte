import { expect, test } from '@playwright/test'

test('landing page links all demos', async ({ page }) => {
	await page.goto('/')

	for (const name of [
		'open a widget',
		'Reactive params',
		'Custom tab',
		'bind:layout',
		'Themes',
		'bind:active',
		'Empty state',
		'Floating groups',
		'Splitview',
		'Gridview',
		'Paneview',
	]) {
		await expect(page.getByRole('link', { name })).toBeVisible()
	}
})

test('basic demo opens a widget with highlighted source', async ({ page }) => {
	await page.goto('/demos/basic')

	await expect(page.getByRole('tab', { name: /Basic/ })).toBeVisible()
	await expect(page.getByRole('tabpanel').getByText('Hello from a widget')).toBeVisible()
	// Display-only Shiki block shows the demo source.
	await expect(page.getByText('openPanel', { exact: false }).first()).toBeVisible()
})

test('params demo round-trips reactive params', async ({ page }) => {
	await page.goto('/demos/params')

	await expect(page.getByRole('tab', { name: /Counter/ })).toBeVisible()
	await page.getByRole('tabpanel').getByRole('button', { name: '+ step (local)' }).click()
	await expect(page.getByRole('tabpanel').getByText('12', { exact: false })).toBeVisible()
})

test('custom-tab demo shares state between tab and content', async ({ page }) => {
	await page.goto('/demos/custom-tab')

	await page.getByRole('tab', { name: /Inbox \(custom tab\)/ }).click()
	await page
		.getByRole('tabpanel')
		.getByRole('button', { name: /unread\+\+/ })
		.click()
	await expect(page.getByRole('tab', { name: /Inbox \(custom tab\)/ }).getByText('1')).toBeVisible()
})

test('layout demo saves and restores bind:layout', async ({ page }) => {
	await page.goto('/demos/layout')

	await expect(page.getByRole('tab', { name: 'Panel A' })).toBeVisible()
	await expect(page.getByRole('tab', { name: 'Panel B' })).toBeVisible()

	// Save, close a panel, restore → both tabs back.
	await page.getByRole('button', { name: 'save layout' }).click()
	await page.getByRole('button', { name: 'restore layout' }).click()
	await page.getByRole('tab', { name: 'Panel A' }).getByRole('button', { name: /close/i }).click()
	await expect(page.getByRole('tab', { name: 'Panel A' })).toHaveCount(0)
	await page.getByRole('button', { name: 'restore layout' }).click()
	await expect(page.getByRole('tab', { name: 'Panel A' })).toBeVisible()
	await expect(page.getByRole('tab', { name: 'Panel B' })).toBeVisible()
})

test('themes demo switches themes', async ({ page }) => {
	await page.goto('/demos/themes')

	await expect(page.getByRole('tab', { name: /Themed/ })).toBeVisible()
	await page.getByRole('button', { name: 'light' }).click()
	await expect(page.getByRole('button', { name: 'light' })).toHaveAttribute('aria-pressed', 'true')
	await expect(page.getByRole('tab', { name: /Themed/ })).toBeVisible()
})

test('events demo tracks bind:active and event log', async ({ page }) => {
	await page.goto('/demos/events')

	await expect(page.getByText('active panel: b-1')).toBeVisible()
	await expect(page.getByText('added a-1')).toBeVisible()
	await expect(page.getByText('added b-1')).toBeVisible()
})

test('floating demo opens a floating window via openPanel passthrough', async ({ page }) => {
	await page.goto('/demos/floating')

	await expect(page.getByRole('tab', { name: 'A' }).first()).toBeVisible()
	await expect(page.getByText('floating groups: 0')).toBeVisible()
	await page.getByRole('button', { name: 'open floating' }).click()
	await expect(page.getByText('floating groups: 1')).toBeVisible()
	await expect(page.getByRole('tab', { name: 'Floating A' })).toBeVisible()
})

test('floating demo floats an existing panel and docks back', async ({ page }) => {
	await page.goto('/demos/floating')

	await expect(page.getByText('floating groups: 0')).toBeVisible()
	await page.getByRole('button', { name: 'float panel A' }).click()
	await expect(page.getByText('floating groups: 1')).toBeVisible()
	await page.getByRole('button', { name: 'dock all' }).click()
	await expect(page.getByText('floating groups: 0')).toBeVisible()
})

test('floating demo header actions float via group and tab buttons', async ({ page }) => {
	await page.goto('/demos/floating')

	await expect(page.getByText('floating groups: 0')).toBeVisible()
	// Group header slot (rightHeaderActions) renders per group.
	await expect(page.getByRole('button', { name: 'Float group' }).first()).toBeVisible()
	await expect(page.getByRole('button', { name: 'Popout group' }).first()).toBeVisible()
	// Panel header (custom tab) carries per-panel float/popout buttons.
	await expect(page.getByRole('button', { name: 'Float panel' }).first()).toBeVisible()
	await expect(page.getByRole('button', { name: 'Popout panel' }).first()).toBeVisible()
	// Tab float button floats its panel → reactive count updates.
	await page.getByRole('button', { name: 'Float panel' }).first().click()
	await expect(page.getByText('floating groups: 1')).toBeVisible()
	await page.getByRole('button', { name: 'dock all' }).click()
	await expect(page.getByText('floating groups: 0')).toBeVisible()
	// Group header float button floats the whole group.
	await page.getByRole('button', { name: 'Float group' }).first().click()
	await expect(page.getByText('floating groups: 1')).toBeVisible()
})

test('empty demo shows watermark and opens from it', async ({ page }) => {
	await page.goto('/demos/empty')

	const watermarkText = page.locator('.dv-svelte-watermark-overlay p')
	await expect(watermarkText).toBeVisible()
	// The watermark button sits in an overlay (Playwright actionability
	// check fails) — dispatch the click directly instead.
	await page.locator('.dv-svelte-watermark-overlay button').dispatchEvent('click')
	await expect(page.getByRole('tab', { name: 'A' })).toBeVisible()
	await page.getByRole('button', { name: 'close all' }).click()
	await expect(watermarkText).toBeVisible()
})

test('splitview demo opens panes and toggles orientation', async ({ page }) => {
	await page.goto('/demos/splitview')

	const demo = page.locator('.demo')
	// Both panes render; the second is active and visible.
	await expect(demo.getByText('Right pane', { exact: true })).toBeVisible()
	await expect(page.getByText('views: 2')).toBeVisible()
	// Add a pane → count updates.
	await page.getByRole('button', { name: 'add pane' }).click()
	await expect(page.getByText('views: 3')).toBeVisible()
	// Orientation toggle flips the button label.
	await page.getByRole('button', { name: /orientation:/ }).click()
	await expect(page.getByRole('button', { name: 'orientation: vertical' })).toBeVisible()
	await expect(demo.getByText('Right pane', { exact: true })).toBeVisible()
})

test('gridview demo opens cells and toggles orientation', async ({ page }) => {
	await page.goto('/demos/gridview')

	const demo = page.locator('.demo')
	// Both cells render (the second takes the width, like the splitview demo).
	await expect(demo.getByText('Right cell', { exact: true })).toBeVisible()
	await expect(page.getByText('cells: 2')).toBeVisible()
	// Add a cell → count updates.
	await page.getByRole('button', { name: 'add cell' }).click()
	await expect(page.getByText('cells: 3')).toBeVisible()
	// Orientation toggle flips the button label.
	await page.getByRole('button', { name: /orientation:/ }).click()
	await expect(page.getByRole('button', { name: 'orientation: vertical' })).toBeVisible()
	await expect(demo.getByText('Right cell', { exact: true })).toBeVisible()
})

test('paneview demo opens panes and collapses', async ({ page }) => {
	await page.goto('/demos/paneview')

	const demo = page.locator('.demo')
	await expect(demo.getByText('First pane (custom header)', { exact: true })).toBeVisible()
	await expect(page.getByText('panes: 2')).toBeVisible()
	// Add a pane → count updates.
	await page.getByRole('button', { name: 'add pane' }).click()
	await expect(page.getByText('panes: 3')).toBeVisible()
	// Custom header renders the pane title with a collapse toggle.
	await expect(demo.getByText('Pane A', { exact: true }).first()).toBeVisible()
})
