// Gemini API 연동 (프록시 서버 사용)
const ApiService = {
  // API 서버 URL (리디렉션 규칙 사용)
  API_URL: '/api',

  // 단어의 병음과 의미 가져오기
  getWordInfo: async function (word) {
    try {
      console.log('단어 정보 요청:', word);

      // 일부 공통 단어는 로컬에서 처리 (서버 오류 시 폴백으로도 사용)
      const commonWords = {
        吃: { pinyin: 'chī', meaning: '먹다' },
        好: { pinyin: 'hǎo', meaning: '좋다' },
        学: { pinyin: 'xué', meaning: '배우다' },
        说: { pinyin: 'shuō', meaning: '말하다' },
        是: { pinyin: 'shì', meaning: '~이다' },
        去: { pinyin: 'qù', meaning: '가다' },
        来: { pinyin: 'lái', meaning: '오다' },
        吃饭: { pinyin: 'chī fàn', meaning: '밥을 먹다' },
        学习: { pinyin: 'xué xí', meaning: '공부하다' },
        工作: { pinyin: 'gōng zuò', meaning: '일하다' },
        睡觉: { pinyin: 'shuì jiào', meaning: '잠을 자다' },
      };

      // 공통 단어면 즉시 반환
      if (commonWords[word]) {
        console.log('로컬 데이터 사용:', word);
        return commonWords[word];
      }

      // 프록시 서버에 요청
      const response = await fetch(`${this.API_URL}/word-info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ word }),
      });

      // 응답 확인
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || '서버 오류');
      }

      const data = await response.json();
      console.log('단어 정보 API 응답:', data);
      return this.parseWordInfo(data);
    } catch (error) {
      console.error('단어 정보 가져오기 오류:', error);

      // 오류 발생 시 기본값 제공 (사용자 경험 향상)
      return {
        pinyin: '',
        meaning: '',
      };
    }
  },

  // 병음에서 특수문자 제거
  cleanPinyin: function (pinyin) {
    if (!pinyin) return '';
    // 마침표, 콤마, 느낌표, 물음표 등의 특수문자 제거
    return pinyin.replace(/[.,，。！!?？]/g, '').trim();
  },

  // 단어 정보 파싱
  parseWordInfo: function (apiResponse) {
    try {
      console.log('파싱할 응답:', apiResponse);

      // API 오류 확인
      if (apiResponse.error) {
        console.error('API 오류 응답:', apiResponse.error);
        throw new Error('API 오류: ' + apiResponse.error.message);
      }

      if (
        !apiResponse.candidates ||
        !apiResponse.candidates[0] ||
        !apiResponse.candidates[0].content ||
        !apiResponse.candidates[0].content.parts ||
        !apiResponse.candidates[0].content.parts[0].text
      ) {
        throw new Error('API 응답 형식이 예상과 다릅니다.');
      }

      const text = apiResponse.candidates[0].content.parts[0].text;
      console.log('추출된 텍스트:', text);

      // 병음과 의미 추출
      const pinyinMatch = /병음\s*:\s*([^\n]+)/i.exec(text);
      const meaningMatch = /의미\s*:\s*([^\n]+)/i.exec(text);

      console.log('추출된 병음 매칭:', pinyinMatch);
      console.log('추출된 의미 매칭:', meaningMatch);

      if (!pinyinMatch || !meaningMatch) {
        // 백업 방법: 텍스트 분석으로 추출 시도
        const lines = text.split('\n').filter((line) => line.trim() !== '');
        let pinyin = '',
          meaning = '';

        for (const line of lines) {
          if (line.includes('병음') || line.includes('발음')) {
            pinyin =
              line.split(':')[1]?.trim() ||
              line.split('병음')[1]?.trim() ||
              line.split('발음')[1]?.trim() ||
              '';
          } else if (line.includes('의미') || line.includes('뜻')) {
            meaning =
              line.split(':')[1]?.trim() ||
              line.split('의미')[1]?.trim() ||
              line.split('뜻')[1]?.trim() ||
              '';
          }
        }

        if (pinyin && meaning) {
          console.log('백업 방법으로 추출 성공:', { pinyin, meaning });
          return {
            pinyin: this.cleanPinyin(pinyin),
            meaning,
          };
        }

        throw new Error('병음 또는 의미를 추출할 수 없습니다.');
      }

      const result = {
        pinyin: this.cleanPinyin(pinyinMatch[1].trim()),
        meaning: meaningMatch[1].trim(),
      };

      console.log('최종 추출 결과:', result);
      return result;
    } catch (error) {
      console.error('단어 정보 파싱 오류:', error);
      return { pinyin: '', meaning: '' };
    }
  },

  // 단어로 예문 생성
  generateExamples: async function (word, pinyin, meaning) {
    try {
      console.log('예문 생성 요청 파라미터:', { word, pinyin, meaning });
      console.log('API URL:', this.API_URL);

      // 병음이나 의미가 없으면 기본값 설정
      let safePin = pinyin || '';
      let safeMeaning = meaning || '';

      const requestURL = `${this.API_URL}/generate-examples`;
      console.log('요청 전체 URL:', requestURL);

      // 프록시 서버에 요청
      const response = await fetch(requestURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ word, pinyin: safePin, meaning: safeMeaning }),
      });

      // 응답 확인
      if (!response.ok) {
        const errorData = await response.json();

        // 429 에러 (할당량 초과) 처리
        if (response.status === 429) {
          throw new Error(
            'API 할당량 초과: 현재 너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.'
          );
        }

        throw new Error(errorData.error?.message || '서버 오류');
      }

      const data = await response.json();
      console.log('예문 생성 API 응답:', data);

      // 파싱한 결과 반환
      const examples = this.parseExamples(data);

      // 예문이 없으면 빈 배열 반환
      if (!examples || examples.length === 0) {
        console.warn('API에서 예문을 생성하지 못했습니다.');
        return [];
      }

      return examples;
    } catch (error) {
      console.error('예문 생성 오류:', error);
      // API 호출 실패 시 빈 배열 반환하고 오류 전파
      throw error;
    }
  },

  // 기본 예문 생성 (API 호출 실패 시)
  generateFallbackExamples: function (word, pinyin, meaning) {
    console.log('API 호출 실패, 빈 배열 반환');
    return [];
  },

  // API 응답에서 예문 파싱
  parseExamples: function (apiResponse) {
    try {
      console.log('예문 파싱할 응답:', apiResponse);

      // API 오류 확인
      if (apiResponse.error) {
        console.error('API 오류 응답:', apiResponse.error);
        throw new Error('API 오류: ' + apiResponse.error.message);
      }

      if (
        !apiResponse.candidates ||
        !apiResponse.candidates[0] ||
        !apiResponse.candidates[0].content ||
        !apiResponse.candidates[0].content.parts ||
        !apiResponse.candidates[0].content.parts[0].text
      ) {
        throw new Error('API 응답 형식이 예상과 다릅니다.');
      }

      const text = apiResponse.candidates[0].content.parts[0].text;
      console.log('예문 추출된 텍스트:', text);

      const examples = [];

      // 특수문자만 포함된 텍스트인지 확인하는 함수
      const isOnlySpecialChars = (str) => {
        // 중국어 문자, 한글, 영문, 숫자가 포함되어 있는지 확인
        return !/[\u4e00-\u9fff\uac00-\ud7a3a-zA-Z0-9]/.test(str);
      };

      // 예문 추출
      const exampleRegex =
        /(\d+)[\.\s]*중국어 예문[\s]*:[\s]*([^\n]+)[\s\n]*한국어 번역[\s]*:[\s]*([^\n]+)[\s\n]*단어 분석[\s]*:[\s]*([^\n]+)/g;
      let match;

      while ((match = exampleRegex.exec(text)) !== null) {
        console.log('매칭된 예문:', match);

        const chinese = match[2].trim();
        const korean = match[3].trim();
        const analysis = match[4].trim();

        // 단어 분석에서 단어 카드 생성 (개선된 로직)
        const wordCards = [];
        const itemPairs = analysis.trim().split(/,\s*|，\s*/);

        for (let i = 0; i < itemPairs.length; i += 2) {
          if (i + 1 < itemPairs.length) {
            // 한자와 병음이 쌍으로 존재하는 경우
            const word = itemPairs[i].trim();
            // 특수문자만 포함된 단어는 건너뛰기
            if (isOnlySpecialChars(word)) {
              console.log('특수문자만 포함된 단어 무시:', word);
              continue;
            }
            const pinyin = this.cleanPinyin(itemPairs[i + 1].trim());
            wordCards.push({ word, pinyin });
          } else {
            // 남은 항목이 있는 경우 (마지막 항목이 홀수일 때)
            const word = itemPairs[i].trim();
            // 특수문자만 포함된 단어는 건너뛰기
            if (isOnlySpecialChars(word)) {
              console.log('특수문자만 포함된 단어 무시:', word);
              continue;
            }
            wordCards.push({ word, pinyin: '' });
          }
        }

        console.log('생성된 카드:', wordCards);

        examples.push({ chinese, korean, wordCards });
      }

      // 정규식으로 매칭되지 않은 경우 백업 방법으로 시도
      if (examples.length === 0) {
        const lines = text.split('\n').filter((line) => line.trim() !== '');
        let currentExample = null;

        for (const line of lines) {
          if (line.match(/^\d+\./) || line.includes('중국어 예문')) {
            if (currentExample) {
              examples.push(currentExample);
            }
            currentExample = { chinese: '', korean: '', wordCards: [] };

            const chineseMatch = line.match(/예문\s*:\s*(.+)/);
            if (chineseMatch) {
              currentExample.chinese = chineseMatch[1].trim();
            }
          } else if (currentExample) {
            if (line.includes('한국어 번역') || line.includes('한국어:')) {
              const koreanMatch =
                line.match(/번역\s*:\s*(.+)/) ||
                line.match(/한국어\s*:\s*(.+)/);
              if (koreanMatch) {
                currentExample.korean = koreanMatch[1].trim();
              }
            } else if (line.includes('단어 분석') || line.includes('분석:')) {
              const analysisMatch = line.match(/분석\s*:\s*(.+)/);
              if (analysisMatch) {
                const analysis = analysisMatch[1].trim();
                // 개선된 로직 적용
                const itemPairs = analysis.split(/,\s*|，\s*/);
                currentExample.wordCards = [];

                for (let i = 0; i < itemPairs.length; i += 2) {
                  if (i + 1 < itemPairs.length) {
                    // 한자와 병음이 쌍으로 존재하는 경우
                    const word = itemPairs[i].trim();
                    // 특수문자만 포함된 단어는 건너뛰기
                    if (isOnlySpecialChars(word)) {
                      console.log('특수문자만 포함된 단어 무시:', word);
                      continue;
                    }
                    const pinyin = this.cleanPinyin(itemPairs[i + 1].trim());
                    currentExample.wordCards.push({ word, pinyin });
                  } else {
                    // 남은 항목이 있는 경우
                    const word = itemPairs[i].trim();
                    // 특수문자만 포함된 단어는 건너뛰기
                    if (isOnlySpecialChars(word)) {
                      console.log('특수문자만 포함된 단어 무시:', word);
                      continue;
                    }
                    currentExample.wordCards.push({
                      word,
                      pinyin: '',
                    });
                  }
                }
              }
            }
          }
        }

        if (currentExample && currentExample.chinese && currentExample.korean) {
          examples.push(currentExample);
        }
      }

      console.log('최종 예문 결과:', examples);
      return examples;
    } catch (error) {
      console.error('예문 파싱 오류:', error);
      return [];
    }
  },
};
