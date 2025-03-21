// CORS 헤더 설정
app.use((req, res, next) => {
  res.setHeader(
    'Access-Control-Allow-Origin',
    'https://funny-tartufo-4b975f.netlify.app'
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // OPTIONS 요청(preflight)에 대한 처리
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});
