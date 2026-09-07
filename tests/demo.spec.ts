import { expect, test } from '@playwright/test'

test('landing page redirects to a complete demo', async ({ page }) => {
	await page.goto('/')

	// `/` redirects to `/demos/basic` — a complete demo, not an index page.
	await expect(page).toHaveURL(/\/demos\/basic$/)
	await expect(page.getByRole('tab', { name: /Basic/ })).toBeVisible()
	await expect(page.getByRole('tabpanel').getByText('Hello from a widget')).toBeVisible()
	// The nav still links every demo.
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
		'Declarative widgets',
	]) {
		await expect(page.getByRole('link', { name })).toBeVisible()
	}
})

test('basic demo opens a widget with highlighted source', async ({ page }) => {
	await page.goto('/demos/basic')

	await expect(page.getByRole('tab', { name: /Basic/ })).toBeVisible()
	await expect(page.getByRole('tabpanel').getByText('Hello from a widget')).toBeVisible()
	// Code starts hidden (demo full-width); "Show code" reveals it at 50/50.
	await expect(page.getByRole('button', { name: 'Show code' })).toBeVisible()
	await page.getByRole('button', { name: 'Show code' }).click()
	await expect(page.getByRole('button', { name: 'Hide code' })).toBeVisible()
	// Display-only Shiki block shows the demo source.
	await expect(page.getByText('openPanel', { exact: false }).first()).toBeVisible()
	// Both outer panes render side by side with non-zero width (~50/50).
	// (Scoped to `.pane-scroll`: the outer split's two panes. A bare
	// `.dv-view` selector would also match dockview's nested splitviews
	// inside the demo itself.)
	const widths = await page
		.locator('.split-wrap .pane-scroll')
		.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width))
	expect(widths.length).toBe(2)
	for (const w of widths) expect(w).toBeGreaterThan(100)
	const ratio = widths[0] / (widths[0] + widths[1])
	expect(ratio).toBeGreaterThan(0.35)
	expect(ratio).toBeLessThan(0.65)
	// Hiding collapses the pane again.
	await page.getByRole('button', { name: 'Hide code' }).click()
	await expect(page.getByRole('button', { name: 'Show code' })).toBeVisible()
})

test('params demo round-trips reactive params', async ({ page }) => {
	await page.goto('/demos/params')

	await expect(page.getByRole('tab', { name: /Counter/ })).toBeVisible()
	await page.getByRole('tabpanel').getByRole('button', { name: '+ step (local)' }).click()
	await expect(page.getByRole('tabpanel').getByText('12', { exact: false })).toBeVisible()
})

test('params demo pushes widget params to dockview (two-way)', async ({ page }) => {
	await page.goto('/demos/params')

	await expect(page.getByRole('tab', { name: /Counter/ })).toBeVisible()
	// `step++ (param)` mutates `state.params.step` → `api.updateParameters`;
	// the panel text re-renders from the merged params.
	await page.getByRole('tabpanel').getByRole('button', { name: 'step++ (param)' }).click()
	await expect(page.getByRole('tabpanel').getByText('step=3', { exact: false })).toBeVisible()
	// The page holds the SAME state object via the PanelHandle — it sees the
	// widget's write without any extra wiring.
	await expect(page.getByText('page sees: start=10, step=3', { exact: false })).toBeVisible()
	// And the reverse: a page-side write propagates into the widget.
	await page.getByRole('button', { name: /page: step\+\+/ }).click()
	await expect(page.getByRole('tabpanel').getByText('step=4', { exact: false })).toBeVisible()
	// `rename to count` exercises the per-panel api escape hatch.
	await page.getByRole('tabpanel').getByRole('button', { name: 'rename to count' }).click()
	await expect(page.getByRole('tab', { name: /Count/ })).toBeVisible()
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

test('layout demo persists bind:layout across a page reload', async ({ page }) => {
	await page.goto('/demos/layout')

	await expect(page.getByRole('tab', { name: 'Panel A' })).toBeVisible()
	// Close Panel A, then reload: the `bind:layout` JSON round-trips through
	// `fromJSON`, so the closed panel stays closed.
	await page.getByRole('tab', { name: 'Panel A' }).getByRole('button', { name: /close/i }).click()
	await expect(page.getByRole('tab', { name: 'Panel A' })).toHaveCount(0)
	await page.reload()
	await expect(page.getByRole('tab', { name: 'Panel A' })).toHaveCount(0)
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

test('events demo updates bind:active on user tab click', async ({ page }) => {
	await page.goto('/demos/events')

	await expect(page.getByText('active panel: b-1')).toBeVisible()
	await page.getByRole('tab', { name: 'A' }).click()
	await expect(page.getByText('active panel: a-1')).toBeVisible()
	await expect(page.getByText('active panel → a-1').first()).toBeVisible()
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
	// Real click (not dispatchEvent): the overlay must sit above dockview's
	// own `.dv-watermark-container` or the click is swallowed.
	await page.locator('.dv-svelte-watermark-overlay button').click()
	await expect(page.getByRole('tab', { name: 'A' })).toBeVisible()
	await page.getByRole('button', { name: 'close all' }).click()
	await expect(watermarkText).toBeVisible()
})

test('splitview demo opens panes and toggles orientation', async ({ page }) => {
	await page.goto('/demos/splitview')

	const demo = page.locator('.demo')
	// Both panes render side by side with non-zero width (no collapsed first pane).
	await expect(demo.getByText('Left pane', { exact: true })).toBeVisible()
	await expect(demo.getByText('Right pane', { exact: true })).toBeVisible()
	await expect(page.getByText('views: 2')).toBeVisible()
	const widths = await demo
		.locator(':scope .dv-view-container > .dv-view')
		.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width))
	expect(widths.length).toBe(2)
	for (const w of widths) expect(w).toBeGreaterThan(100)
	// The last opened pane is active via `bind:activeView`.
	await expect(page.getByText('active: b-1')).toBeVisible()
	// Activating the other pane follows through the per-panel active event
	// (the library derives `bind:activeView` from it).
	await demo
		.locator('.split', { hasText: 'Left pane' })
		.getByRole('button', { name: 'activate' })
		.click()
	await expect(
		demo.locator('.split', { hasText: 'Left pane' }).getByText('active: true', { exact: false })
	).toBeVisible()
	await expect(page.getByText('active: a-1')).toBeVisible()
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
	// 2x2 grid: all four cells render with non-zero size.
	for (const name of ['Top-left cell', 'Top-right cell', 'Bottom-left cell', 'Bottom-right cell']) {
		await expect(demo.getByText(name, { exact: true })).toBeVisible()
	}
	await expect(page.getByText('cells: 4')).toBeVisible()
	// The last opened cell is active via `bind:activePanel` (synced on the
	// open path — dockview fires no active event for programmatic adds).
	await expect(page.getByText('active: b-2')).toBeVisible()
	// Activating another cell follows through the per-panel active event
	// (the library derives `bind:activePanel` from it).
	await demo
		.locator('.grid', { hasText: 'Top-left cell' })
		.getByRole('button', { name: 'activate' })
		.click()
	await expect(
		demo.locator('.grid', { hasText: 'Top-left cell' }).getByText('active: true', { exact: false })
	).toBeVisible()
	await expect(page.getByText('active: a-1')).toBeVisible()
	// Add a cell → count updates.
	await page.getByRole('button', { name: 'add cell' }).click()
	await expect(page.getByText('cells: 5')).toBeVisible()
	// Orientation toggle flips the button label.
	await page.getByRole('button', { name: /orientation:/ }).click()
	await expect(page.getByRole('button', { name: 'orientation: vertical' })).toBeVisible()
	await expect(demo.getByText('Top-right cell', { exact: true })).toBeVisible()
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

test('declarative demo opens a DvWidget panel', async ({ page }) => {
	await page.goto('/demos/declarative')

	await expect(page.getByRole('tab', { name: /Basic/ })).toBeVisible()
	await expect(page.getByRole('tabpanel').getByText('panel #1')).toBeVisible()
	// Each added panel gets an auto-incremented number param.
	await page.getByRole('button', { name: 'add panel' }).click()
	await expect(page.getByRole('tabpanel').getByText('panel #2')).toBeVisible()
})
