# Flow Studio 포터블

Node.js와 로컬 draw.io를 포함합니다. Node.js 설치, npm 설치, 인터넷 연결 없이 실행할 수 있습니다.

1. 운영체제와 CPU에 맞는 ZIP을 다운로드하고 쓰기 가능한 폴더에 **전체 압축 해제**합니다.
2. Windows: `start.bat`를 실행합니다. macOS: `start.command`를 실행합니다. Linux: 터미널에서 `./start.sh`를 실행합니다.
3. 브라우저에서 **http://127.0.0.1:5180/**을 엽니다. 실행 창은 열어 두세요. 종료는 Ctrl+C입니다.

macOS Apple Silicon은 darwin-arm64, Intel Mac은 darwin-x64입니다. Windows는 x64, Linux는 x64/arm64를 제공합니다. Linux는 glibc 2.28 이상 환경이 필요합니다.

macOS에서 다운로드한 실행 파일을 보안 설정이 막을 수 있습니다. 출처를 확인한 뒤 시스템 설정에서 실행을 허용하세요. 실행 권한이 없어졌다면 터미널에서 `chmod +x start.command runtime/node`를 실행하세요. Linux도 `chmod +x start.sh runtime/node`로 복구할 수 있습니다.

문서·복구본·버전 이력은 포터블 폴더의 `.data/flow.sqlite`에 저장됩니다. 백업은 서버를 종료하고 `.data` 폴더 전체를 복사합니다. 업데이트는 별도 폴더에 압축을 풀고 서버가 종료된 상태에서 기존 `.data`를 옮깁니다. 배포 파일에는 개인 문서를 포함하지 않습니다.

포트가 사용 중이면 Windows에서 `set PORT=5181`, macOS/Linux에서 `PORT=5181 ./start.command` 또는 `PORT=5181 ./start.sh`로 실행하고 해당 포트로 접속합니다.

서버는 같은 네트워크에서 공유 링크로 접속할 수 있습니다. 문서 관리는 localhost에서만 가능합니다. 로그인·권한·실시간 공동편집은 지원하지 않습니다. Node.js와 draw.io 및 xmldom의 라이선스는 포함된 각 배포 폴더에 있습니다. 실행 파일은 코드 서명되지 않았습니다.
