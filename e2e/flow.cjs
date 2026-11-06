// 시연 흐름 점검: 홈 → 표정 연습 → 카메라 시작 → 2초 기본 표정 측정 → 표정 선택 → 미소 연습
// 가짜 카메라에 얼굴 영상(face.y4m)을 넣어서 실제 브라우저(Edge)로 끝까지 눌러 봅니다.
const { chromium } = require('playwright-core')
const path = require('path')

const URL = process.argv[2] || 'https://facemate.vercel.app'
const OUT = path.join(__dirname, 'shots')
require('fs').mkdirSync(OUT, { recursive: true })

const log = (...a) => console.log(...a)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--use-file-for-fake-video-capture=' + path.join(__dirname, 'face.y4m'),
    ],
  })
  const ctx = await browser.newContext({ viewport: { width: 480, height: 1000 }, permissions: ['camera'] })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
  const failedReq = []
  page.on('requestfailed', (r) => failedReq.push(r.url() + ' ' + (r.failure() || {}).errorText))
  const reqs = []
  page.on('request', (r) => { if (/mediapipe|googleapis|jsdelivr/.test(r.url())) reqs.push(r.url().replace(URL, '')) })

  const step = async (name, fn) => {
    try { await fn(); log('✅', name) } catch (e) { log('❌', name, '-', e.message.split('\n')[0]); await page.screenshot({ path: path.join(OUT, 'FAIL-' + name.replace(/\W+/g, '_') + '.png') }); throw e }
  }

  try {
    await step('홈 열기', async () => { await page.goto(URL, { waitUntil: 'networkidle' }); await page.getByText('표정 연습').first().waitFor({ timeout: 15000 }) })
    await page.screenshot({ path: path.join(OUT, '1-home.png') })
    await step('표정 연습 들어가기', async () => { await page.locator('button.home-card.practice').click(); await page.getByRole('button', { name: /카메라 시작/ }).waitFor({ timeout: 10000 }) })
    await page.screenshot({ path: path.join(OUT, '2-before-camera.png') })
    await step('카메라 시작 → 모델 불러오기 → 카메라 켜짐', async () => {
      await page.getByRole('button', { name: /카메라 시작/ }).click()
      await page.getByRole('button', { name: /카메라 정지/ }).waitFor({ timeout: 60000 })
    })
    await page.screenshot({ path: path.join(OUT, '3-camera-on.png') })
    await step('표정 연습 시작 → 기본 표정 측정(얼굴 인식됨)', async () => {
      await page.getByRole('button', { name: /표정 연습 시작/ }).click()
      await page.getByText('편안한 표정을 측정 중입니다').waitFor({ timeout: 10000 })
      await page.screenshot({ path: path.join(OUT, '4-measuring.png') })
      // 측정이 끝나 표정 선택 화면이 나오면 얼굴이 인식되어 2초가 채워졌다는 뜻
      await page.getByText('연습할 표정을 선택해 주세요.').waitFor({ timeout: 30000 })
    })
    await page.screenshot({ path: path.join(OUT, '5-menu.png') })
    await step('미소 연습 시작 → 게이지 표시', async () => {
      await page.getByRole('button', { name: /미소/ }).first().click()
      await page.getByText(/전체 미소 달성도/).waitFor({ timeout: 10000 })
      await sleep(1500)
    })
    await page.screenshot({ path: path.join(OUT, '6-smile-practice.png') })
    const pct = await page.locator('.meter.strong .meter-head b').first().textContent().catch(() => '?')
    log('   전체 미소 달성도 표시값:', pct)
    await step('카메라 정지', async () => { await page.getByRole('button', { name: /카메라 정지/ }).click(); await page.getByRole('button', { name: /카메라 시작/ }).waitFor({ timeout: 5000 }) })
    log('\n결과: 시연 흐름 전체 통과')
  } catch (e) {
    log('\n결과: 시연 흐름 실패 —', e.message.split('\n')[0])
  } finally {
    log('모델·엔진 요청:', reqs.length ? '\n  ' + [...new Set(reqs)].join('\n  ') : '(없음)')
    log('실패한 요청:', failedReq.length ? failedReq : '(없음)')
    log('콘솔 오류:', errors.length ? errors : '(없음)')
    await browser.close()
  }
})()
