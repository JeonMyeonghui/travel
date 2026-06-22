# 🌐 Local Voice (로컬 보이스) - 실시간 1:N 다국어 통역 플랫폼

**Local Voice**는 별도의 앱 설치 없이 웹 브라우저만으로 가이드와 다수의 관광객을 연결해주는 **실시간 음성 통역 플랫폼**입니다.
오프라인 다국어 투어, 국제 회의, 박물관 도슨트 투어 등에서 스마트폰 하나로 완벽한 글로벌 소통을 가능하게 합니다.

현재 라이브 서버: [https://travel-hvha.onrender.com](https://travel-hvha.onrender.com)

---

## ✨ 핵심 기능 (Features)

1. **실시간 1:N 브로드캐스트 통역**
   - 가이드 한 명이 한국어로 말하면, 접속한 여러 명의 관광객이 **각자 원하는 언어(영어, 일본어, 중국어, 스페인어, 프랑스어 등)**로 동시에 통역을 받을 수 있습니다.
2. **별도 앱 설치 불필요 (WebRTC / WebSockets)**
   - 앱스토어에서 앱을 다운로드할 필요 없이 제공된 URL 링크 하나로 모든 기능이 작동합니다.
3. **프리미엄 UI / 모바일 최적화**
   - 글래스모피즘(Glassmorphism)과 직관적인 애니메이션을 적용하여 세련되고 현대적인 사용자 경험(UX)을 제공합니다.
4. **자막 및 음성 동시 출력 (Toggle 방식)**
   - 통역된 음성을 스피커/이어폰으로 듣는 동시에, 화면에 번역된 텍스트 자막을 실시간으로 띄웁니다. 사용자는 음성이나 자막 중 원하는 것만 켜고 끌 수 있습니다.
5. **안전한 토큰 발급 구조 (보안성)**
   - API 키가 브라우저에 직접 노출되지 않도록, 백엔드 서버에서 30분 만료형 단기 토큰(Ephemeral Token)을 발급받아 통신하는 구조입니다.

---

## 🛠 기술 스택 (Tech Stack)

- **Frontend:** HTML5, CSS3, Vanilla JavaScript, Web Audio API
- **Backend:** Node.js, Express
- **Realtime Comm:** Socket.io (가이드-관광객 간 오디오 릴레이)
- **AI / Translation:** Google Gemini Live API (v1alpha, `gemini-3.5-live-translate-preview` 모델)
- **Deployment:** Render.com (Web Services, 무료 티어 호환)

---

## 🏗 시스템 아키텍처 (Architecture Flow)

1. **마이크 캡처:** 가이드 스마트폰 브라우저에서 16kHz 모노 PCM 오디오 추출.
2. **소켓 전송:** 캡처된 오디오 데이터를 Base64 형태로 인코딩하여 Node.js 서버(`Socket.io`)로 전송.
3. **룸(Room) 브로드캐스트:** 서버는 같은 PIN 번호 방에 접속한 관광객들에게 해당 오디오 패킷을 중계.
4. **Gemini Live 번역:** 관광객 브라우저가 수신한 가이드의 원본 오디오를 WebSockets을 통해 **Google Gemini Live API**로 패스스루 전송.
5. **응답 재생 및 자막 출력:** 
   - Gemini 모델이 번역한 24kHz PCM 오디오 데이터가 클라이언트로 반환되면 `AudioContext`를 통해 재생합니다.
   - 동시에 `outputAudioTranscription` 기능을 통해 반환된 텍스트를 파싱하여 화면에 자막으로 표시합니다.

---

## 📱 사용 방법 (Usage Guide)

### 1. 가이드 (설명하는 사람)
1. 스마트폰이나 PC 브라우저로 접속합니다.
2. **`🎙️ 나는 설명하는 가이드입니다`** 버튼을 클릭합니다.
3. 그룹과 공유할 **방 번호(PIN, 예: 1234)**를 입력하고 `방송 시작` 버튼을 누릅니다.
   - 최초 실행 시 브라우저의 **마이크 접근 권한**을 꼭 허용해 주세요.
4. 마이크 지시등이 깜빡이면 한국어로 편하게 안내를 시작합니다.

### 2. 관광객 (설명 듣는 사람)
1. 본인의 스마트폰 브라우저로 동일한 주소에 접속합니다.
2. **`🎧 나는 번역을 듣고 싶습니다`** 버튼을 클릭합니다.
3. 가이드가 알려준 **방 번호(PIN)**를 입력하고, 본인이 듣기 원하는 **언어**를 선택합니다.
4. 필요에 따라 `음성 출력`과 `자막 표시` 토글을 켜고 끕니다.
5. `접속 및 통역 시작` 버튼을 누르면 가이드의 말이 즉각 번역되어 출력됩니다.

---

## 💻 로컬 개발 및 실행 방법 (Local Development)

본 프로젝트를 로컬 환경(자신의 PC)에서 실행하거나 커스텀하려면 아래 절차를 따르세요.

1. **저장소 클론 (Clone)**
   ```bash
   git clone https://github.com/JeonMyeonghui/travel.git
   cd travel
   ```

2. **패키지 설치 (Install Dependencies)**
   ```bash
   npm install
   ```

3. **환경 변수 설정 (.env)**
   프로젝트 최상단 경로에 `.env` 파일을 만들고 아래와 같이 구글 API 키를 입력합니다.
   ```env
   GEMINI_API_KEY="본인의_구글_제미나이_API_키"
   PORT=3000
   ```

4. **서버 실행 (Start Server)**
   ```bash
   npm start
   ```

5. **접속 (Access)**
   - 브라우저를 열고 `http://localhost:3000` 으로 접속합니다.
