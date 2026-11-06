// 연습 결과 피드백 (규칙 기반, 기기 안에서만 계산해요. 서버나 AI 모델을 쓰지 않아요.)
// 표정 움직임이 얼마나 감지됐는지만 알려주며, 감정이나 능력을 평가하지 않아요.
export const FB_GOOD = 0.7 // 이 이상이면 '충분'
export const FB_LOW = 0.5 // 이 미만이면 '작게 감지됨' → 다음 연습 안내

const pct = (v) => (typeof v === 'number' ? v : 0)

// ui: 완료 시점의 달성도 값들(0~1)
export function buildFeedback(expr, ui) {
  let parts
  if (expr === 'smile') {
    parts = [
      { name: '입꼬리', v: pct(ui.mouth), tip: '입꼬리 움직임이 작게 감지됐어요. 다음에는 입꼬리를 편안하게 조금 올리는 연습을 해보세요.' },
      { name: '눈 주변', v: pct(ui.eye), tip: '눈 주변의 움직임이 작게 감지됐어요. 다음에는 볼을 살짝 올리는 연습을 해보세요.' },
    ]
  } else if (expr === 'anger') {
    const brow = (pct(ui.browR) + pct(ui.browL)) / 2
    parts = [
      { name: '눈썹 안쪽', v: brow, tip: '눈썹 안쪽의 움직임이 작게 감지됐어요. 다음에는 눈썹 안쪽을 편안하게 조금 모아보세요.' },
      { name: '미간', v: pct(ui.glab), tip: '미간의 움직임이 작게 감지됐어요. 다음에는 눈썹 사이를 살짝 모아보세요.' },
      { name: '입꼬리', v: pct(ui.mouthDown), tip: '입꼬리 변화가 작게 감지됐어요. 다음에는 입꼬리를 아주 살짝 내려보세요.' },
    ]
    if (Math.abs(pct(ui.browR) - pct(ui.browL)) > 0.3) {
      const weaker = pct(ui.browR) < pct(ui.browL) ? '오른쪽' : '왼쪽'
      parts.push({
        name: '양쪽 균형', v: 0,
        tip: `${weaker} 눈썹의 움직임이 더 작게 감지됐어요. 거울을 보며 양쪽을 비슷하게 움직여 보세요.`,
      })
    }
  } else {
    parts = [
      { name: '눈썹', v: pct(ui.surBrow), tip: '눈썹 움직임이 작게 감지됐어요. 다음에는 눈썹을 편안하게 조금 올려보세요.' },
      { name: '눈 주변', v: pct(ui.surEye), tip: '눈 주변의 움직임이 작게 감지됐어요. 다음에는 눈을 부드럽게 조금 더 크게 떠 보세요.' },
      { name: '입', v: pct(ui.surMouth), tip: '입 벌림이 작게 감지됐어요. 다음에는 입을 살짝만 벌려보세요.' },
    ]
  }

  const show = (p) => ` (${Math.round(p.v * 100)}%)`
  const good = parts.filter((p) => p.v >= FB_GOOD).map((p) => `${p.name} 움직임은 충분했어요.${show(p)}`)
  const tips = parts
    .filter((p) => p.v < FB_GOOD)
    .map((p) => {
      if (p.v < FB_LOW) return p.tip + show(p)
      // 조금 부족한 경우: 부족하다고 알리고 같은 연습 방법을 안내
      const act = p.tip.split('다음에는 ')[1]
      return `${p.name} 움직임이 조금 부족했어요.${act ? (act.includes('조금') ? ` ${act}` : ` 조금 더 ${act}`) : ''}${show(p)}`
    })
  if (!good.length && !tips.length) good.push('전체적으로 목표에 가까운 움직임이었어요.')
  return { good, tips }
}
