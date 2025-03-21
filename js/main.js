// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', function () {
  // 요소 참조
  const wordForm = document.getElementById('word-form');
  const exampleSection = document.getElementById('example-section');
  const exampleContainer = document.getElementById('example-container');
  const loadingIndicator = document.getElementById('loading');
  const saveWordBtn = document.getElementById('save-word');
  const vocabularyList = document.getElementById('vocabulary-list');
  const dateSelect = document.getElementById('date-select');
  const allDatesBtn = document.getElementById('all-dates');
  const errorMessage = document.getElementById('error-message');
  const serverStatus = document.getElementById('server-status');

  // API URL 로깅
  console.log('현재 API URL 설정:', ApiService.API_URL);

  // 소개 팝업 관련 요소
  const showAboutBtn = document.getElementById('show-about-btn');
  const aboutPopup = document.getElementById('about-popup');
  const closeAboutBtn = document.getElementById('close-about');

  // 예문 학습 팝업 관련 요소
  const examplesPopup = document.getElementById('examples-popup');
  const popupExamplesContainer = document.getElementById(
    'popup-examples-container'
  );
  const trainBtn = document.getElementById('train-btn');
  const closeExamplesBtn = document.getElementById('close-examples');

  // 서버 연결 상태
  let isServerConnected = false;

  // 현재 생성된 예문 저장
  let currentExamples = [];
  let currentWord = {};

  // 서버 연결 확인 (페이지 로드 시)
  checkServerConnection();

  // 소개 팝업 이벤트 리스너
  if (showAboutBtn && aboutPopup && closeAboutBtn) {
    // 앱 소개 버튼 클릭 시 팝업 표시
    showAboutBtn.addEventListener('click', function () {
      aboutPopup.classList.remove('hidden');
    });

    // 닫기 버튼 클릭 시 팝업 닫기
    closeAboutBtn.addEventListener('click', function () {
      aboutPopup.classList.add('hidden');
    });

    // 팝업 외부 클릭 시 닫기
    aboutPopup.addEventListener('click', function (event) {
      if (event.target === aboutPopup) {
        aboutPopup.classList.add('hidden');
      }
    });
  }

  // 예문 학습 팝업 이벤트 리스너
  if (examplesPopup && closeExamplesBtn && trainBtn) {
    // 훈련하기 버튼 클릭 시 팝업 닫고 게임화면 표시
    trainBtn.addEventListener('click', function () {
      examplesPopup.classList.add('hidden');
      exampleSection.classList.remove('hidden');
    });

    // 닫기 버튼 클릭 시 팝업 닫기
    closeExamplesBtn.addEventListener('click', function () {
      examplesPopup.classList.add('hidden');
    });

    // 팝업 외부 클릭 시 닫기
    examplesPopup.addEventListener('click', function (event) {
      if (event.target === examplesPopup) {
        examplesPopup.classList.add('hidden');
      }
    });
  }

  // 날짜 필터링
  if (dateSelect && allDatesBtn) {
    dateSelect.addEventListener('change', function () {
      displayVocabulary(this.value);
    });

    allDatesBtn.addEventListener('click', function () {
      dateSelect.value = '';
      displayVocabulary();
    });
  }

  // 서버 연결 상태 확인
  async function checkServerConnection() {
    if (!serverStatus) return;

    serverStatus.textContent = '서버 연결 확인 중...';
    serverStatus.className = 'checking';

    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // 타임아웃 설정 (2초)
        signal: AbortSignal.timeout(2000),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('서버 상태:', data);
        isServerConnected = true;
        serverStatus.textContent = '서버 연결됨 ✓';
        serverStatus.className = 'connected';
        hideError();
      } else {
        throw new Error('서버 응답이 올바르지 않습니다.');
      }
    } catch (error) {
      console.error('서버 연결 실패:', error);
      isServerConnected = false;
      serverStatus.textContent = '서버 연결 안됨 ✗';
      serverStatus.className = 'disconnected';
      showError(
        '백엔드 서버에 연결할 수 없습니다. 터미널에서 "cd server && npm start" 명령어로 서버를 실행해주세요.'
      );
    }
  }

  // 폼 제출 이벤트
  wordForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const chineseWord = document.getElementById('chinese-word').value.trim();

    if (!chineseWord) {
      showError('중국어 단어를 입력해주세요');
      return;
    }

    // 서버 연결 확인
    if (!isServerConnected) {
      showError(
        '백엔드 서버에 연결할 수 없습니다. 터미널에서 "cd server && npm start" 명령어로 서버를 실행해주세요.'
      );
      return;
    }

    // 로딩 표시
    loadingIndicator.classList.remove('hidden');
    exampleSection.classList.add('hidden');
    hideError();

    try {
      // 단어의 병음과 의미 자동으로 가져오기
      console.log('단어 정보 요청:', chineseWord);
      const wordInfo = await ApiService.getWordInfo(chineseWord);

      console.log('받은 단어 정보:', wordInfo);

      // 단어 정보 저장 (정보가 없어도 진행)
      currentWord = {
        word: chineseWord,
        pinyin: wordInfo?.pinyin || '',
        meaning: wordInfo?.meaning || '',
      };

      try {
        // 예문 생성 API 호출
        console.log('API 요청 URL:', `${ApiService.API_URL}/generate-examples`);
        currentExamples = await ApiService.generateExamples(
          chineseWord,
          currentWord.pinyin,
          currentWord.meaning
        );

        // 예문이 생성되었는지 확인
        if (currentExamples && currentExamples.length > 0) {
          // 팝업에 예문 표시 후 팝업 열기
          displayPopupExamples(currentExamples);
          examplesPopup.classList.remove('hidden');

          // 게임화면은 "훈련하기" 버튼 클릭 시 표시됨
          displayExamples(currentExamples); // 미리 게임화면 준비
        } else {
          // 오류 메시지를 더 구체적으로 제공
          console.error('예문이 생성되지 않았습니다.');
          showError('API에서 예문을 생성하지 못했습니다. 다시 시도해주세요.');
        }
      } catch (error) {
        console.error('예문 생성 중 오류 발생:', error);

        // 429 오류(Too Many Requests) 감지 및 처리
        if (error.message && error.message.includes('API 할당량 초과')) {
          showError(
            'API 사용량 제한에 도달했습니다. 잠시 후 다시 시도해주세요.'
          );
        } else if (error.message && error.message.includes('429')) {
          showError(
            'API 사용량 제한에 도달했습니다. 잠시 후 다시 시도해주세요.'
          );
        } else {
          showError(error.message || '오류가 발생했습니다. 다시 시도해주세요.');
        }
      }
    } catch (error) {
      console.error('단어 정보 가져오기 중 오류 발생:', error);
      showError(
        error.message || '단어 정보를 가져올 수 없습니다. 다시 시도해주세요.'
      );
    } finally {
      loadingIndicator.classList.add('hidden');
    }
  });

  // 팝업에 예문 표시
  function displayPopupExamples(examples) {
    if (!popupExamplesContainer) return;

    popupExamplesContainer.innerHTML = '';

    examples.forEach((example, index) => {
      const exampleDiv = document.createElement('div');
      exampleDiv.className = 'popup-example';

      // 중국어 원문
      const chineseP = document.createElement('div');
      chineseP.className = 'popup-example-chinese';
      chineseP.textContent = example.chinese;

      // 병음
      const pinyinP = document.createElement('div');
      pinyinP.className = 'popup-example-pinyin';

      // 단어카드의 병음을 조합하여 전체 문장의 병음 생성
      let fullPinyin = '';
      example.wordCards.forEach((card, i) => {
        fullPinyin += (card.pinyin || '') + ' ';
      });

      pinyinP.textContent = fullPinyin.trim();

      // 한국어 해석
      const koreanP = document.createElement('div');
      koreanP.className = 'popup-example-korean';
      koreanP.textContent = example.korean;

      exampleDiv.appendChild(chineseP);
      exampleDiv.appendChild(pinyinP);
      exampleDiv.appendChild(koreanP);

      popupExamplesContainer.appendChild(exampleDiv);
    });
  }

  // 단어장에 저장
  saveWordBtn.addEventListener('click', function () {
    if (!currentWord.word || !currentExamples.length) return;

    const wordData = {
      ...currentWord,
      examples: currentExamples,
    };

    StorageManager.saveWord(wordData);
    alert('단어가 저장되었습니다!');

    // 단어장 업데이트
    displayVocabulary();

    // 폼 초기화
    document.getElementById('chinese-word').value = '';
    exampleSection.classList.add('hidden');
  });

  // 오류 메시지 표시
  function showError(message) {
    if (!errorMessage) return;
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
  }

  // 오류 메시지 숨기기
  function hideError() {
    if (!errorMessage) return;
    errorMessage.classList.add('hidden');
  }

  // 예문과 어휘카드 표시
  function displayExamples(examples) {
    exampleContainer.innerHTML = '';

    examples.forEach((example, exIndex) => {
      const exampleDiv = document.createElement('div');
      exampleDiv.className = 'example-item';

      // 한국어 해석
      const koreanP = document.createElement('p');
      koreanP.className = 'korean-translation';
      koreanP.textContent = example.korean;
      exampleDiv.appendChild(koreanP);

      // 중국어 원문 (처음에는 숨김)
      const chineseP = document.createElement('p');
      chineseP.className = 'chinese-original hidden';
      chineseP.textContent = example.chinese;
      exampleDiv.appendChild(chineseP);

      // 사용자 작성 영역
      const userSentenceDiv = document.createElement('div');
      userSentenceDiv.className = 'user-sentence';
      userSentenceDiv.dataset.exampleIndex = exIndex;
      exampleDiv.appendChild(userSentenceDiv);

      // 어휘카드 컨테이너
      const cardsDiv = document.createElement('div');
      cardsDiv.className = 'vocabulary-cards';

      // 무작위로 어휘카드 순서 섞기
      const shuffledCards = [...example.wordCards].sort(
        () => Math.random() - 0.5
      );

      shuffledCards.forEach((card, cardIndex) => {
        const cardButton = document.createElement('button');
        cardButton.className = 'vocab-card';
        cardButton.dataset.exampleIndex = exIndex;
        cardButton.dataset.cardIndex = cardIndex;
        cardButton.dataset.word = card.word;
        cardButton.dataset.pinyin = card.pinyin;

        // 간단하고 명확한 구조로 생성
        cardButton.innerHTML = `
          <div class="word-content">
            <div class="hanzi">${card.word}</div>
            <div class="pinyin">${card.pinyin || ''}</div>
          </div>
        `;

        cardsDiv.appendChild(cardButton);

        // 어휘카드 클릭 이벤트
        cardButton.addEventListener('click', handleCardClick);
      });

      // 문장 확인 버튼
      const checkButton = document.createElement('button');
      checkButton.className = 'check-sentence';
      checkButton.textContent = '문장 확인하기';
      checkButton.dataset.exampleIndex = exIndex;
      checkButton.addEventListener('click', checkSentence);

      // 리셋 버튼
      const resetButton = document.createElement('button');
      resetButton.className = 'reset-sentence';
      resetButton.textContent = '다시 시도';
      resetButton.dataset.exampleIndex = exIndex;
      resetButton.addEventListener('click', resetSentence);

      exampleDiv.appendChild(cardsDiv);
      exampleDiv.appendChild(checkButton);
      exampleDiv.appendChild(resetButton);

      exampleContainer.appendChild(exampleDiv);
    });
  }

  // 어휘카드 클릭 처리
  function handleCardClick(e) {
    const card = e.currentTarget;
    const exIndex = card.dataset.exampleIndex;
    const userSentence = document.querySelector(
      `.user-sentence[data-example-index="${exIndex}"]`
    );

    // 이미 선택된 카드는 처리하지 않음
    if (card.classList.contains('selected')) return;

    // 선택된 카드로 표시
    card.classList.add('selected');

    // 사용자 문장에 단어 추가
    const wordSpan = document.createElement('span');
    wordSpan.className = 'sentence-word';
    wordSpan.dataset.word = card.dataset.word;

    // 간단하고 명확한 구조로 생성
    wordSpan.innerHTML = `
      <div class="word-content">
        <div class="hanzi">${card.dataset.word}</div>
        <div class="pinyin">${card.dataset.pinyin || ''}</div>
      </div>
    `;

    userSentence.appendChild(wordSpan);
  }

  // 문장 확인
  function checkSentence(e) {
    const exIndex = e.target.dataset.exampleIndex;
    const example = currentExamples[exIndex];
    const userSentence = document.querySelector(
      `.user-sentence[data-example-index="${exIndex}"]`
    );
    const chineseOriginal = document.querySelector(
      `.example-item:nth-child(${parseInt(exIndex) + 1}) .chinese-original`
    );

    // 구두점을 제외한 원문
    const originalTextNoMarks = example.chinese.replace(
      /[.,?!;，。？！；]/g,
      ''
    );

    // 사용자가 만든 문장
    let userText = '';
    userSentence.querySelectorAll('.sentence-word').forEach((word) => {
      userText += word.dataset.word;
    });

    if (userText === originalTextNoMarks) {
      alert('정답입니다! 👍');
      chineseOriginal.classList.remove('hidden');
      userSentence.classList.add('correct');
    } else {
      alert('다시 시도해보세요!');
    }
  }

  // 문장 리셋
  function resetSentence(e) {
    const exIndex = e.target.dataset.exampleIndex;
    const userSentence = document.querySelector(
      `.user-sentence[data-example-index="${exIndex}"]`
    );
    const chineseOriginal = document.querySelector(
      `.example-item:nth-child(${parseInt(exIndex) + 1}) .chinese-original`
    );
    const cards = document.querySelectorAll(
      `.vocab-card[data-example-index="${exIndex}"]`
    );

    // 사용자 문장 초기화
    userSentence.innerHTML = '';
    userSentence.classList.remove('correct');

    // 원문 숨기기
    chineseOriginal.classList.add('hidden');

    // 카드 선택 상태 초기화
    cards.forEach((card) => {
      card.classList.remove('selected');
    });
  }

  // 단어장 표시
  function displayVocabulary(date = '') {
    if (!vocabularyList) return;

    // 단어 가져오기
    const words = StorageManager.getWords();
    const emptyMessage = document.querySelector('.empty-message');

    // 날짜 옵션 갱신 (dateSelect가 있는 경우)
    if (dateSelect) {
      updateDateOptions(words);
    }

    // 날짜별 필터링
    const filteredWords = date
      ? words.filter((word) => word.date.startsWith(date))
      : words;

    // 목록 비우기
    vocabularyList.innerHTML = '';

    // 내용이 없으면 메시지 표시
    if (filteredWords.length === 0) {
      if (emptyMessage) {
        emptyMessage.style.display = 'block';
      } else {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'empty-message';
        emptyMsg.textContent = '저장된 단어가 없습니다.';
        vocabularyList.appendChild(emptyMsg);
      }
      return;
    }

    // 내용이 있으면 메시지 숨기기
    if (emptyMessage) {
      emptyMessage.style.display = 'none';
    }

    // 최신 순으로 정렬
    const sortedWords = [...filteredWords].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    sortedWords.forEach((wordData) => {
      const wordItem = document.createElement('div');
      wordItem.className = 'word-item';

      const wordHeader = document.createElement('div');
      wordHeader.className = 'word-header';

      const wordCharacter = document.createElement('h3');
      wordCharacter.className = 'word-character';
      wordCharacter.textContent = wordData.word;

      const wordPinyin = document.createElement('div');
      wordPinyin.className = 'word-pinyin';
      wordPinyin.textContent = wordData.pinyin;

      wordHeader.appendChild(wordCharacter);
      wordHeader.appendChild(wordPinyin);

      const wordMeaning = document.createElement('div');
      wordMeaning.className = 'word-meaning';
      wordMeaning.textContent = wordData.meaning;

      const wordDate = document.createElement('div');
      wordDate.className = 'word-date';
      wordDate.textContent = formatDate(wordData.date);

      const examplesToggle = document.createElement('button');
      examplesToggle.className = 'examples-toggle';
      examplesToggle.textContent = '예문 보기';
      examplesToggle.dataset.expanded = 'false';

      const examplesList = document.createElement('div');
      examplesList.className = 'examples-list hidden';

      // 예문 리스트 생성
      if (wordData.examples && wordData.examples.length > 0) {
        wordData.examples.forEach((example) => {
          const exampleItem = document.createElement('div');
          exampleItem.className = 'example-list-item';

          const chineseText = document.createElement('p');
          chineseText.className = 'chinese-text';
          chineseText.textContent = example.chinese;

          const koreanText = document.createElement('p');
          koreanText.className = 'korean-text';
          koreanText.textContent = example.korean;

          exampleItem.appendChild(chineseText);
          exampleItem.appendChild(koreanText);
          examplesList.appendChild(exampleItem);
        });
      } else {
        const noExamples = document.createElement('p');
        noExamples.className = 'no-examples';
        noExamples.textContent = '저장된 예문이 없습니다.';
        examplesList.appendChild(noExamples);
      }

      // 삭제 버튼
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-word';
      deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
      deleteBtn.title = '단어 삭제';
      deleteBtn.addEventListener('click', function () {
        if (confirm(`"${wordData.word}" 단어를 삭제하시겠습니까?`)) {
          StorageManager.deleteWord(wordData.id);
          displayVocabulary(date);
        }
      });

      // 예문 토글 이벤트
      examplesToggle.addEventListener('click', function () {
        const isExpanded = this.dataset.expanded === 'true';
        if (isExpanded) {
          examplesList.classList.add('hidden');
          this.textContent = '예문 보기';
          this.dataset.expanded = 'false';
        } else {
          examplesList.classList.remove('hidden');
          this.textContent = '예문 접기';
          this.dataset.expanded = 'true';
        }
      });

      // 아이템 조립
      wordItem.appendChild(wordHeader);
      wordItem.appendChild(wordMeaning);
      wordItem.appendChild(wordDate);
      wordItem.appendChild(examplesToggle);
      wordItem.appendChild(examplesList);
      wordItem.appendChild(deleteBtn);

      vocabularyList.appendChild(wordItem);
    });
  }

  // 날짜 옵션 업데이트
  function updateDateOptions(words) {
    if (!dateSelect) return;

    const currentValue = dateSelect.value;

    // 기존 옵션 제거 (첫 번째 옵션 제외)
    while (dateSelect.options.length > 1) {
      dateSelect.remove(1);
    }

    // 고유 날짜 추출 (YYYY-MM-DD 형식으로)
    const uniqueDates = [
      ...new Set(words.map((word) => word.date.split('T')[0])),
    ];

    // 날짜 정렬 (최신순)
    uniqueDates.sort((a, b) => new Date(b) - new Date(a));

    // 옵션 추가
    uniqueDates.forEach((date) => {
      const option = document.createElement('option');
      option.value = date;
      option.textContent = formatDate(date);
      dateSelect.appendChild(option);
    });

    // 이전 선택 값 복원 (가능한 경우)
    if (currentValue && uniqueDates.includes(currentValue)) {
      dateSelect.value = currentValue;
    }
  }

  // 날짜 포맷
  function formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 초기 단어장 로드
  displayVocabulary();
});
