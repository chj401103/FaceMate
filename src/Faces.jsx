// 퀴즈용 표정 그림 (직접 그린 SVG 일러스트). 사진이 아니며 외부 이미지·서버를 쓰지 않아요.
const SKIN = ['#fde68a', '#fcd9b6', '#f1b98f']
const INK = '#3b2a1a'

export const FACE_TYPES = ['smile', 'anger', 'surprise']
// 표정마다 그림 6가지: 0~2는 기본, 3~5는 같은 표정을 피부색·머리·기울기를 달리해 그린 것
export const FACE_VARIANTS = 6

export default function Face({ type, variant = 0, size = 180 }) {
  const skin = SKIN[(variant + Math.floor(variant / 3)) % SKIN.length]
  const alt = variant >= 3 // 3~5번은 머리와 기울기가 달라요
  const stroke = { stroke: INK, strokeWidth: 6, strokeLinecap: 'round', fill: 'none' }
  const v = variant % 3

  let features = null
  if (type === 'smile') {
    features = (
      <>
        {/* 눈웃음: 위로 굽은 눈 / 둥근 눈 */}
        {v === 1 ? (
          <>
            <circle cx="70" cy="85" r="7" fill={INK} />
            <circle cx="130" cy="85" r="7" fill={INK} />
          </>
        ) : (
          <>
            <path d="M52 90 Q70 68 88 90" {...stroke} />
            <path d="M112 90 Q130 68 148 90" {...stroke} />
          </>
        )}
        {/* 입: 열린 미소 / 다문 미소 */}
        {v === 0 ? (
          <path d="M58 120 Q100 175 142 120 Z" fill="#fff" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
        ) : (
          <path d="M62 128 Q100 160 138 128" {...stroke} />
        )}
        {v === 2 && (
          <>
            <circle cx="48" cy="118" r="11" fill="#f9a8a8" opacity="0.7" />
            <circle cx="152" cy="118" r="11" fill="#f9a8a8" opacity="0.7" />
          </>
        )}
      </>
    )
  } else if (type === 'anger') {
    features = (
      <>
        {/* 눈썹: 앞머리가 미간 쪽으로 모이며 내려감 */}
        <path d="M48 68 L90 88" {...stroke} strokeWidth="8" />
        <path d="M152 68 L110 88" {...stroke} strokeWidth="8" />
        <ellipse cx="72" cy="102" rx="8" ry="9" fill={INK} />
        <ellipse cx="128" cy="102" rx="8" ry="9" fill={INK} />
        {v === 1 ? (
          <>
            <rect x="68" y="136" width="64" height="22" rx="6" fill="#fff" stroke={INK} strokeWidth="6" />
            <path d="M84 136 V158 M100 136 V158 M116 136 V158" stroke={INK} strokeWidth="3" />
          </>
        ) : (
          <path d="M65 152 Q100 126 135 152" {...stroke} />
        )}
        {v === 2 && (
          <>
            <circle cx="46" cy="122" r="12" fill="#f87171" opacity="0.55" />
            <circle cx="154" cy="122" r="12" fill="#f87171" opacity="0.55" />
          </>
        )}
      </>
    )
  } else {
    const open = [18, 26, 12][v]
    features = (
      <>
        {/* 눈썹이 올라가고 눈이 크게 떠지고 입이 벌어짐 */}
        <path d="M50 56 Q70 40 90 56" {...stroke} />
        <path d="M110 56 Q130 40 150 56" {...stroke} />
        <circle cx="70" cy="90" r="16" fill="#fff" stroke={INK} strokeWidth="5" />
        <circle cx="130" cy="90" r="16" fill="#fff" stroke={INK} strokeWidth="5" />
        <circle cx="70" cy="90" r="6" fill={INK} />
        <circle cx="130" cy="90" r="6" fill={INK} />
        <ellipse cx="100" cy="145" rx={open * 0.8} ry={open} fill="#7c2d12" stroke={INK} strokeWidth="6" />
      </>
    )
  }

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label="표정 그림">
      <g transform={alt ? 'rotate(-6 100 100)' : undefined}>
        <circle cx="100" cy="100" r="92" fill={skin} stroke={INK} strokeWidth="6" />
        {alt && <path d="M14 92 Q22 14 100 10 Q178 14 186 92 Q165 30 100 28 Q35 30 14 92 Z" fill="#5b3a1e" stroke={INK} strokeWidth="5" strokeLinejoin="round" />}
        {features}
      </g>
    </svg>
  )
}

// 퀴즈용: 표정마다 variant 0 문제 하나는 사진(AI로 만든 이미지)을 보여 주고, 나머지는 그림이에요.
// 사진을 늘리려면 public/faces 에 파일을 넣고 아래 목록에 파일 이름을 한 줄 추가하면 돼요. (어린이·노인 등 다양한 연령 환영)
export const PHOTOS = {
  smile: ['faces/smile-man.png', 'faces/smile-elder.jpg', 'faces/smile-child.jpg'],
  anger: ['faces/anger-woman.jpeg', 'faces/anger-elder.jpg', 'faces/anger-child.jpg'],
  surprise: ['faces/surprise-man.png', 'faces/surprise-elder.jpg', 'faces/surprise-child.jpg'],
}
// 2단계 퀴즈용: 모든 사진을 { type, src } 한 줄로 펼친 목록
export const PHOTO_LIST = Object.entries(PHOTOS).flatMap(([type, srcs]) => srcs.map((src) => ({ type, src })))

export function QuizFace({ type, variant = 0, size = 180, src }) {
  const photo = src || PHOTOS[type]?.[0]
  if (photo && (src || variant % 3 === 0)) {
    // 모든 사진을 같은 세로형 칸(가로 size, 세로 size×1.28)에 담아요. 가로로 긴 사진은 가운데를 보여 줘요.
    // 흰 배경 틀에 위쪽 여백을 넓게 둬서 머리가 잘리거나 답답하게 붙지 않게 해요.
    const padTop = Math.round(size * 0.12)
    const padSide = Math.round(size * 0.06)
    const padBottom = Math.round(size * 0.04)
    return (
      <div
        style={{
          background: '#fff', borderRadius: 20, display: 'inline-block',
          padding: padTop + 'px ' + padSide + 'px ' + padBottom + 'px',
        }}
      >
        <img
          src={import.meta.env.BASE_URL + photo}
          alt="표정 사진"
          style={{ display: 'block', width: size, height: Math.round(size * 1.284), objectFit: 'cover', objectPosition: 'center top' }}
        />
      </div>
    )
  }
  return <Face type={type} variant={variant} size={size} />
}
