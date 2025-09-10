# Bion Board — 스프링 + 리액트 게시판

Spring Boot 백엔드(JWT 인증, 게시판/댓글/대댓글)와 React + TypeScript + Vite 프런트엔드(Tailwind)로 구성된 예제 프로젝트입니다.

- 회원가입/로그인(JWT)
- 게시글 CRUD
- 댓글 + 대댓글(트리 구조)
- 목록/상세/작성 화면 분리

## 리포지토리 구조
- `back/`: Spring Boot 3 (Java 17), Gradle, H2(in-memory), JWT
- `front/`: React 19 + TypeScript + Vite 7 + Tailwind

## 준비물(Prerequisites)
- Java 17+
- Node.js 18+ (권장 20+)
- npm

## 실행 방법
1) 백엔드 실행
```
cd back
./gradlew bootRun   # Windows: gradlew.bat bootRun
# Backend: http://localhost:8080
# H2 콘솔: http://localhost:8080/h2-console
```

2) 프런트엔드 실행
```
cd front
npm ci  # 또는 npm i
npm run dev   # Vite: http://localhost:5173
```
- 개발 중에는 `/api` 요청이 백엔드로 프록시됩니다: `front/vite.config.ts`
- 백엔드 주소를 바꾸려면 `.env`에 `VITE_API_BASE_URL`을 설정하세요.

## 백엔드 개요 (`back/`)
- 주요 스택: Spring Boot, Spring Web, Security, Data JPA, H2, JJWT
- Java Toolchain: 17 (참고: `back/build.gradle`)
- 주요 설정: `back/src/main/resources/application.properties`
  - `spring.datasource.url=jdbc:h2:mem:testdb`
  - `spring.jpa.hibernate.ddl-auto=update`
  - `spring.h2.console.enabled=true`
  - `jwt.secret=changeitchangeitchangeitchangeit` (운영 환경에선 안전한 키로 교체)
- 보안: `POST /api/users/register`, `POST /api/auth/login`, `GET /api/boards/**`는 공개, 그 외 JWT 필요

### REST API 요약
인증/계정
- `POST /api/users/register`  — `{ username, password, confirmPassword, email, phone }`
- `POST /api/auth/login`      — `{ username, password }` → `{ token }`

게시글
- `GET /api/boards`                        — 목록
- `POST /api/boards` (인증)                — `{ title, content }`
- `GET /api/boards/{id}`                   — 상세
- `PUT /api/boards/{id}` (작성자만)        — `{ title?, content? }`
- `DELETE /api/boards/{id}` (작성자만)     — 댓글 포함 삭제 가능 정책 적용

댓글/대댓글
- `GET /api/boards/{postId}/comments`                          — 최상위 댓글
- `POST /api/boards/{postId}/comments` (인증)                   — `{ content }`
- `GET /api/boards/{postId}/comments/{commentId}/replies`       — 대댓글 목록
- `POST /api/boards/{postId}/comments/{commentId}/replies` (인증) — `{ content }`
- `DELETE /api/boards/{postId}/comments/{id}` (작성자만)        — 해당 댓글 및 하위 트리 삭제 가능

## 프런트엔드 개요 (`front/`)
- 주요 스택: React 19, TypeScript, Vite 7, Tailwind, React Router v6
- 화면: 홈, 로그인, 회원가입, 게시판 목록/상세/작성
- 공통 UI: 상단 내비게이션 `Navbar`
- 댓글 트리: `CommentTree` 컴포넌트로 중첩 렌더링 + 지연 로딩
- API 클라이언트: `front/src/api.ts` — `localStorage.token`을 Bearer 토큰으로 자동 첨부

## 기본 사용 흐름
1) `/register`에서 회원가입 후 `/login`에서 로그인
2) 로그인 성공 시 토큰 저장(`localStorage.token`)
3) `/boards`에서 목록 확인, `/boards/new`에서 글 작성, 상세에서 댓글/대댓글 작성

## 운영/배포 참고
- JWT 시크릿(`jwt.secret`)은 운영 환경에서 안전하게 분리/주입
- DB: 개발은 H2(in-memory), 운영은 PostgreSQL 등 영구 저장소 권장
- CORS: 개발은 Vite 프록시 사용, 운영은 서버 측 CORS 설정 권장
- 프런트 빌드: `cd front && npm run build` → 산출물 `front/dist`

## 트러블슈팅
- 401/403: 인증 필요 API에 토큰 누락/만료 여부 확인
- CORS: 개발/운영 주소 확인, 필요 시 Spring CORS 설정 추가
- H2 데이터 초기화: in-memory 특성으로 재시작 시 초기화됨. 운영 DB 사용 권장

