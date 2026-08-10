const URL =
  'https://www.healthjobsuk.com/job_list?JobSearch_g=303&JobSearch_re=_POST' +
  '&JobSearch_re_0=1&JobSearch_Submit=Search&_tr=JobSearch&_ts=344314';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  Referer: 'https://www.healthjobsuk.com/',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'max-age=0',
};

(async () => {
  console.log('Probing:', URL);
  try {
    const res = await fetch(URL, { headers: HEADERS });
    const body = await res.text();
    console.log('HTTP status :', res.status, res.statusText);
    console.log('Content-Type:', res.headers.get('content-type'));
    console.log('Body length :', body.length, 'chars');
    console.log('\n--- First 500 chars ---\n' + body.slice(0, 500));
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
})();
