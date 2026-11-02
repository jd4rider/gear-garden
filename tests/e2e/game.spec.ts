import { expect, test, type Page } from '@playwright/test'

type Handle = Record<string, any>

async function boot(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(() => Boolean((window as unknown as { __GEAR_GARDEN__?: unknown }).__GEAR_GARDEN__), null, {
    timeout: 30_000,
  })
  await page.waitForFunction(() => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.currentScreen === 'menu', null, {
    timeout: 30_000,
  })
  await expect(page.locator('canvas')).toBeVisible()
}

async function clickLabel(page: Page, label: string): Promise<void> {
  const point = await page.evaluate((value) => {
    const app = (window as unknown as { __GEAR_GARDEN__: any }).__GEAR_GARDEN__
    const screen = app.screenView
    const stack: any[] = [...screen.container.children]
    while (stack.length) {
      const node = stack.pop()
      if (!node) continue
      if (node.label === value) {
        const bounds = node.getBounds()
        return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
      }
      if (node.children) stack.push(...node.children)
    }
    throw new Error(`no node labelled ${value}`)
  }, label)
  await page.mouse.click(point.x, point.y)
}

async function clickModalText(page: Page, prefix: string): Promise<void> {
  const point = await page.evaluate((value) => {
    const app = (window as unknown as { __GEAR_GARDEN__: any }).__GEAR_GARDEN__
    const stack: any[] = [...app.overlayLayer.children]
    while (stack.length) {
      const node = stack.pop()
      if (!node) continue
      if (typeof node.text === 'string' && node.text.startsWith(value)) {
        const bounds = node.getBounds()
        return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
      }
      if (node.children) stack.push(...node.children)
    }
    throw new Error(`no modal button starting ${value}`)
  }, prefix)
  await page.mouse.click(point.x, point.y)
}

async function pegPoint(page: Page, peg: string): Promise<{ x: number; y: number }> {
  return page.evaluate((id) => {
    const app = (window as unknown as { __GEAR_GARDEN__: any }).__GEAR_GARDEN__
    return app.screenView.board.pegPoint(id)
  }, peg)
}

async function playFirstSolution(page: Page): Promise<void> {
  const actions = await page.evaluate(() => {
    const app = (window as unknown as { __GEAR_GARDEN__: any }).__GEAR_GARDEN__
    return JSON.parse(JSON.stringify(app.screenView.level.solution))
  })
  for (const action of actions) {
    if (action.type === 'place') {
      await clickLabel(page, `tray-${action.teeth}-${action.layer}`)
      const point = await pegPoint(page, action.peg)
      await page.mouse.click(point.x, point.y)
      await page.waitForTimeout(150)
    } else if (action.type === 'switch') {
      await page.evaluate((id: string) => {
        const app = (window as unknown as { __GEAR_GARDEN__: any }).__GEAR_GARDEN__
        app.screenView.apply({ type: 'switch', id, value: true })
      }, action.id)
      await page.waitForTimeout(120)
    }
  }
  await clickLabel(page, 'run')
}

const currentScreen = (page: Page) =>
  page.evaluate(() => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.currentScreen)

test('completes garden 1 by touching the tray and the axle', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await boot(page)
  await clickLabel(page, 'menu-play')
  await page.waitForFunction(() => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.currentScreen === 'gameplay')
  const levelId = await page.evaluate(() => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.screenView.level.id)
  expect(levelId).toBe('gg-0001')

  await playFirstSolution(page)
  await page.waitForFunction(() => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.screenView.won === true, null, {
    timeout: 20_000,
  })
  await page.waitForFunction(() => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.hasModal === true, null, {
    timeout: 20_000,
  })
  const result = await page.evaluate(() => {
    const app = (window as unknown as { __GEAR_GARDEN__: any }).__GEAR_GARDEN__
    return { stars: app.save.starsFor('gg-0001'), unlocked: app.save.data.unlocked, last: app.save.data.lastLevel }
  })
  expect(result.stars).toBe(3)
  expect(result.unlocked).toBe(2)
  expect(result.last).toBe(2)

  await clickModalText(page, 'Next garden')
  await page.waitForFunction(
    () => {
      const app = (window as unknown as { __GEAR_GARDEN__: any }).__GEAR_GARDEN__
      return app.screenView?.level?.id === 'gg-0002' && app.hasModal === false
    },
    null,
    { timeout: 20_000 },
  )
  expect(errors).toEqual([])
})

test('supports undo, redo, hint, pause and keyboard focus', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await boot(page)
  await page.evaluate(() => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.navigate('gameplay', { level: 3, mode: 'journey' }))
  await page.waitForTimeout(300)

  const action = await page.evaluate(() => {
    const app = (window as unknown as { __GEAR_GARDEN__: any }).__GEAR_GARDEN__
    return app.screenView.level.solution.find((item: any) => item.type === 'place')
  })
  await clickLabel(page, `tray-${action.teeth}-${action.layer}`)
  const point = await pegPoint(page, action.peg)
  await page.mouse.click(point.x, point.y)
  await page.waitForTimeout(200)
  expect(await page.evaluate(() => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.screenView.moves)).toBe(1)
  await clickLabel(page, 'undo')
  expect(await page.evaluate(() => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.screenView.moves)).toBe(0)
  await clickLabel(page, 'redo')
  expect(await page.evaluate(() => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.screenView.moves)).toBe(1)
  await clickLabel(page, 'hint')
  await page.waitForTimeout(150)
  expect(await page.evaluate(() => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.screenView.hints)).toBe(1)

  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  expect(await page.evaluate(() => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.hasModal)).toBe(true)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  expect(await page.evaluate(() => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.hasModal)).toBe(false)

  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  expect(
    await page.evaluate(() => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.screenView.board.focus),
  ).toBeTruthy()
  expect(errors).toEqual([])
})

test('keeps the portrait layout on small phones and survives a rotation', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 360, height: 800 })
  await boot(page)
  await page.evaluate(() => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.navigate('gameplay', { level: 399, mode: 'journey' }))
  await page.waitForTimeout(400)
  const layout = await page.evaluate(() => {
    const app = (window as unknown as { __GEAR_GARDEN__: any }).__GEAR_GARDEN__
    const board = app.screenView.board.getBounds()
    return { x: board.x, width: board.width, screen: window.innerWidth }
  })
  expect(layout.x).toBeGreaterThanOrEqual(-1)
  expect(layout.x + layout.width).toBeLessThanOrEqual(layout.screen + 1)

  await page.setViewportSize({ width: 900, height: 500 })
  await page.waitForTimeout(700)
  expect(await currentScreen(page)).toBe('gameplay')
  expect(await page.evaluate(() => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.width)).toBe(720)
  expect(errors).toEqual([])
})

test('navigates worlds, levels, settings, achievements and free build', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await boot(page)
  await clickLabel(page, 'menu-journey')
  await page.waitForFunction(() => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.currentScreen === 'worlds')
  await clickLabel(page, 'world-1')
  await page.waitForFunction(() => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.currentScreen === 'levels')
  await clickLabel(page, 'level-1')
  await page.waitForFunction(() => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.currentScreen === 'gameplay')

  await page.evaluate(() => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.navigate('settings'))
  await page.waitForTimeout(300)
  await page.evaluate(() => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.navigate('achievements'))
  await page.waitForTimeout(300)
  await page.evaluate(() => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.navigate('sandbox'))
  await page.waitForTimeout(400)
  await clickLabel(page, 'tray-12-0')
  const point = await pegPoint(page, 'a1')
  await page.mouse.click(point.x, point.y)
  await page.waitForTimeout(250)
  expect(
    await page.evaluate(
      () => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.screenView.state.gears.length,
    ),
  ).toBe(1)
  expect(errors).toEqual([])
})

test('restores progress after a reload', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.navigate('gameplay', { level: 1, mode: 'journey' }))
  await page.waitForTimeout(300)
  await playFirstSolution(page)
  await page.waitForFunction(
    () => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.save.data.unlocked === 2,
    null,
    { timeout: 20_000 },
  )
  await page.reload()
  await page.waitForFunction(() => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.currentScreen === 'menu', null, {
    timeout: 30_000,
  })
  const saved = await page.evaluate(() => {
    const app = (window as unknown as { __GEAR_GARDEN__: any }).__GEAR_GARDEN__
    return { stars: app.save.starsFor('gg-0001'), last: app.save.data.lastLevel }
  })
  expect(saved.stars).toBe(3)
  expect(saved.last).toBe(2)
  await clickLabel(page, 'menu-continue')
  await page.waitForFunction(() => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.currentScreen === 'gameplay')
  expect(
    await page.evaluate(() => (window as unknown as { __GEAR_GARDEN__: Handle }).__GEAR_GARDEN__.screenView.level.id),
  ).toBe('gg-0002')
})
