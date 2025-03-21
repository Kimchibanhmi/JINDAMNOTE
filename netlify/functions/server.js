const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const { GoogleAuth } = require('google-auth-library');
const serverless = require('serverless-http');

// 환경 변수 로드
dotenv.config();

// 서비스 계정 인증 설정
const auth = new GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON),
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

const app = express();

// CORS 설정 - Netlify 호스팅에서는 필요 없지만 개발 환경을 위해 유지
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// JSON 파싱 미들웨어
app.use(express.json());

// 서버 상태 확인 엔드포인트
app.get('/health', (req, res) => {
  console.log('상태 확인 요청 받음');
  res.status(200).json({
    status: 'ok',
    message: '서버가 정상적으로 실행 중입니다',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    api: 'Google Cloud Translation (서비스 계정)',
  });
});

// 단어 정보 API 엔드포인트
app.post('/word-info', async (req, res) => {
  try {
    const { word } = req.body;

    console.log(`단어 정보 요청: ${word}`);

    // 로컬 데이터 사용
    const wordInfo = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: `병음: ${getDefaultPinyin(
                  word
                )}\n의미: ${getDefaultMeaning(word)}`,
              },
            ],
          },
        },
      ],
    };

    res.json(wordInfo);
  } catch (error) {
    // 상세한 오류 로깅
    console.error('단어 정보 요청 오류:', error.message);
    if (error.response) {
      console.error('API 오류 응답 상태:', error.response.status);
      console.error('API 오류 응답 데이터:', error.response.data);
    }

    const errorResponse = {
      error: {
        message: error.message,
        code: error.response?.status || 500,
      },
    };
    res.status(error.response?.status || 500).json(errorResponse);
  }
});

// 예문 생성 API 엔드포인트
app.post('/generate-examples', async (req, res) => {
  try {
    const { word, pinyin, meaning } = req.body;
    console.log(`예문 생성 요청: ${word}, ${pinyin}, ${meaning}`);

    // 고정된 중국어 예문 몇 개 준비
    const exampleTemplates = [
      `我喜欢${word}。`, // 저는 [단어]를 좋아합니다.
      `他在${word}。`, // 그는 [단어]하고 있습니다.
      `${word}很重要。`, // [단어]는 매우 중요합니다.
      `昨天我们${word}了。`, // 어제 우리는 [단어]했습니다.
      `这个${word}很好。`, // 이 [단어]는 매우 좋습니다.
      `我们需要${word}。`, // 우리는 [단어]가 필요합니다.
      `${word}对我们很有用。`, // [단어]는 우리에게 매우 유용합니다.
      `学习${word}很重要。`, // [단어]를 배우는 것은 매우 중요합니다.
    ];

    // 랜덤으로 예문 선택
    const randomIndex = Math.floor(Math.random() * exampleTemplates.length);
    const chineseExample = exampleTemplates[randomIndex];

    console.log(`선택된 중국어 예문: ${chineseExample}`);

    try {
      // 서비스 계정 인증 토큰 가져오기
      const client = await auth.getClient();
      const accessToken = await client.getAccessToken();

      console.log('서비스 계정 토큰 획득 성공');

      // Google Cloud Translation API 호출 (서비스 계정 사용)
      const translateUrl =
        'https://translation.googleapis.com/language/translate/v2';
      console.log(`번역 API URL: ${translateUrl}`);

      const translateResponse = await axios({
        method: 'POST',
        url: translateUrl,
        headers: {
          Authorization: `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json',
        },
        data: {
          q: chineseExample,
          source: 'zh-CN',
          target: 'ko',
          format: 'text',
        },
      });

      console.log(
        '번역 응답 받음:',
        JSON.stringify(translateResponse.data).substring(0, 100)
      );

      const koreanTranslation =
        translateResponse.data.data.translations[0].translatedText;
      console.log(`번역된 한국어: ${koreanTranslation}`);

      // API 응답에서 단어 분석 부분이 부족하면 서버에서 자체적으로 분석 데이터 생성
      // 분석 데이터 생성 - 전체 문장의 모든 문자에 대한 분석
      let fullAnalysis = '';

      // 문장을 문자 단위로 분리하고 각 문자에 병음 할당
      for (let i = 0; i < chineseExample.length; i++) {
        const char = chineseExample[i];

        // 구두점 건너뛰기
        if (/[，。！？、:;]/.test(char)) {
          continue;
        }

        // 일반적인 공백 문자 건너뛰기
        if (char === ' ') {
          continue;
        }

        // 단어 조합 확인 (2글자 단어 먼저 처리)
        if (i < chineseExample.length - 1) {
          const twoChars = char + chineseExample[i + 1];
          if (twoChars === word) {
            fullAnalysis += `${word},${pinyin || getDefaultPinyin(word)}, `;
            i++; // 다음 문자 건너뛰기
            continue;
          }

          const twoCharsPinyin = getDefaultPinyin(twoChars);
          if (twoCharsPinyin && twoCharsPinyin !== '(병음 정보 없음)') {
            fullAnalysis += `${twoChars},${twoCharsPinyin}, `;
            i++; // 다음 문자 건너뛰기
            continue;
          }
        }

        // 단일 문자 처리
        const charPinyin = getDefaultPinyin(char);
        if (charPinyin && charPinyin !== '(병음 정보 없음)') {
          fullAnalysis += `${char},${charPinyin}, `;
        } else {
          // 병음 정보가 없는 경우
          fullAnalysis += `${char},${char}, `;
        }
      }

      // 마지막 쉼표 제거
      fullAnalysis = fullAnalysis.trim().replace(/,\s*$/, '');

      // 결과 구성 - 확장된 분석 데이터 사용
      const result = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: `1. 중국어 예문: ${chineseExample}\n한국어 번역: ${koreanTranslation}\n단어 분석: ${fullAnalysis}`,
                },
              ],
            },
          },
        ],
      };

      res.json(result);
    } catch (translationError) {
      console.error('번역 API 오류:', translationError.message);

      // 로컬 번역 템플릿으로 폴백
      const translationTemplates = [
        `저는 ${meaning}을(를) 좋아합니다.`,
        `그는 ${meaning}하고 있습니다.`,
        `${meaning}은(는) 매우 중요합니다.`,
        `어제 우리는 ${meaning}했습니다.`,
        `이 ${meaning}은(는) 매우 좋습니다.`,
        `우리는 ${meaning}이(가) 필요합니다.`,
        `${meaning}은(는) 우리에게 매우 유용합니다.`,
        `${meaning}을(를) 배우는 것은 매우 중요합니다.`,
      ];

      const koreanTranslation = translationTemplates[randomIndex];
      console.log(`폴백 한국어 번역: ${koreanTranslation}`);

      // 폴백에서도 전체 분석 데이터 생성
      let fullAnalysis = '';

      for (let i = 0; i < chineseExample.length; i++) {
        const char = chineseExample[i];

        // 구두점 건너뛰기
        if (/[，。！？、:;]/.test(char)) {
          continue;
        }

        // 일반적인 공백 문자 건너뛰기
        if (char === ' ') {
          continue;
        }

        // 단어 조합 확인 (2글자 단어 먼저 처리)
        if (i < chineseExample.length - 1) {
          const twoChars = char + chineseExample[i + 1];
          if (twoChars === word) {
            fullAnalysis += `${word},${pinyin || getDefaultPinyin(word)}, `;
            i++; // 다음 문자 건너뛰기
            continue;
          }

          const twoCharsPinyin = getDefaultPinyin(twoChars);
          if (twoCharsPinyin && twoCharsPinyin !== '(병음 정보 없음)') {
            fullAnalysis += `${twoChars},${twoCharsPinyin}, `;
            i++; // 다음 문자 건너뛰기
            continue;
          }
        }

        // 단일 문자 처리
        const charPinyin = getDefaultPinyin(char);
        if (charPinyin && charPinyin !== '(병음 정보 없음)') {
          fullAnalysis += `${char},${charPinyin}, `;
        } else {
          // 병음 정보가 없는 경우
          fullAnalysis += `${char},${char}, `;
        }
      }

      // 마지막 쉼표 제거
      fullAnalysis = fullAnalysis.trim().replace(/,\s*$/, '');

      // 결과 구성
      const result = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: `1. 중국어 예문: ${chineseExample}\n한국어 번역: ${koreanTranslation}\n단어 분석: ${fullAnalysis}`,
                },
              ],
            },
          },
        ],
      };

      res.json(result);
    }
  } catch (error) {
    // 오류 처리
    console.error('예문 생성 요청 오류:', error.message);
    if (error.response) {
      console.error('API 오류 응답 상태:', error.response.status);
      console.error(
        'API 오류 응답 데이터:',
        JSON.stringify(error.response.data)
      );
    }

    res.status(500).json({
      error: {
        message: '예문 생성 중 오류가 발생했습니다: ' + error.message,
        code: error.response?.status || 500,
      },
    });
  }
});


// 서버리스 함수로 변환
module.exports.handler = serverless(app);
