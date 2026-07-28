/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║     NHS VACANCY MONITOR — Google Apps Script (trac.jobs Feed Edition)   ║
 * ║     4 categories · Telegram alerts · 15-min trigger                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ── QUICK START ──────────────────────────────────────────────────────────────
 *
 *  1. Paste this file into script.google.com (replace all existing code).
 *
 *  2. ⚙ Project Settings → Script Properties → Add:
 *       TELEGRAM_BOT_TOKEN   e.g. 7123456789:AAHxyz...
 *       TELEGRAM_CHAT_ID     e.g. -1001234567890
 *
 *  3. Run  debugFeed()  FIRST — tries 3 candidate API endpoints and logs
 *       the HTTP status + first 2 000 chars of each response. Paste the
 *       output here so the correct endpoint + parser can be confirmed.
 *
 *  4. Once the working endpoint is confirmed, run  testTelegram()  then
 *       setupTriggers()  then  checkAllSearches()  (baselines existing jobs).
 *
 * ── ADMIN FUNCTIONS ──────────────────────────────────────────────────────────
 *
 *  debugFeed()       — probe 3 API endpoints, log responses (no alerts)
 *  testTelegram()    — send test Telegram message
 *  setupTriggers()   — (re)create 15-min + 7am triggers
 *  resetSeenIds()    — wipe stored IDs and start fresh
 */

// ─── CATEGORY _ts CODES ─────────────────────────────────────────────────────────────

var SEARCHES = [
  { name: 'Nursing & Midwifery', emoji: '🩺', ts: '340737' },
  { name: 'Support Services',    emoji: '🤝', ts: '344314' },
  { name: 'Allied Health',       emoji: '⚕️', ts: '349040' },
  { name: 'Emergency',           emoji: '🚨', ts: '351099' },
];

// Candidate feed URL templates — {TS} is replaced with the category code.
// debugFeed() probes all three; once one works the FEED_TEMPLATE constant
// below should be updated to the working URL.
var FEED_CANDIDATES = [
  'https://feeds.trac.jobs/jobs/search?ts={TS}&format=json',
  'https://feeds.trac.jobs/jobs/search?ts={TS}',
  'https://www.healthjobsuk.com/api/jobs?_ts={TS}',
];

// ← UPDATE THIS after debugFeed() confirms which URL works.
// Use the exact template string from FEED_CANDIDATES that returned 200 + data.
var FEED_TEMPLATE = 'https://feeds.trac.jobs/jobs/search?ts={TS}&format=json';

var SEEN_IDS_KEY     = 'seenVacancyIds';
var DAILY_COUNTS_KEY = 'dailyNewCounts';

var FETCH_OPTS = {
  muteHttpExceptions: true,
  headers: {
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept':          'application/json, application/xml, text/xml, text/html, */*',
    'Accept-Language': 'en-GB,en;q=0.9',
    'Referer':         'https://www.healthjobsuk.com/',
  },
};

// ─── DEBUG: PROBE ALL CANDIDATE ENDPOINTS ────────────────────────────────────────────

/**
 * Run this FIRST — before anything else.
 *
 * Tries every URL in FEED_CANDIDATES using the Support Services ts=344314.
 * For each one logs:
 *   • HTTP status code
 *   • Content-Type header
 *   • First 2 000 chars of the response body
 *
 * Paste the full output here so the correct endpoint and parser can be set up.
 */
function debugFeed() {
  var testTs = '344314'; // Support Services

  FEED_CANDIDATES.forEach(function(template, i) {
    var url = template.replace('{TS}', testTs);
    Logger.log('\n══════════════════════════════════════════════');
    Logger.log('Candidate ' + (i + 1) + ': ' + url);
    Logger.log('══════════════════════════════════════════════');

    try {
      var res         = UrlFetchApp.fetch(url, FETCH_OPTS);
      var code        = res.getResponseCode();
      var body        = res.getContentText();
      var contentType = res.getHeaders()['Content-Type'] || res.getHeaders()['content-type'] || 'unknown';

      Logger.log('HTTP status  : ' + code);
      Logger.log('Content-Type : ' + contentType);
      Logger.log('Body length  : ' + body.length + ' chars');
      Logger.log('Body (first 2 000 chars):\n' + body.slice(0, 2000));

      if (code === 200 && body.length > 100) {
        Logger.log('✅ This endpoint returned data — likely the one to use.');
      } else {
        Logger.log('❌ Empty or error response.');
      }
    } catch (e) {
      Logger.log('ERROR fetching: ' + e.message);
    }
  });

  Logger.log('\n══════════════════════════════════════════════');
  Logger.log('Done. Paste the full log above so the correct endpoint and parser can be confirmed.');
}

// ─── MAIN ENTRY POINT ─────────────────────────────────────────────────────────

function checkAllSearches() {
  var props      = PropertiesService.getScriptProperties();
  var seenIds    = loadSeenIds(props);
  var isFirstRun = seenIds.size === 0;

  var newById     = {};
  var dailyCounts = {};

  SEARCHES.forEach(function(search) {
    try {
      var jobs = fetchJobs(search.ts);
      Logger.log('[' + search.name + '] found ' + jobs.length + ' listings');

      var fresh = jobs.filter(function(j) { return !seenIds.has(j.id); });
      jobs.forEach(function(j) { seenIds.add(j.id); });

      if (!isFirstRun) {
        fresh.forEach(function(j) {
          if (!newById[j.id]) {
            newById[j.id] = Object.assign({}, j, {
              searchName:  search.name,
              searchEmoji: search.emoji,
            });
          }
        });
      }

      dailyCounts[search.name] = (dailyCounts[search.name] || 0) + fresh.length;
      Logger.log('[' + search.name + '] ' + fresh.length + ' new');

    } catch (err) {
      Logger.log('[' + search.name + '] ERROR: ' + err.message);
    }
  });

  saveSeenIds(props, seenIds);

  if (isFirstRun) {
    Logger.log('First run — baseline recorded. No alerts sent.');
    sendTelegramMessage(
      '✅ NHS Vacancy Monitor is now active!\n\n' +
      'Baseline recorded across all 4 categories.\n' +
      'You will receive alerts as new vacancies appear.'
    );
    return;
  }

  var newJobs = Object.values(newById);
  newJobs.forEach(function(j) {
    sendVacancyAlert(j);
    Utilities.sleep(300);
  });

  accumulateDailyCounts(props, dailyCounts);
  Logger.log('Done. Alerted on ' + newJobs.length + ' new vacancies.');
}

// ─── DAILY SUMMARY (7 am trigger) ────────────────────────────────────────────

function sendDailySummary() {
  var props  = PropertiesService.getScriptProperties();
  var raw    = props.getProperty(DAILY_COUNTS_KEY);
  var counts = raw ? JSON.parse(raw) : {};

  var lines = SEARCHES.map(function(s) {
    return s.emoji + ' ' + s.name + ': ' + (counts[s.name] || 0) + ' new';
  });

  var total = Object.values(counts).reduce(function(a, b) { return a + b; }, 0);
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'EEE d MMM yyyy');

  sendTelegramMessage(
    '📊 NHS VACANCY OVERNIGHT SUMMARY\n' +
    '📅 ' + today + '\n\n' +
    lines.join('\n') +
    '\n\n🔢 Total: ' + total + ' new vacancies'
  );

  props.deleteProperty(DAILY_COUNTS_KEY);
  Logger.log('Daily summary sent. Counter reset.');
}

// ─── FEED FETCH & PARSE ────────────────────────────────────────────────────────────

function fetchJobs(ts) {
  var url = FEED_TEMPLATE.replace('{TS}', ts);
  var res = UrlFetchApp.fetch(url, FETCH_OPTS);
  var code = res.getResponseCode();
  if (code !== 200) throw new Error('HTTP ' + code + ' from ' + url);

  var body = res.getContentText();
  var contentType = (res.getHeaders()['Content-Type'] || res.getHeaders()['content-type'] || '').toLowerCase();

  // Try JSON first, fall back to XML/HTML parsing
  if (contentType.indexOf('json') !== -1 || body.trim().charAt(0) === '[' || body.trim().charAt(0) === '{') {
    return parseJobsJSON(body, ts);
  }
  if (contentType.indexOf('xml') !== -1 || body.trim().charAt(0) === '<') {
    return parseJobsXML(body, ts);
  }

  // Unknown format — log and return empty
  Logger.log('Unknown response format for ts=' + ts + '. Content-Type: ' + contentType);
  Logger.log('Body snippet: ' + body.slice(0, 500));
  return [];
}

// ── JSON parser ───────────────────────────────────────────────────────────────────────

function parseJobsJSON(body, ts) {
  var jobs = [];
  var data;

  try { data = JSON.parse(body); } catch (e) {
    Logger.log('JSON parse error: ' + e.message);
    return jobs;
  }

  // Normalise: data may be an array or an object with a jobs/results/items key
  var items = [];
  if (Array.isArray(data)) {
    items = data;
  } else {
    var keys = ['jobs', 'results', 'items', 'vacancies', 'data'];
    for (var i = 0; i < keys.length; i++) {
      if (Array.isArray(data[keys[i]])) { items = data[keys[i]]; break; }
    }
  }

  if (items.length === 0) {
    Logger.log('JSON parsed but no item array found. Keys: ' + Object.keys(data).join(', '));
    Logger.log('Full response: ' + body.slice(0, 1000));
    return jobs;
  }

  items.forEach(function(item) {
    var id = str(item.id || item.jobId || item.vacancy_id || item.ref || item.reference || '');
    if (!id) return;

    var url = str(item.url || item.link || item.apply_url || item.job_url || '');
    if (!url) url = 'https://www.healthjobsuk.com/job/' + id;

    jobs.push({
      id:       url, // use URL as stable dedup key
      title:    str(item.title || item.job_title || item.jobTitle || item.name || 'N/A'),
      employer: str(item.employer || item.organisation || item.organization || item.trust || item.company || 'N/A'),
      location: str(item.location || item.town || item.city || item.region || 'N/A'),
      band:     str(item.band || item.pay_band || item.payBand || item.salary || item.salary_range || 'N/A'),
      url:      url,
    });
  });

  return jobs;
}

// ── XML parser (RSS / Atom fallback) ─────────────────────────────────────────────────

function parseJobsXML(body, ts) {
  var jobs = [];

  try {
    var doc     = XmlService.parse(body);
    var root    = doc.getRootElement();
    var channel = root.getChild('channel') || root;
    var items   = channel.getChildren('item');

    if (!items || items.length === 0) {
      // Try <job> or <vacancy> elements
      items = root.getChildren('job') || root.getChildren('vacancy') || [];
    }

    Logger.log('XML: found ' + items.length + ' elements');

    items.forEach(function(item) {
      var link  = xmlText(item, ['link', 'url', 'job_url']);
      var title = xmlText(item, ['title', 'job_title', 'name']);
      if (!link && !title) return;

      var id = link || ('ts-' + ts + '-' + xmlText(item, ['id', 'ref', 'guid']));

      jobs.push({
        id:       id,
        title:    title || 'N/A',
        employer: xmlText(item, ['employer', 'organisation', 'trust', 'company']) || 'N/A',
        location: xmlText(item, ['location', 'town', 'city', 'region'])           || 'N/A',
        band:     xmlText(item, ['band', 'pay_band', 'salary', 'salary_range'])   || 'N/A',
        url:      link || 'https://www.healthjobsuk.com/job_list?_ts=' + ts,
      });
    });
  } catch (e) {
    Logger.log('XML parse error: ' + e.message + '\nSnippet: ' + body.slice(0, 500));
  }

  return jobs;
}

function xmlText(el, names) {
  for (var i = 0; i < names.length; i++) {
    var child = el.getChild(names[i]);
    if (child) {
      var t = child.getText().trim();
      if (t) return t;
    }
  }
  return '';
}

function str(v) {
  return (v === null || v === undefined) ? '' : String(v).trim();
}

// ─── TELEGRAM ─────────────────────────────────────────────────────────────────

function sendVacancyAlert(j) {
  sendTelegramMessage(
    '🏥 NEW NHS VACANCY\n' +
    '📋 ' + j.title    + '\n' +
    '🏢 ' + j.employer + '\n' +
    '📍 ' + j.location + '\n' +
    '💰 ' + j.band     + '\n' +
    '🔗 ' + j.url
  );
}

function sendTelegramMessage(text) {
  var props  = PropertiesService.getScriptProperties();
  var token  = props.getProperty('TELEGRAM_BOT_TOKEN');
  var chatId = props.getProperty('TELEGRAM_CHAT_ID');

  if (!token || !chatId) {
    Logger.log('Telegram credentials missing — add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to Script Properties.');
    return;
  }

  try {
    var res    = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method:             'post',
      contentType:        'application/json',
      payload:            JSON.stringify({ chat_id: chatId, text: text, disable_web_page_preview: false }),
      muteHttpExceptions: true,
    });
    var result = JSON.parse(res.getContentText());
    if (!result.ok) Logger.log('Telegram error: ' + result.description);
  } catch (e) {
    Logger.log('Telegram send failed: ' + e.message);
  }
}

// ─── TRIGGER SETUP ────────────────────────────────────────────────────────────

function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('checkAllSearches').timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger('sendDailySummary').timeBased().atHour(7).everyDays(1).create();
  Logger.log('✅ Triggers created: every 15 min + daily 7 am.');
}

// ─── STORAGE HELPERS ──────────────────────────────────────────────────────────

function loadSeenIds(props) {
  var raw = props.getProperty(SEEN_IDS_KEY);
  return new Set(raw ? JSON.parse(raw) : []);
}

function saveSeenIds(props, seenSet) {
  var arr = Array.from(seenSet);
  if (JSON.stringify(arr).length > 8000) arr = arr.slice(-2000);
  props.setProperty(SEEN_IDS_KEY, JSON.stringify(arr));
}

function accumulateDailyCounts(props, newCounts) {
  var raw      = props.getProperty(DAILY_COUNTS_KEY);
  var existing = raw ? JSON.parse(raw) : {};
  Object.keys(newCounts).forEach(function(name) {
    existing[name] = (existing[name] || 0) + newCounts[name];
  });
  props.setProperty(DAILY_COUNTS_KEY, JSON.stringify(existing));
}

// ─── ADMIN ───────────────────────────────────────────────────────────────────────────

function testTelegram() {
  sendTelegramMessage('✅ NHS Vacancy Monitor — Telegram connection confirmed!');
  Logger.log('Test message sent.');
}

function resetSeenIds() {
  PropertiesService.getScriptProperties().deleteProperty(SEEN_IDS_KEY);
  Logger.log('Seen IDs cleared. Next checkAllSearches() will baseline without sending alerts.');
}
