require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());
// 정적 파일 서빙
app.use(express.static('public'));

// Gemini Client 초기화 (v1alpha 필수)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ─── Ephemeral Token 발급 엔드포인트 ───────────────────────
app.get('/api/token', async (req, res) => {
  try {
    // 30분 만료 토큰
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    
    // 임시 토큰 생성 (Live Translation 전용 제약조건)
    const tokenResponse = await ai.authTokens.create({
      config: {
        uses: 1, // 토큰은 1회성(하나의 WebSocket 연결에만 사용)
        expireTime: expireTime,
        liveConnectConstraints: {
          model: 'gemini-3.5-live-translate-preview',
          config: {
            responseModalities: ['AUDIO'],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            // translationConfig를 비워두고 잠금 해제하여 클라이언트가 원하는 언어를 선택할 수 있게 함
          }
        },
        // 클라이언트에서 translationConfig 설정을 허용
        lockAdditionalFields: [],
        httpOptions: {
          apiVersion: 'v1alpha'
        }
      }
    });

    // tokenResponse는 { name: "auth_tokens/..." } 형태입니다.
    // Constrained 엔드포인트에 전달할 때는 전체 name을 그대로 전달해야 합니다.
    res.json({ token: tokenResponse.name });
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

// ─── Socket.io (오디오 브로드캐스팅 릴레이) ────────────────
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // 방 접속 (가이드 or 관광객)
  socket.on('join-room', ({ roomId, role }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.role = role;
    console.log(`[${role}] joined room: ${roomId}`);
    
    // 같은 방의 사람들에게 알림
    socket.to(roomId).emit('user-joined', { role, id: socket.id });
  });

  // 가이드 -> 관광객: 원시 PCM 16kHz 오디오 전송
  socket.on('audio-chunk', (base64Audio) => {
    if (socket.role === 'guide' && socket.roomId) {
      // 나를 제외한 방 안의 모든 사용자(관광객)에게 브로드캐스트
      socket.to(socket.roomId).emit('audio-chunk', base64Audio);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
