# 드론 비행 관리 웹앱 — Codex 요청 시나리오 & 단계별 체크리스트

> 스펙: **Java Spring Boot + React.js**
>
> 현재 상태: 로그인/회원가입(JWT), 게시판, 댓글, 대댓글 **프로토타입 존재**
>
> 목표: 기획서 기반으로 **실시간 데이터·보안·관리자 백오피스·알림·지도/경로·PDF 관리**까지 확장

---

## 0) 리포지토리·작업 방식 정비 (D0)

* [ ] Git 브랜치 전략 설정 (`main`/`dev`/`feature/*`), Conventional Commits, PR 템플릿 추가
* [ ] 공통 코드스타일(Spotless/Prettier), Lint(ESLint), 포매터(kt?), GitHub Actions 기본 워크플로우
* [ ] 환경변수 체계: `application.yml`(Spring), `.env`(React). 예: WEATHER\_API\_KEY, S3\_BUCKET, JWT\_SECRET 등

**Codex 요청 템플릿**

```
리포지토리 루트에 다음을 추가해줘:
1) Java/Spring용 Spotless 설정, 2) React용 ESLint+Prettier 설정, 3) GitHub Actions CI(백/프론트 빌드·테스트),
4) PR 템플릿, 5) .editorconfig.
각 파일 내용과 설치/적용법까지 커밋 단위로 제안해줘.
```

---

## 1) 도메인·DB 스키마 정리 (D1\~D2)

**핵심 엔티티**: User, Role, FlightSchedule, FlightZone, FlightPlan(Route), Drone, Maintenance, Permit(PDF), AuditLog, Notification

* [ ] ERD 초안 및 마이그레이션 스크립트(Flyway)
* [ ] 표준 BaseEntity(생성/수정자, soft delete, 버전)

**Codex 요청 템플릿**

```
아래 도메인으로 JPA 엔티티/레포지토리/마이그레이션(Flyway) 설계를 만들어줘.
User(Role 기반 RBAC), FlightSchedule(일시, 장소, 상태), FlightZone(다각형 GeoJSON, 제한정보),
FlightPlan(waypoints, 고도, 예상비행시간), Drone(모델, 시리얼, 상태), Maintenance(점검이력),
Permit(파일메타: uuid, path, 암호화여부), AuditLog(주체, 행위, 대상, 시각), Notification(유형, 채널, 페이로드).
스키마 제약 및 인덱스 전략까지 제시해줘.
```

---

## 2) 인증·권한 강화 (RBAC, 이메일 인증) (D2)

* [ ] Role: USER / ADMIN / OPERATOR
* [ ] 이메일 인증·비밀번호 재설정, Refresh 토큰, 토큰 블랙리스트/로테이션
* [ ] 엔드포인트 별 권한 매핑

**Codex 요청 템플릿**

```
Spring Security 6 + JWT 기반 RBAC를 구현해줘.
- 이메일 인증(토큰 발급·만료), 비밀번호 재설정, refresh token 로테이션, 로그아웃시 블랙리스트.
- 엔드포인트별 antMatcher/authorization 매핑 표와 샘플 테스트(MockMvc) 포함.
```

---

## 3) 날씨·일출일몰 연동 + 캐싱 (D3)

* [ ] OpenWeather/기상청 OpenAPI 클라이언트, 일출/일몰 계산
* [ ] 서버 캐시(Caffeine/Redis TTL), 429 대비 재시도/서킷브레이커(Resilience4j)
* [ ] 프론트 SWR(또는 React Query) 캐싱·stale-while-revalidate

**Codex 요청 템플릿**

```
기상 API 연동 컴포넌트 작성:
- OpenWeather One Call(대안: 기상청) 래퍼 서비스, DTO, 에러/재시도, Caffeine 캐시 TTL 5~10분,
- Resilience4j 서킷브레이커/백오프 재시도,
- React Query 훅(useWeatherByLatLng)와 스켈레톤 UI, 로딩/에러 상태.
```

---

## 4) 비행 가능 구역(지도 레이어) (D3\~D4)

* [ ] 지도 SDK(구글/OSM MapLibre) + GeoJSON 레이어
* [ ] 제한 정보(고도/시간/금지) 시각화(색/패턴/툴팁)
* [ ] 위치 기반 조회 API: bbox/버퍼, 정렬(거리, 위험도)
* [ ] 관리자 수동 등록/수정 폼

**Codex 요청 템플릿**

```
FlightZone용 REST API와 React 지도 레이어를 만들어줘.
- 업서트(다각형 GeoJSON, 제한종류, 고도, 시간대), bbox/버퍼로 근접 구역 조회,
- React 지도 컴포넌트(줌/팬, 레이어 토글, 범례, 툴팁), 접근성 고려.
```

---

## 5) 비행 스케줄 + 달력/경보 연동 (D4)

* [ ] CRUD + 캘린더 뷰(월/주/일)
* [ ] 날씨·구역 충돌 검증(강풍, 우천, 금지구역 겹침시 경고)
* [ ] 알림 트리거(비행 24h/2h 전, 악천후 감지)

**Codex 요청 템플릿**

```
FlightSchedule API와 React 캘린더 UI를 구현해줘.
- 생성 시 좌표/시간 입력 → 서버에서 날씨/구역 규칙 검증 후 경고코드 반환,
- 캘린더(FullCalendar 등) 통합, 이벤트 컬러 규칙(정상/주의/금지),
- 비행 24h/2h 전 및 악천후시 Notification 이벤트 발행.
```

---

## 6) 경로 계획·시뮬레이션 (D5)

* [ ] Waypoint 기반 경로 저장, 총거리/예상시간 계산
* [ ] 구역 제한 교차검사(폴리곤/라인 교차)
* [ ] 단순 시뮬레이션(속도/배터리 소모 추정)

**Codex 요청 템플릿**

```
경로 계획 서비스 구현:
- polyline waypoints(위도/경도/고도)로 거리/시간 계산,
- FlightZone과의 교차검사(금지/제한 구간 마킹),
- 속도·중량·풍속을 파라미터로 배터리 소모 추정 모델(간이식) 추가.
```

---

## 7) 승인서(PDF) 업로드·암호화·미리보기 (D5)

* [ ] S3(또는 로컬) 저장, 서버측 암호화(AES-GCM) + KMS 연동 선택지
* [ ] 서명된 URL(다운로드), PDF.js 프리뷰, 메타 검색/필터
* [ ] 바이러스 스캔(ClamAV 등) 훅

**Codex 요청 템플릿**

```
Permit 파일 파이프라인 구현:
- 업로드→바이러스 스캔→AES-GCM 암호화→S3 저장, 메타데이터 DB 기록,
- 서명URL 발급 API(만료시간), 접근 제어, PDF.js 프론트 미리보기,
- 유형/기간 필터 검색, 단위/통합 테스트 포함.
```

---

## 8) 관리자 백오피스 (D6)

* [ ] 사용자 권한·비행구역·승인서 상태·시스템 설정 관리
* [ ] 감사 로그 테이블 뷰 + 상세(필터/기간/액터/리소스)

**Codex 요청 템플릿**

```
관리자 React 라우트와 Spring Admin API를 만들어줘.
- 사용자(Role 변경), FlightZone CRUD, Permit 상태변경,
- AuditLog 테이블(서버 페이징/정렬/필터), CSV 내보내기.
```

---

## 9) 알림(웹푸시·이메일·SMS) (D6)

* [ ] 서버 이벤트(Notification) ↔ 채널 어댑터(WebPush, Email, SMS)
* [ ] 템플릿 관리(핸들바/타임리프)
* [ ] 구독/해지, Quiet Hours, 재시도 큐

**Codex 요청 템플릿**

```
Notification 모듈 설계:
- 이벤트 타입(악천후, 스케줄 임박, 정책변경), 채널(WebPush/Firebase, 이메일, SMS) 어댑터,
- 사용자별 구독 설정, 조용시간, 재시도/Dead-letter 큐, 통합 테스트.
```

---

## 10) 보안·개인정보 보호 (D7)

* [ ] HTTPS, 보안 헤더, CORS 정책, Rate Limit, IP 차단
* [ ] 데이터 최소화·암호화(휴지/전송), PII 접근 제어(관리자 마스킹)
* [ ] 감사 로그(성공/실패, 누가·언제·무엇을), 알람

**Codex 요청 템플릿**

```
보안 하드닝 체크리스트를 코드로 반영해줘.
- Spring Security 헤더, CORS 화이트리스트, RateLimiter(버킷4j),
- PII 마스킹 직렬화기, Audit AOP(리소스/액터/액션 기록),
- 침입 시그널(다중 실패)시 알람 훅.
```

---

## 11) 관측성(로깅·메트릭·트레이싱) (D7)

* [ ] ELK/Opensearch 스택, 구조화 로깅(JSON)
* [ ] Micrometer + Prometheus/Grafana, OpenTelemetry 트레이싱

**Codex 요청 템플릿**

```
관측성 스택을 도입해줘.
- Logback JSON, 요청ID 상관관계, Micrometer 지표,
- OpenTelemetry(HTTP, DB, 외부API) 트레이싱 샘플 대시보드까지.
```

---

## 12) CI/CD·도커·배포 (D8)

* [ ] 백엔드 멀티 스테이지 Dockerfile, 프론트 정적 빌드 Nginx 서빙
* [ ] GitHub Actions: 테스트→도커 빌드→레지스트리 푸시→배포(예: ECS/EC2)
* [ ] 환경별 설정(dev/stg/prd), 시크릿 관리(GitHub Secrets)

**Codex 요청 템플릿**

```
백/프론트 Dockerfile, docker-compose, GitHub Actions 파이프라인을 작성해줘.
- dev/stg/prd 매트릭스 빌드, 헬스체크, 롤백 전략, 캐시 최적화 포함.
```

---

## 13) 테스트 전략 (전 구간) (지속)

* [ ] 백엔드: 단위(JUnit5), 슬라이스(WebMvc/DataJpa), 통합(Testcontainers)
* [ ] 프론트: 유닛(Jest/RTL), E2E(Playwright/Cypress)
* [ ] 계약 테스트(REST Assured/PACT)

**Codex 요청 템플릿**

```
주요 유스케이스 테스트 시나리오를 만들어줘.
- 로그인/권한, 스케줄 검증, 경로-구역 교차, 파일 암호화·다운로드, 알림 발송,
- Testcontainers(PostgreSQL, MinIO/S3 대체), CI에서 병렬로 실행.
```

---

## 14) 성능·페일세이프 (지속)

* [ ] 캐시 히트율/지연 모니터링, API Rate 관리
* [ ] 대체 경로(기상 API 다운 시 fallback), 메시지 큐(알림)
* [ ] 프론트 코드 스플리팅·이미지 최적화·PWA(오프라인 캐시)

**Codex 요청 템플릿**

```
성능 최적화/페일세이프 구현 제안:
- 서버: 캐시 키 설계, 히트율 지표, API 백오프, fallback 데이터,
- 프론트: 코드 스플리팅, React.lazy, PWA(Service Worker 캐시 시나리오).
```

---

## 15) UI/UX 가이드 & 접근성 (지속)

* [ ] 공통 디자인 토큰, 상태 컬러(정상/주의/금지), 레이어 토글 UX
* [ ] 지도 접근성(키보드 내비, ARIA), 색각보정 팔레트
* [ ] 스켈레톤/로딩/에러/빈상태 패턴 통일

**Codex 요청 템플릿**

```
UI 컴포넌트 세트와 토큰을 정의해줘.
- 버튼/알림/배지/모달/테이블/폼, 상태 컬러와 접근성 기준(명도대비) 적용 예시,
- 지도 레이어 토글·범례 컴포넌트 샘플.
```

---

## 16) 릴리즈 계획 & 마일스톤

* **M1 (주차 1\~2)**: 0\~3 완료 — 인증·날씨·기본 지도 레이어
* **M2 (주차 3\~4)**: 4\~6 완료 — 구역/스케줄/경로
* **M3 (주차 5\~6)**: 7\~9 완료 — PDF·백오피스·알림
* **M4 (주차 7+)**: 10~~12·13~~15 안정화 — 보안/관측/배포/테스트/UX

**Codex 요청 템플릿(릴리즈 노트 생성)**

```
각 마일스톤 완료 시 포함할 릴리즈 노트 템플릿과 체인지로그(Keep a Changelog 형식)를 생성해줘.
```

---

## 부록 A) 대표 API 스펙 초안

* `GET /api/weather?lat=&lng=` → 캐시/리트라이, 알림 임계치 리턴
* `GET /api/zones?bbox=` / `POST /api/zones`(ADMIN)
* `POST /api/schedules` / `GET /api/schedules?from=&to=`
* `POST /api/plans`(경로 저장) / `POST /api/plans/simulate`
* `POST /api/permits`(업로드) / `GET /api/permits?type=&from=&to=`
* `GET /api/audit?actor=&from=&to=`(ADMIN)
* `POST /api/notifications/test`(ADMIN)

**Codex 요청 템플릿**

```
위 API 초안을 OpenAPI 3.1 스키마(yaml)로 작성해줘.
요청/응답 DTO, 에러코드, 보안 스키마(JWT), 예제 포함.
```

---

## 부록 B) 데이터 보존·정책

* 파일/로그/알림 보존기간, 개인정보 익명화·파기 절차, 백업/복구 리허설 체크리스트

**Codex 요청 템플릿**

```
데이터 보존 정책과 백업·복구 절차 문서를 마크다운으로 만들어줘.
테이블(보존기간/담당/근거)과 점검 체크리스트 포함.
```

---

## 진행 체크박스 (요약)

* [ ] 0 리포지토리 정비
* [ ] 1 도메인/ERD/Flyway
* [ ] 2 인증/RBAC/이메일
* [ ] 3 날씨/캐싱/Resilience4j/React Query
* [ ] 4 구역 API/지도 레이어/관리자 폼
* [ ] 5 스케줄/달력/규칙검증/경보
* [ ] 6 경로/시뮬/교차검사/배터리 추정
* [ ] 7 승인서 암호화/S3/미리보기/스캔
* [ ] 8 백오피스/Audit 로그
* [ ] 9 알림(WebPush/Email/SMS)
* [ ] 10 보안 하드닝/PII/Rate limit
* [ ] 11 관측성(로그/지표/추적)
* [ ] 12 CI/CD/도커/배포
* [ ] 13 테스트 전략(단위/통합/E2E/계약)
* [ ] 14 성능/페일세이프/PWA
* [ ] 15 UI/UX/접근성
* [ ] 16 릴리즈/체인지로그
