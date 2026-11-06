import { put } from '@vercel/blob'

// 의견 받기: 이용자가 쓴 글(종류·내용)만 비공개 Blob 저장소에 저장해요.
// 카메라 영상, 얼굴 정보, 연습 기록, 보호자 설정은 받지도 저장하지도 않아요.
const TYPES = ['feature', 'problem', 'other']
const MAX_LEN = 500

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false }, { status: 400 })
  }

  // 사람이 보지 못하는 칸이 채워져 있으면 자동 입력으로 보고 조용히 무시해요.
  if (body?.website) return Response.json({ ok: true })

  const type = TYPES.includes(body?.type) ? body.type : 'other'
  const text = typeof body?.text === 'string' ? body.text.trim().slice(0, MAX_LEN) : ''
  if (!text) return Response.json({ ok: false }, { status: 400 })

  const t = new Date().toISOString()
  try {
    await put(`feedback/${t}.json`, JSON.stringify({ t, type, text }), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: true,
    })
  } catch {
    return Response.json({ ok: false }, { status: 500 })
  }
  return Response.json({ ok: true })
}
