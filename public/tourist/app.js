const socket = io();
let geminiWs;
let audioContext;
let nextPlayTime = 0;

const btnConnect = document.getElementById('btn-connect');
const btnDisconnect = document.getElementById('btn-disconnect');
const inputRoomId = document.getElementById('room-id');
const selectLanguage = document.getElementById('language-select');
const statusText = document.getElementById('status-text');
const playingIndicator = document.getElementById('playing-indicator');
const toggleVoice = document.getElementById('toggle-voice');
const toggleSubtitle = document.getElementById('toggle-subtitle');
const subtitleBox = document.getElementById('subtitle-box');

toggleSubtitle.addEventListener('change', () => {
  if (!toggleSubtitle.checked) {
    subtitleBox.style.display = 'none';
  } else if (subtitleBox.textContent) {
    subtitleBox.style.display = 'block';
  }
});

btnConnect.addEventListener('click', async () => {
  const roomId = inputRoomId.value.trim();
  const targetLanguage = selectLanguage.value;
  if (!roomId) return alert('방 번호를 입력하세요.');

  statusText.textContent = '토큰 발급 중...';
  
  try {
    // 1. 서버에서 Ephemeral Token 발급
    const response = await fetch('/api/token');
    const data = await response.json();
    if (!data.token) throw new Error('토큰 발급 실패');
    // 2. Gemini Live API WebSocket 연결 (v1alpha, Ephemeral Token 사용 시 Constrained 엔드포인트)
    statusText.textContent = 'Gemini API 연결 중...';
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${data.token}`;
    geminiWs = new WebSocket(wsUrl);

    geminiWs.onopen = () => {
      statusText.textContent = 'Gemini 연결 성공! 세션 초기화 중...';
      
      const setupMessage = {
        setup: {
          model: 'models/gemini-3.5-live-translate-preview',
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: "Aoede"
                }
              }
            },
            translationConfig: {
              targetLanguageCode: targetLanguage,
              echoTargetLanguage: false
            }
          },
          outputAudioTranscription: {}
        }
      };
      geminiWs.send(JSON.stringify(setupMessage));
      // 참고: gemini-3.5-live-translate-preview 모델은 텍스트 입력을 지원하지 않으므로, 
      // 텍스트 기반의 clientContent(startMessage)를 전송하면 오류가 발생하고 연결이 끊어집니다.
      // 오디오 전송은 Socket.io를 통해 가이드로부터 데이터를 받을 때만 `realtimeInput`으로 전송합니다.
    };

    geminiWs.onmessage = async (event) => {
      // FileReader로 Blob 처리
      const text = event.data instanceof Blob ? await event.data.text() : event.data;
      const msg = JSON.parse(text);

      if (msg.serverContent && msg.serverContent.modelTurn) {
        const parts = msg.serverContent.modelTurn.parts;
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            if (toggleVoice.checked) {
              playAudioData(part.inlineData.data); // base64 오디오 재생
            }
          }
          if (part.text) {
             if (toggleSubtitle.checked) {
               subtitleBox.style.display = 'block';
               subtitleBox.textContent = part.text;
             }
          }
        }
      }
      
      // 혹시 transcription이 별도로 올 경우
      if (msg.serverContent && msg.serverContent.outputTranscription) {
         if (toggleSubtitle.checked && msg.serverContent.outputTranscription.text) {
           subtitleBox.style.display = 'block';
           subtitleBox.textContent = msg.serverContent.outputTranscription.text;
         }
      }
      
      if (!toggleSubtitle.checked) {
         subtitleBox.style.display = 'none';
      }
    };

    geminiWs.onerror = (err) => {
      console.error('Gemini WS Error:', err);
      statusText.textContent = 'Gemini API 에러 발생';
    };

    geminiWs.onclose = () => {
      console.log('Gemini WS Closed');
      disconnectAll();
    };

    // 3. Socket.io 서버의 오디오 룸에 조인
    socket.emit('join-room', { roomId, role: 'tourist' });
    
    statusText.textContent = `방송 대기 중... (${targetLanguage} 번역 준비 완료)`;
    btnConnect.style.display = 'none';
    btnDisconnect.style.display = 'inline-block';
    inputRoomId.disabled = true;
    selectLanguage.disabled = true;
    
    // Web Audio API 초기화 (재생용, 24kHz)
    audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    nextPlayTime = audioContext.currentTime;

  } catch (err) {
    console.error(err);
    alert('연결 실패: ' + err.message);
    statusText.textContent = '연결 실패';
  }
});

// 가이드로부터 온 원시 PCM Base64 데이터를 Gemini로 패스스루
socket.on('audio-chunk', (base64Audio) => {
  if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
    const audioMessage = {
      realtimeInput: {
        mediaChunks: [{
          mimeType: "audio/pcm;rate=16000",
          data: base64Audio
        }]
      }
    };
    geminiWs.send(JSON.stringify(audioMessage));
    playingIndicator.style.display = 'block'; // 시각적 피드백
    
    // 간이로 시각 피드백 끄기 타이머 (실제론 재생 종료 이벤트로 처리하는 것이 좋음)
    clearTimeout(window.indicatorTimeout);
    window.indicatorTimeout = setTimeout(() => {
      playingIndicator.style.display = 'none';
    }, 1000);
  }
});

function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function playAudioData(base64Data) {
  if (!audioContext) return;
  const arrayBuffer = base64ToArrayBuffer(base64Data);
  const int16Array = new Int16Array(arrayBuffer);
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 32768.0;
  }
  
  const audioBuffer = audioContext.createBuffer(1, float32Array.length, 24000);
  audioBuffer.copyToChannel(float32Array, 0);

  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);

  if (nextPlayTime < audioContext.currentTime) {
    nextPlayTime = audioContext.currentTime + 0.1;
  }
  source.start(nextPlayTime);
  nextPlayTime += audioBuffer.duration;
}

btnDisconnect.addEventListener('click', () => {
  disconnectAll();
});

function disconnectAll() {
  if (geminiWs) {
    geminiWs.close();
    geminiWs = null;
  }
  socket.disconnect();
  socket.connect(); // 방 탈출을 위해 재연결
  
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  
  btnConnect.style.display = 'inline-block';
  btnDisconnect.style.display = 'none';
  inputRoomId.disabled = false;
  selectLanguage.disabled = false;
  statusText.textContent = '연결이 해제되었습니다.';
  playingIndicator.style.display = 'none';
}
