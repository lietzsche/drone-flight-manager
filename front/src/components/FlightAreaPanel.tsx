import { useEffect, useState } from 'react'

type Props = {
  onClose?: () => void
}

export default function FlightAreaPanel({ onClose }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // No-op: placeholder if we later want to prefetch resources
  }, [])

  return (
    <div className="max-w-4xl mx-auto px-4 py-3 bg-gray-50 border-t">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">드론원스톱 비행가능지역</h3>
        <div className="flex items-center gap-2">
          <a href="https://drone.onestop.go.kr/common/flightArea" target="_blank" rel="noopener noreferrer" className="text-sm link">새 탭으로 열기</a>
          <button onClick={onClose} className="text-sm border rounded px-2 py-1">닫기</button>
        </div>
      </div>

      <div className="w-full h-96 bg-white border rounded overflow-hidden">
        {!loaded && !error && (
          <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">로딩 중...</div>
        )}

        {error && (
          <div className="w-full h-full flex flex-col items-center justify-center p-4">
            <div className="text-sm text-red-600 mb-2">외부 페이지 로드 실패</div>
            <a href="https://drone.onestop.go.kr/common/flightArea" target="_blank" rel="noopener noreferrer" className="link">외부 사이트로 이동</a>
          </div>
        )}

        {/* iframe은 사용자가 패널을 연 경우에만 DOM에 추가하여 비동기적 로드를 수행합니다. */}
        {!error && (
          <iframe
            title="drone-onestop-flight-area"
            src="https://drone.onestop.go.kr/common/flightArea"
            className={`w-full h-full border-0 ${loaded ? '' : 'hidden'}`}
            onLoad={() => setLoaded(true)}
            onError={() => setError(new Error('iframe load error'))}
          />
        )}
      </div>
    </div>
  )
}
