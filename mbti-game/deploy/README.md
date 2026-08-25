# 배포 체크리스트 — EC2 + S3 + CloudFront

콘솔 작업은 팀원이 직접 (학습 목적). 순서대로 진행. 예상 소요 60~90분.

## 1. IAM role (EC2용)

- [ ] IAM → 역할 생성 → 신뢰 엔터티: **EC2**
- [ ] 정책 연결: `AmazonBedrockLimitedAccess` (또는 인라인으로 `bedrock:InvokeModel`만), `AmazonSSMManagedInstanceCore`
- [ ] 이름 예: `mbti-game-ec2-role`
- 자격증명 키 발급 금지 — 코드에 키 없음, role이 전부 공급

## 2. Bedrock 모델 액세스

- [ ] Bedrock 콘솔 (리전 `us-east-1`) → 모델 액세스 → 사용할 모델 활성화
- [ ] 모델 id 복사 → `deploy/gamesvc.service`의 `GAME_BEDROCK_MODEL` 교체

## 3. EC2

- [ ] Amazon Linux 2023, t3.micro, 위 IAM role 연결
- [ ] 보안 그룹 인바운드: 8000 — 개발 중엔 본인 IP, CloudFront 연결 후엔 CloudFront 대역(또는 유지)
- [ ] 접속: SSM Session Manager (키페어 불필요) 또는 키페어+SSH
- [ ] 코드 업로드 → `/home/ec2-user/mbti-game`
  - 간단 경로: 로컬에서 zip → S3에 업로드 → EC2에서 `aws s3 cp` (role에 S3 읽기 임시 부여) 또는 `scp`
- [ ] 실행:
  ```bash
  bash deploy/setup-ec2.sh
  ```
- [ ] 확인: `curl http://localhost:8000/health` → `{"ok":true,"llm":"bedrock"}`

## 4. S3 (프론트)

- [ ] 버킷 생성 (퍼블릭 차단 **유지** — CloudFront OAC로만 접근)
- [ ] `frontend/index.html` 업로드

## 5. CloudFront ← 제일 막히기 쉬운 구간

- [ ] 배포 생성, 기본 오리진: S3 버킷 + **OAC(Origin Access Control)** 생성·연결
  - 생성 후 안내되는 버킷 정책을 S3에 복사 적용
- [ ] 기본 루트 객체: `index.html`
- [ ] **두 번째 오리진 추가**: EC2 퍼블릭 DNS, 프로토콜 **HTTP only**, 포트 8000
- [ ] **비헤이비어 추가**: 경로 패턴 `/api/*` → EC2 오리진
  - 허용 메서드: `GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE` (POST 필수)
  - 캐시 정책: `CachingDisabled`
  - 오리진 요청 정책: `AllViewerExceptHostHeader`
- [ ] 프론트 `API_BASE`는 빈 문자열 그대로 → same-origin이라 CORS 문제 없음

## 6. 최종 검증

- [ ] CloudFront URL 접속 → 게임 4분기 완주 → MBTI 카드 + 결과지 표시
- [ ] 결과 후 Q&A 질문 응답 확인
- [ ] EC2 재부팅 → `sudo systemctl status gamesvc` 자동 기동 확인
- [ ] EC2 안에 자격증명 파일(`~/.aws/credentials`) 없음 확인

## 트러블슈팅

| 증상 | 원인 후보 |
|---|---|
| /api 호출 502/504 | CloudFront EC2 오리진 프로토콜이 HTTPS로 돼 있음(HTTP only로), SG가 CloudFront 트래픽 차단 |
| /api 호출 403 | 비헤이비어 허용 메서드에 POST 누락 |
| 결과지에서 500 | `GAME_BEDROCK_MODEL` 미교체, Bedrock 모델 액세스 미활성화, role에 InvokeModel 권한 없음 → `sudo journalctl -u gamesvc -n 50` |
| 프론트 AccessDenied | OAC 버킷 정책 미적용 |
