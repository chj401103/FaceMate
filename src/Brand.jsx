// 앱 이름 "FaceMate" 글자는 어디에 쓰든 로고와 함께 보여요.
export default function Brand() {
  return (
    <div className="home-brand">
      <img className="home-logo" src={`${import.meta.env.BASE_URL}logo/facemate-logo.png`} alt="FaceMate 로고" />
      <h1>FaceMate</h1>
    </div>
  )
}
