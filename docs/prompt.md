# Drone Webapp — Codex 요청 (로컬 즉시 확인 · 소스 위주 · 기능 단위)

> 전제: **로그인/회원가입/JWT, 게시판/댓글/대댓글은 이미 구현됨** → 제외.
> 목표: 외부 API·CI/CD 없이 **로컬에서 바로 눈으로 확인** 가능한 기능을 **한 번에 하나씩** 요청.
> 스택: **Spring Boot + React**. 테스트는 가볍게(슬라이스/유닛)만.

---

## 1) 비행 스케줄 CRUD + 달력(FullCalendar)

**화면 확인 포인트**: 월/주/일 달력에서 일정 생성/드래그 이동/리사이즈/삭제, 상태 색상(PLANNED/DONE/CANCELLED)

**Codex 요청**

```
비행 스케줄 기능을 백/프론트로 추가해줘. 외부 API 없이 로컬에서 바로 확인 가능해야 해.
[백엔드]
- 엔티티 FlightSchedule(id, ownerId, title, description, startsAt, endsAt, locationName, lat, lng, status)
- REST: GET /api/schedules?from&to, GET /api/schedules/{id}, POST, PUT, PATCH /status, DELETE
- 검증: startsAt < endsAt, 권한: 소유자/ADMIN, 페이지네이션
[프론트]
- FullCalendar 월/주/일 + 드래그 생성/이동/리사이즈, 상태별 색상, 상세/수정 모달
- React Query 훅(useSchedules)
```

---

## 2) 비행 구역 CRUD + 지도(Leaflet + OSM 타일)

**화면 확인 포인트**: 지도에 구역 레이어 표시/툴팁, 유형별 색상(금지/제한/주의), 목록→지도 토글

**Codex 요청**

```
비행 구역 관리 기능을 추가해줘(외부 키 없음).
[백엔드]
- 엔티티 FlightZone(id, name, type[PROHIBITED|RESTRICTED|CAUTION], altitudeLimit, timeWindow, geojson)
- REST: 목록/상세/생성/수정/삭제, 간단 유효성(폴리곤 자기교차 금지)
[프론트]
- Leaflet 지도: OSM 타일, GeoJSON 레이어, 레이어 토글/범례/툴팁
- 구역 목록 테이블 ↔ 지도 하이라이트 연동
```

---

## 3) 경로 계획(웨이포인트) + 구역 교차 경고

**화면 확인 포인트**: 지도에서 클릭으로 경로(Polyline) 작성/편집, 금지·제한 구역 교차 시 경고 배지 표시

**Codex 요청**

```
경로 계획 기능을 추가해줘.
[백엔드]
- 엔티티 FlightPlan(id, name, waypoints[{lat,lng,alt}])
- API: POST/GET/PUT/DELETE /api/plans, POST /api/plans/validate → zones 교차 결과 코드 반환
- 계산: 총거리/예상시간(속도 파라미터) 기본치
[프론트]
- Leaflet에서 점 추가/삭제/드래그로 경로 편집, 거리/시간 표시, 교차 경고 배지
```

---

## 4) 승인서(PDF) 업로드 · 로컬 저장 · 미리보기

**화면 확인 포인트**: PDF 목록/검색/정렬, 클릭 시 PDF.js 미리보기(모달 또는 전용 페이지)

**Codex 요청**

```
승인서 파일 관리를 로컬 스토리지로 구현해줘(클라우드/키 없음).
[백엔드]
- 엔티티 Permit(id, uuid, filename, size, contentType, storedPath, createdAt)
- 업로드(멀티파트)→로컬 폴더 저장(/data/permits), 다운로드/삭제 API, 간단 확장자·크기 검증
[프론트]
- 업로드 폼, 목록(검색/정렬), PDF.js 미리보기 컴포넌트
```

---

## 5) 관리자 라이트 백오피스(사용자 권한 · 구역 · 승인서 상태)

**화면 확인 포인트**: /admin 라우트에 테이블 3종(사용자, 구역, 승인서), 행 선택→우측 패널 수정

**Codex 요청**

```
라이트 백오피스를 추가해줘(ADMIN 전용).
[백엔드]
- Admin Controller: 사용자 목록/권한 변경, FlightZone CRUD, Permit 상태 변경(Active/Archived)
[프론트]
- /admin: 탭형 테이블(서버 페이징/정렬/검색), 상세 패널/모달 수정, 권한 변경 버튼
```

---

## 6) 인앱 알림(브라우저 내만) — 이벤트 트리거 샘플 포함

**화면 확인 포인트**: 헤더 벨 아이콘 드롭다운·토스트, 스케줄 생성 시 알림 생성·읽음 처리

**Codex 요청**

```
인앱 알림을 구현해줘(외부 채널 없음).
[백엔드]
- 엔티티 Notification(id, userId, type, title, message, read)
- 생성 트리거 예: 스케줄 생성 시 알림 기록, 읽음/전체읽음 API
[프론트]
- 벨 아이콘 드롭다운, 토스트, 읽음/전체읽음 처리
```

---

## 7) 보안 기본 하드닝(로컬 검증 가능 항목만)

**화면/동작 확인 포인트**: CORS 화이트리스트 동작, 과도한 요청 시 429, 민감정보 마스킹 응답

**Codex 요청**

```
보안 기본값을 강화해줘(로컬에서 확인 가능 범위).
- Spring Security 보안 헤더, CORS 화이트리스트, 버킷4j RateLimiter(전역/특정 엔드포인트),
- 사용자 응답의 일부 PII 마스킹 직렬화기
```

---

## 8) 공통 UI/UX 다듬기(상태 배지/모달/토스트/스켈레톤)

**화면 확인 포인트**: 상태 배지(정상/주의/금지), 일관된 모달·토스트, 로딩 스켈레톤

**Codex 요청**

```
공통 UI 컴포넌트를 정리해줘.
- 상태 배지/토스트/모달/테이블 빈상태/에러 상태, 색상 토큰
- 접근성 기초(키보드 포커스/ARIA) 샘플 포함
```

---

## 9) 최소 테스트 세트(로컬 빠른 검증)

**확인 포인트**: 스케줄/구역/경로/승인서 주요 API happy-path + 권한 오류 검증

**Codex 요청**

```
최소 테스트를 추가해줘.
- 백엔드: WebMvc/DataJpa 슬라이스 중심(happy/권한/검증)
- 프론트: 폼 유효성/리스트 상호작용 간단 RTL 테스트
```

---

### 실행 순서 제안

1. 스케줄(1) → 2) 구역(2) → 3) 경로(3) → 4) PDF(4) → 5) Admin(5) → 6) 알림(6) → 7) 보안(7) → 8) UI(8) → 9) 테스트(9)

> 각 항목은 **그 자체로 실행/확인 가능한 단위**입니다. 필요하면 더 잘게 쪼개서 요청할 수 있어요.
