// 로컬 스토리지에 단어 저장 관리
const StorageManager = {
  // 모든 단어 가져오기
  getAllWords: function () {
    const words = localStorage.getItem('jindam-words');
    return words ? JSON.parse(words) : [];
  },

  // 모든 단어 가져오기 (새 코드와의 호환성)
  getWords: function () {
    const words = this.getAllWords();

    // 기존 데이터에 date 필드가 없으면 createdAt으로 대체
    return words.map((word) => ({
      ...word,
      date: word.date || word.createdAt || new Date().toISOString(),
      id: word.id || Date.now().toString(),
    }));
  },

  // 특정 날짜의 단어 가져오기
  getWordsByDate: function (date) {
    const words = this.getAllWords();
    if (!date) return words;

    const dateStr = new Date(date).toDateString();
    return words.filter(
      (word) => new Date(word.createdAt).toDateString() === dateStr
    );
  },

  // 새 단어 저장하기
  saveWord: function (wordData) {
    const words = this.getAllWords();
    const newWord = {
      ...wordData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      date: new Date().toISOString(),
    };

    words.push(newWord);
    localStorage.setItem('jindam-words', JSON.stringify(words));
    return newWord;
  },

  // 단어 삭제하기
  deleteWord: function (id) {
    let words = this.getAllWords();
    words = words.filter((word) => word.id !== id);
    localStorage.setItem('jindam-words', JSON.stringify(words));
    return true;
  },
};
