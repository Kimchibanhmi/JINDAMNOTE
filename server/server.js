const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const { GoogleAuth } = require('google-auth-library');

// 환경 변수 로드
dotenv.config();

// 서비스 계정 인증 설정
const auth = new GoogleAuth({
  keyFile: './kimchibanhmi-0320-d9395f6c6f79.json',
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors()); // 모든 출처에서의 요청 허용
app.use(express.json()); // JSON 요청 바디 파싱

// 서버 상태 확인 엔드포인트
app.get('/api/health', (req, res) => {
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
app.post('/api/word-info', async (req, res) => {
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
app.post('/api/generate-examples', async (req, res) => {
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

// 기본 병음 가져오기 (확장된 버전)
function getDefaultPinyin(word) {
  const pinyinMap = {
    // 기본 단어
    你: 'nǐ',
    好: 'hǎo',
    我: 'wǒ',
    是: 'shì',
    吃饭: 'chī fàn',
    学习: 'xué xí',
    中国: 'zhōng guó',
    汉语: 'hàn yǔ',
    电脑: 'diàn nǎo',
    手机: 'shǒu jī',
    朋友: 'péng yǒu',
    老师: 'lǎo shī',
    学生: 'xué shēng',
    工作: 'gōng zuò',
    喜欢: 'xǐ huān',
    爱: 'ài',
    家: 'jiā',
    去: 'qù',
    来: 'lái',
    看: 'kàn',
    听: 'tīng',
    说: 'shuō',
    读: 'dú',
    写: 'xiě',
    睡觉: 'shuì jiào',
    起床: 'qǐ chuáng',
    休息: 'xiū xí',
    玩: 'wán',
    买: 'mǎi',
    卖: 'mài',
    软件: 'ruǎn jiàn',
    王: 'wáng',

    // 문장 구성 단어
    吃: 'chī',
    饭: 'fàn',
    很: 'hěn',
    重要: 'zhòng yào',
    现在: 'xiàn zài',
    要: 'yào',
    昨天: 'zuó tiān',
    我们: 'wǒ men',
    了: 'le',
    这个: 'zhè ge',
    对: 'duì',
    有用: 'yǒu yòng',
    学习: 'xué xí',
    一起: 'yī qǐ',
    在: 'zài',
    今天: 'jīn tiān',
    明天: 'míng tiān',
    时间: 'shí jiān',
    地方: 'dì fāng',
    怎么: 'zěn me',
    为什么: 'wèi shén me',
    因为: 'yīn wèi',
    所以: 'suǒ yǐ',
    但是: 'dàn shì',
    如果: 'rú guǒ',
    可以: 'kě yǐ',
    不可以: 'bù kě yǐ',
    认为: 'rèn wéi',
    觉得: 'jué de',
    希望: 'xī wàng',
    担心: 'dān xīn',
    害怕: 'hài pà',
    高兴: 'gāo xìng',
    难过: 'nán guò',
    生气: 'shēng qì',
    不: 'bù',
    和: 'hé',
    也: 'yě',
    都: 'dōu',
    还: 'hái',
    已经: 'yǐ jīng',
    刚才: 'gāng cái',
    马上: 'mǎ shàng',
    以后: 'yǐ hòu',
    以前: 'yǐ qián',
    早上: 'zǎo shang',
    上午: 'shàng wǔ',
    中午: 'zhōng wǔ',
    下午: 'xià wǔ',
    晚上: 'wǎn shang',
    这里: 'zhè lǐ',
    那里: 'nà lǐ',
    哪里: 'nǎ lǐ',
    多少: 'duō shǎo',
    几: 'jǐ',
    次: 'cì',
    个: 'gè',
    些: 'xiē',
    大: 'dà',
    小: 'xiǎo',
    多: 'duō',
    少: 'shǎo',
    快: 'kuài',
    慢: 'màn',
    容易: 'róng yì',
    困难: 'kùn nán',
    新: 'xīn',
    旧: 'jiù',
    年: 'nián',
    岁: 'suì',
    // 기타 일반적인 단어
    人: 'rén',
    东西: 'dōng xi',
    这: 'zhè',
    那: 'nà',
    哪: 'nǎ',
    什么: 'shén me',
    谁: 'shuí',
    哪儿: 'nǎr',
    哪里: 'nǎ lǐ',
    多长时间: 'duō cháng shí jiān',
    怎么样: 'zěn me yàng',
    大家: 'dà jiā',
    自己: 'zì jǐ',
    每: 'měi',
    有: 'yǒu',
    没有: 'méi yǒu',
    想: 'xiǎng',
    认识: 'rèn shi',
    知道: 'zhī dào',
    忘记: 'wàng jì',
    记得: 'jì de',
    错: 'cuò',
    对: 'duì',
    开始: 'kāi shǐ',
    结束: 'jié shù',
    问: 'wèn',
    回答: 'huí dá',
    告诉: 'gào sù',
    帮助: 'bāng zhù',
    需要: 'xū yào',
    懂: 'dǒng',
    等: 'děng',
    才: 'cái',
    再: 'zài',
    又: 'yòu',
    或者: 'huò zhě',
    还是: 'hái shì',
    一定: 'yī dìng',
    可能: 'kě néng',
    应该: 'yīng gāi',
    必须: 'bì xū',
    只: 'zhǐ',
    就: 'jiù',
    还有: 'hái yǒu',
    最后: 'zuì hòu',
    一般: 'yī bān',
    特别: 'tè bié',
    非常: 'fēi cháng',
    真: 'zhēn',
    真的: 'zhēn de',
    假: 'jiǎ',
    假的: 'jiǎ de',
    男: 'nán',
    女: 'nǚ',
    男人: 'nán rén',
    女人: 'nǚ rén',
    孩子: 'hái zi',
    朋友: 'péng you',
    男朋友: 'nán péng you',
    女朋友: 'nǚ péng you',
    丈夫: 'zhàng fu',
    妻子: 'qī zi',
    父亲: 'fù qīn',
    母亲: 'mǔ qīn',
    爸爸: 'bà ba',
    妈妈: 'mā ma',
    儿子: 'ér zi',
    女儿: 'nǚ ér',
    哥哥: 'gē ge',
    弟弟: 'dì di',
    姐姐: 'jiě jie',
    妹妹: 'mèi mei',
    祖父: 'zǔ fù',
    祖母: 'zǔ mǔ',
    爷爷: 'yé ye',
    奶奶: 'nǎi nai',
    叔叔: 'shū shu',
    阿姨: 'ā yí',
  };

  return pinyinMap[word] || '(병음 정보 없음)';
}

// 기본 의미 가져오기 (확장 가능)
function getDefaultMeaning(word) {
  const meaningMap = {
    你: '너, 당신',
    好: '좋다',
    我: '나, 저',
    是: '이다',
    吃饭: '밥을 먹다',
    学习: '공부하다',
    中国: '중국',
    汉语: '중국어',
    电脑: '컴퓨터',
    手机: '휴대폰',
    朋友: '친구',
    老师: '선생님',
    学生: '학생',
    工作: '일하다',
    喜欢: '좋아하다',
    爱: '사랑하다',
    家: '집, 가족',
    去: '가다',
    来: '오다',
    看: '보다',
    听: '듣다',
    说: '말하다',
    读: '읽다',
    写: '쓰다',
    睡觉: '잠자다',
    起床: '기상하다',
    工作: '일하다',
    休息: '휴식하다',
    玩: '놀다',
    买: '사다',
    卖: '팔다',
    软件: '소프트웨어',
    王: '왕, 임금',
    // 추가 단어를 이곳에 넣을 수 있음
  };

  return meaningMap[word] || '(의미 정보 없음)';
}

// 정적 파일 제공 (클라이언트 코드)
app.use(express.static('../'));

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다`);
  console.log(`사용 중인 API: Google Cloud Translation (서비스 계정)`);
});
