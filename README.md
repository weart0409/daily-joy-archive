# 오늘의 행복 수집소

GitHub Pages에 배포할 수 있는 정적 이벤트 페이지입니다. 참여 단계, 각 버튼 클릭, UTM 캠페인, 체크아웃 시작을 익명 이벤트로 Supabase에 저장합니다.

## Supabase 연결

1. Supabase 프로젝트의 SQL Editor에서 `supabase/schema.sql`을 실행합니다.
2. `site/config.js`의 `SUPABASE_URL`과 `SUPABASE_ANON_KEY`를 프로젝트의 URL과 publishable/anon 키로 채웁니다. 이 키는 브라우저에 공개되므로 `service_role` 키를 넣지 마세요. 테이블은 RLS를 켜고 익명 이벤트 추가만 허용합니다.
3. 워크스페이스의 `.vscode/mcp.json`은 Supabase MCP 연결 설정입니다. VS Code에서 Supabase 서버를 인증하고 프로젝트에 연결하면 MCP로도 DB를 확인할 수 있습니다.

Supabase MCP 세션이 현재 프로젝트와 인증되어 있지 않아 데이터베이스 테이블을 직접 만들지는 않았습니다. 위 SQL을 실행하면 페이지에서 이벤트 적재를 시작합니다.

## 구매 측정

결제 서비스의 체크아웃 주소를 `site/config.js`의 `CHECKOUT_URL`에 설정하면 `purchase_cta_clicked`와 `checkout_started`를 기록합니다. 실제 구매 완료인 `purchase_completed`는 결제 서비스의 서명 검증이 끝난 서버 웹훅에서 기록해야 합니다. 익명 브라우저 정책은 이 이벤트 삽입을 거부하도록 설정되어 있어 구매 전환 데이터를 클라이언트가 임의로 만들 수 없습니다.

## 로컬 미리보기

프로젝트 루트에서 실행하세요.

```powershell
py -m http.server 8000 --directory site
```

브라우저에서 `http://localhost:8000`을 엽니다. Supabase 설정 전에도 참여 플로우는 체험할 수 있지만 이벤트는 저장되지 않습니다.

## GitHub Pages 배포

저장소의 `main` 브랜치에 푸시하면 `.github/workflows/deploy.yml`이 `site/`를 배포합니다. GitHub 저장소의 **Settings → Pages → Build and deployment**에서 **GitHub Actions**를 선택하세요. `site/config.js`의 Supabase URL과 anon 키는 정적 사이트에 포함되어 공개되므로, RLS 정책은 필요한 최소 작업만 허용해야 합니다.

## 주요 이벤트

`page_view`, `funnel_step_view`, `funnel_step_completed`, `button_click`, `activity_selected`, `participation_completed`, `purchase_cta_clicked`, `checkout_started`, `purchase_completed`를 기록합니다. `properties`에는 선택 항목과 글자 수만 담고 사용자가 작성한 문장, 이름, 이메일은 전송하지 않습니다. 버튼별 합계, 퍼널 이탈, 구매 전환 SQL은 `supabase/schema.sql` 끝부분에 있습니다.