#!/usr/bin/env bash
# EC2(Amazon Linux 2023)에서 실행: bash deploy/setup-ec2.sh
# 사전 조건: 코드가 /home/ec2-user/mbti-game 에 업로드되어 있을 것
set -euo pipefail

cd /home/ec2-user/mbti-game

sudo dnf install -y python3.11 python3.11-pip
python3.11 -m pip install --user -r requirements.txt

sudo cp deploy/gamesvc.service /etc/systemd/system/gamesvc.service
sudo systemctl daemon-reload
sudo systemctl enable --now gamesvc

echo "== 상태 확인 =="
sleep 2
sudo systemctl status gamesvc --no-pager | head -5
curl -s http://localhost:8000/health && echo
echo "완료. 브라우저: http://<EC2 퍼블릭 IP>:8000 (SG 인바운드 허용 필요)"
