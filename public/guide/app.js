const socket = io();
let audioContext;
let scriptProcessor;
let mediaStream;

const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const inputRoomId = document.getElementById('room-id');
const statusText = document.getElementById('status-text');
const micStatus = document.getElementById('mic-status');
const inputPassword = document.getElementById('guide-password');

// 기존 auth-error 리스너는 삭제됨 (콜백으로 대체)

btnStart.addEventListener('click', async () => {
  const roomId = inputRoomId.value.trim();
  const password = inputPassword.value.trim();
  
  if (!roomId) return alert('방 번호를 입력하세요.');
  if (!password) return alert('가이드 비밀번호를 입력하세요.');

  socket.emit('join-room', { roomId, role: 'guide', password }, async (response) => {
    if (response && !response.success) {
      alert(response.message);
      return; // 인증 실패 시 마이크 시작 안 함
    }

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(mediaStream);
      
      // 4096 프레임 단위 처리 (약 256ms @ 16kHz)
      scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      
      scriptProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        let pcmData = new Int16Array(inputData.length);
        let maxVol = 0;

        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          maxVol = Math.max(maxVol, Math.abs(s));
        }

        // 볼륨에 따른 UI 업데이트
        if (maxVol > 0.05) {
          micStatus.style.background = '#34a853';
          micStatus.style.transform = `scale(${1 + maxVol})`;
        } else {
          micStatus.style.background = '#ccc';
          micStatus.style.transform = 'scale(1)';
        }

        // Base64 인코딩 후 전송
        const buffer = pcmData.buffer;
        const base64Audio = btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)));
        socket.emit('audio-chunk', base64Audio);
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);

      btnStart.style.display = 'none';
      btnStop.style.display = 'inline-block';
      inputRoomId.disabled = true;
      inputPassword.disabled = true;
      statusText.textContent = `방송 중... (방 번호: ${roomId})`;
    } catch (err) {
      console.error(err);
      alert('마이크 접근 권한이 필요합니다.');
    }
  });
});

btnStop.addEventListener('click', () => {
  if (scriptProcessor) scriptProcessor.disconnect();
  if (audioContext) audioContext.close();
  if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());

  btnStart.style.display = 'inline-block';
  btnStop.style.display = 'none';
  inputRoomId.disabled = false;
  inputPassword.disabled = false;
  statusText.textContent = '방송 종료';
  micStatus.style.background = '#ccc';
});
