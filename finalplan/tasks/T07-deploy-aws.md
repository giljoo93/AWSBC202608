# T07 — AWS 배포 (EC2 + S3 + CloudFront + IAM)

선행: T05, T06 · 담당: 유저(콘솔) + Claude(스크립트)

## 목표

프론트는 S3+CloudFront, 백엔드는 EC2. 브라우저에서 CloudFront URL로 플레이 완주.

## 구성 순서 (유저 콘솔 작업)

1. **IAM role** (EC2용): `bedrock:InvokeModel` + SSM 접속 권한
2. **EC2**: Amazon Linux, SG 인바운드 — 8000은 CloudFront/본인 IP만
3. **Bedrock**: 콘솔 '모델 액세스'에서 사용할 모델 활성화 → 모델 id 확보
4. **S3**: 프론트 버킷 생성, `frontend/` 업로드 (퍼블릭 차단 유지)
5. **CloudFront**: 기본 오리진 = S3(OAC), `/api/*` 비헤이비어 = EC2 오리진
   → 프론트 `API_BASE`를 CloudFront 도메인으로 통일하면 CORS 문제 자체가 사라짐

## 산출물 (Claude) — 완료

- [x] `deploy/setup-ec2.sh` — python 설치, pip install, systemd 등록·기동
- [x] `deploy/gamesvc.service` — systemd 유닛 (`GAME_LLM=bedrock` env, `GAME_BEDROCK_MODEL`만 교체)
- [x] `deploy/README.md` — 콘솔 체크리스트 상세판 + 트러블슈팅 표 (CloudFront `/api/*` 구간 포함)

## 완료 기준

- [ ] CloudFront URL 접속 → 게임 완주 → 결과지 + Q&A 동작
- [ ] EC2 내 자격증명 파일 없음 (IAM role만) 확인
- [ ] 서버 재부팅 후 systemd 자동 기동 확인
