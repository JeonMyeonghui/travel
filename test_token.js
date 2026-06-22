require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function test() {
  try {
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const tokenResponse = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: expireTime,
        liveConnectConstraints: {
          model: 'gemini-3.5-live-translate-preview',
          config: {
            responseModalities: ['AUDIO'],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          }
        },
        lockAdditionalFields: [],
        httpOptions: {
          apiVersion: 'v1alpha'
        }
      }
    });
    console.log(JSON.stringify(tokenResponse, null, 2));
    console.log('Token property:', tokenResponse.token);

    const { WebSocket } = require('ws');
    const tokenStr = tokenResponse.name.replace('auth_tokens/', '');
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?bearer_token=${tokenStr}`;
    const ws = new WebSocket(wsUrl);
    ws.on('open', () => console.log('WS OPENED'));
    ws.on('error', e => console.error('WS ERROR', e.message));
    ws.on('close', (code, reason) => console.log('WS CLOSED', code, reason.toString()));

  } catch (error) {
    console.error('Error:', error);
  }
}
test();
