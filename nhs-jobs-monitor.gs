/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║       NHS JOBS VACANCY MONITOR — Google Apps Script (RSS Edition)       ║
 * ║       Monitors 4 RSS feeds · Telegram alerts · 15-min trigger           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ── QUICK START ──────────────────────────────────────────────────────────────
 *
 *  1. Go to https://script.google.com → New project → paste this entire file.
 *
 *  2. Add your credentials:
 *       ⚙ Project Settings → Script Properties → Add property:
 *
 *       TELEGRAM_BOT_TOKEN   token from @BotFather  e.g. 7123456789:AAHxyz...
 *       TELEGRAM_CHAT_ID     your chat/group ID     e.g. -1001234567890
 *
 *  3. HOW TO GET TELEGRAM CREDENTIALS
 *       Bot token  : Message @BotFather on Telegram → /newbot → follow prompts
 *       Personal ID: Message @userinfobot → it replies with your ID
 *       Group ID   : Add @userinfobot to the group → it posts the group ID
 *
 *  4. Run  debugRSS()  first — confirm the feed returns XML (not 403).
 *
 *  5. Run  testTelegram()  to confirm bot messages arrive.
 *
 *  6. Run  setupTriggers()  once to create both time-based triggers.
 *
 *  7. Run  checkAllSearches()  once manually to baseline existing vacancies.
 *       First run records all current listings WITHOUT sending alerts.
 *
 * ── ADMIN FUNCTIONS ──────────────────────────────────────────────────────────
 *
 *  debugRSS()        — fetch feed 1, log raw XML (no alerts sent)
 *  testTelegram()    — send a test message to confirm bot works
 *  setupTriggers()   — (re)create 15-min + 7am triggers
 *  resetSeenIds()    — wipe stored IDs and start fresh
 */

// ─── RSS FEED URLS ────────────────────────────────────────────────────────────

var SEARCHES = [
  {
    name:  'Nursing & Midwifery',
    emoji: '🩺',
    url:   'https://www.jobs.nhs.uk/api/rss/search?staffGroup=NURSING_AND_MIDWIFERY_REGD&payBand=BAND_3,BAND_4&contractType=Permanent&sort=publicationDateDesc',
  },
  {
    name:  'Support Services',
    emoji: '🤝',
    url:   'https://www.jobs.nhs.uk/api/rss/search?staffGroup=CLINICAL_SERVICES&payBand=BAND_2,BAND_3,BAND_4&contractType=Permanent&sort=publicationDateDesc',
  },
  {
    name:  'Allied Health',
    emoji: '⚕️',
    url:   'https://www.jobs.nhs.uk/api/rss/search?staffGroup=ALLIED_HEALTH_PROF&payBand=BAND_3,BAND_4&contractType=Permanent&sort=publicationDateDesc',
  },
  {
    name:  'Emergency',
    emoji: '🚨',
    url:   'https://www.jobs.nhs.uk/api/rss/search?staffGroup=CLINICAL_SERVICES&keyword=emergency&payBand=BAND_3,BAND_4&contractType=Permanent&sort=publicationDateDesc',
  },
];

var SEEN_IDS_KEY     = 'seenVacancyIds';
var DAILY_COUNTS_KEY = 'dailyNewCounts';

var FETCH_OPTS = {
  muteHttpExceptions: true,
  headers: {
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept':          'application/rss+xml, application/xml, text/xml, */*;q=0.9',
    'Accept-Language': 'en-GB,en;q=0.9',
    'Referer':         'https://www.jobs.nhs.uk/',
  },
};

// ─── MAIN ENTRY POINT ─────────────────────────────────────────────────────────

function checkAllSearches() {
  var props      = PropertiesService.getScriptProperties();
  var seenIds    = loadSeenIds(props);
  var isFirstRun = seenIds.size === 0;

  var newById     = {};
  var dailyCounts = {};

  SEARCHES.forEach(function(search) {
    try {
      var vacancies = fetchRSS(search.url);
      Logger.log('[' + search.name + '] fetched ' + vacancies.length + ' items');

      var fresh = vacancies.filter(function(v) { return !seenIds.has(v.id); });
      vacancies.forEach(function(v) { seenIds.add(v.id); });

      if (!isFirstRun) {
        fresh.forEach(function(v) {
          if (!newById[v.id]) {
            newById[v.id] = Object.assign({}, v, {
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
      '✅ NHS Jobs Monitor is now active!\n\n' +
      'Baseline recorded across all 4 categories.\n' +
      'You will receive alerts as new vacancies appear.'
    );
    return;
  }

  var newVacancies = Object.values(newById);
  newVacancies.forEach(function(v) {
    sendVacancyAlert(v);
    Utilities.sleep(300);
  });

  accumulateDailyCounts(props, dailyCounts);
  Logger.log('Done. Alerted on ' + newVacancies.length + ' new vacancies.');
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
    '📊 NHS JOBS OVERNIGHT SUMMARY\n' +
    '📅 ' + today + '\n\n' +
    lines.join('\n') +
    '\n\n🔢 Total: ' + total + ' new vacancies'
  );

  props.deleteProperty(DAILY_COUNTS_KEY);
  Logger.log('Daily summary sent. Counter reset.');
}

// ─── RSS FETCH & PARSE ────────────────────────────────────────────────────────

function fetchRSS(url) {
  Logger.log('Fetching: ' + url);
  var res  = UrlFetchApp.fetch(url, FETCH_OPTS);
  var code = res.getResponseCode();

  if (code !== 200) {
    throw new Error('HTTP ' + code + ' from ' + url);
  }

  return parseRSS(res.getContentText());
}

function parseRSS(xmlText) {
  var vacancies = [];

  try {
    var doc     = XmlService.parse(xmlText);
    var root    = doc.getRootElement();
    var channel = root.getChild('channel');

    if (!channel) {
      Logger.log('No <channel> found. Snippet:\n' + xmlText.slice(0, 600));
      return vacancies;
    }

    var items = channel.getChildren('item');
    Logger.log('Parsed ' + items.length + ' <item> elements');

    items.forEach(function(item) {
      var v = extractItem(item);
      if (v) vacancies.push(v);
    });

  } catch (parseErr) {
    Logger.log('XmlService failed (' + parseErr.message + ') — falling back to regex parser');
    vacancies = parseRSSWithRegex(xmlText);
  }

  return vacancies;
}

function extractItem(item) {
  var title   = itemText(item, 'title');
  var link    = itemText(item, 'link');
  var desc    = itemText(item, 'description');
  var pubDate = itemText(item, 'pubDate');

  if (!link) return null;

  var plain = desc.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

  return {
    id:          link,
    title:       title || 'N/A',
    employer:    field(plain, [/employer[:\s]+([^\n|]+)/i, /organisation[:\s]+([^\n|]+)/i]),
    location:    field(plain, [/location[:\s]+([^\n|]+)/i, /town[:\s]+([^\n|]+)/i]),
    payBand:     field(plain, [/pay\s*band[:\s]+([^\n|]+)/i, /band\s+(\d[^\n|]*)/i, /salary[:\s]+([^\n|]+)/i]),
    closingDate: field(plain, [/closing\s*date[:\s]+([^\n|]+)/i, /closes?[:\s]+([^\n|]+)/i, /deadline[:\s]+([^\n|]+)/i]),
    directUrl:   link,
    pubDate:     pubDate,
    rawDesc:     plain,
  };
}

function itemText(item, tag) {
  var el = item.getChild(tag);
  return el ? el.getText().trim() : '';
}

function parseRSSWithRegex(xmlText) {
  var vacancies = [];
  var blocks    = xmlText.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];

  blocks.forEach(function(block) {
    var title   = cdataOrTag(block, 'title');
    var link    = cdataOrTag(block, 'link');
    var desc    = cdataOrTag(block, 'description');
    var pubDate = cdataOrTag(block, 'pubDate');

    if (!link) return;

    var plain = desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    vacancies.push({
      id:          link,
      title:       title || 'N/A',
      employer:    field(plain, [/employer[:\s]+([^\n|]+)/i]),
      location:    field(plain, [/location[:\s]+([^\n|]+)/i]),
      payBand:     field(plain, [/pay\s*band[:\s]+([^\n|]+)/i, /band\s+(\d[^\n|]*)/i]),
      closingDate: field(plain, [/closing\s*date[:\s]+([^\n|]+)/i, /closes?[:\s]+([^\n|]+)/i]),
      directUrl:   link,
      pubDate:     pubDate,
      rawDesc:     plain,
    });
  });

  return vacancies;
}

function cdataOrTag(xml, tag) {
  var re = new RegExp('<' + tag + '>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/' + tag + '>', 'i');
  var m  = xml.match(re);
  if (!m) return '';
  return (m[1] !== undefined ? m[1] : m[2] || '').trim();
}

function field(text, patterns) {
  for (var i = 0; i < patterns.length; i++) {
    var m = text.match(patterns[i]);
    if (m && m[1]) return m[1].replace(/\s+/g, ' ').trim();
  }
  return 'N/A';
}

// ─── TELEGRAM ─────────────────────────────────────────────────────────────────

function sendVacancyAlert(v) {
  sendTelegramMessage(
    '🏥 NEW NHS VACANCY\n' +
    '📋 ' + v.title       + '\n' +
    '🏢 ' + v.employer    + '\n' +
    '📍 ' + v.location    + '\n' +
    '💰 ' + v.payBand     + '\n' +
    '📅 Closes: ' + v.closingDate + '\n' +
    '🔗 ' + v.directUrl
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

// ─── ADMIN / DEBUG ────────────────────────────────────────────────────────────

/**
 * Run this FIRST before anything else.
 * Fetches the Nursing RSS feed and logs the raw response.
 * If you see XML content → feed works, proceed to checkAllSearches().
 * If you see 403 → paste the response here for next steps.
 */
function debugRSS() {
  var url = SEARCHES[0].url;
  Logger.log('Fetching: ' + url);
  var res = UrlFetchApp.fetch(url, FETCH_OPTS);
  Logger.log('HTTP status: ' + res.getResponseCode());
  Logger.log('Response (first 2 000 chars):\n' + res.getContentText().slice(0, 2000));
}

function testTelegram() {
  sendTelegramMessage('✅ NHS Jobs Monitor — Telegram connection confirmed!');
  Logger.log('Test message sent.');
}

function resetSeenIds() {
  PropertiesService.getScriptProperties().deleteProperty(SEEN_IDS_KEY);
  Logger.log('Seen IDs cleared. Next checkAllSearches() will baseline without sending alerts.');
}
