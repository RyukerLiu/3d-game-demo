import { test, expect, Page } from '@playwright/test'

async function state(page: Page) {
  return page.evaluate(() => window.__GAME__.getState())
}

async function moveTo(page: Page, x: number, z: number, tolerance = .55) {
  for (let step = 0; step < 80; step++) {
    const s = await state(page)
    const [px,,pz] = s.player
    if (Math.abs(px-x) < tolerance && Math.abs(pz-z) < tolerance) return
    const keys:string[]=[]
    if (px < x-tolerance) keys.push('d')
    if (px > x+tolerance) keys.push('a')
    if (pz < z-tolerance) keys.push('s')
    if (pz > z+tolerance) keys.push('w')
    for (const k of keys) await page.keyboard.down(k)
    await page.waitForTimeout(90)
    for (const k of keys) await page.keyboard.up(k)
  }
  throw new Error(`Could not reach ${x},${z}: ${JSON.stringify(await state(page))}`)
}

test('complete player-visible loop from start to reversal', async ({ page }) => {
  const errors:string[]=[]
  page.on('console', msg => { if (msg.type()==='error') errors.push(msg.text()) })
  page.on('pageerror', err => errors.push(err.message))
  await page.goto('./')
  await expect(page.locator('#intro')).toHaveClass(/visible/)
  await expect(page.locator('canvas')).toBeVisible()
  await page.getByRole('button', { name: /進入荒野/ }).click()

  await moveTo(page,-7,3)
  await expect.poll(async()=>(await state(page)).collected).toContain('WOOD')
  await moveTo(page,7,1)
  await expect.poll(async()=>(await state(page)).collected).toContain('STONE')
  await moveTo(page,5,-7)
  await expect.poll(async()=>(await state(page)).collected).toContain('CLOTH')
  await expect.poll(async()=>(await state(page)).phase).toBe('build')

  await moveTo(page,0,-6.8,1)
  await page.keyboard.press('e')
  await expect.poll(async()=>(await state(page)).phase).toBe('night')
  await expect(page.locator('#objective')).toContainText('走進')

  await moveTo(page,0,-6.8,.7)
  await expect.poll(async()=>(await state(page)).phase).toBe('ending')
  await expect(page.locator('#ending')).toHaveClass(/visible/, { timeout: 3000 })
  await expect(page.getByText(/你又蓋在/)).toBeVisible()
  await expect(page.getByRole('button',{name:/再試一次/})).toBeVisible()
  expect(errors).toEqual([])
  await page.screenshot({path:'test-results/complete-loop.png',fullPage:true})
})

test('restart returns to the opening state', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: /進入荒野/ }).click()
  await page.evaluate(()=>{window.__GAME__.collectAll();window.__GAME__.build();window.__GAME__.enterShelter()})
  await expect(page.locator('#ending')).toHaveClass(/visible/, {timeout:3000})
  await page.getByRole('button',{name:/再試一次/}).click()
  await expect(page.locator('#intro')).toHaveClass(/visible/)
  expect((await state(page)).phase).toBe('intro')
})
