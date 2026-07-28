/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║     NHS VACANCY MONITOR — Google Apps Script (HealthJobsUK Scraper)     ║
 * ║     Scrapes 4 search pages · Telegram alerts · 15-min trigger           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ── QUICK START ──────────────────────────────────────────────────────────────
 *
 *  1. Paste this entire file into script.google.com (replace all existing code).
 *
 *  2. ⚙ Project Settings → Script Properties → Add:
 *       TELEGRAM_BOT_TOKEN   e.g. 7123456789:AAHxyz...
 *       TELEGRAM_CHAT_ID     e.g. -1001234567890
 *
 *  3. Run  debugScrape()  first — confirms the site is reachable and logs
 *       raw HTML so you can verify the parsing patterns are correct.
 *
 *  4. Run  testTelegram()  to confirm bot messages arrive.
 *
 *  5. Run  setupTriggers()  to create the 15-min + 7am triggers.
 *
 *  6. Run  checkAllSearches()  once to baseline existing vacancies
 *       (first run records all current jobs WITHOUT sending alerts).
 *
 * ── ADMIN FUNCTIONS ──────────────────────────────────────────────────────────
 *
 *  debugScrape()     — fetch page 1, log raw HTML + parsed jobs (no alerts)
 *  testTelegram()    — send test message
 *  setupTriggers()   — (re)create triggers
 *  resetSeenIds()    — wipe stored IDs and start fresh
 */

// ─── SEARCH URLS ─────────────────────────────────────────────────────────────

var SEARCHES = [
  {
    name:  'Nursing & Midwifery',
    emoji: '🩺',
    url:   'https://www.healthjobsuk.com/job_list?JobSearch_g=303&JobSearch_re=_POST&JobSearch_re_0=1&JobSearch_re_1=1-_-_-&JobSearch_re_2=1-_-_--_-_-&JobSearch_Submit=Search&_tr=JobSearch&_ts=340737',
  },
  {
    name:  'Support Services',
    emoji: '🤝',
    url:   'https://www.healthjobsuk.com/job_list?JobSearch_g=303&JobSearch_re=_POST&JobSearch_re_0=1&JobSearch_re_1=1-_-_-&JobSearch_re_2=1-_-_--_-_-&JobSearch_Submit=Search&_tr=JobSearch&_ts=344314',
  },
  {
    name:  'Allied Health',
    emoji: '⚕️',
    url:   'https://www.healthjobsuk.com/job_list?JobSearch_g=303&JobSearch_re=_POST&JobSearch_re_0=1&JobSearch_re_1=1-_-_-&JobSearch_re_2=1-_-_--_-_-&JobSearch_Submit=Search&_tr=JobSearch&_ts=349040',
  },
  {
    name:  'Emergency',
    emoji: '🚨',
    url:   'https://www.healthjobsuk.com/job_list?JobSearch_g=303&JobSearch_re=_POST&JobSearch_re_0=1&JobSearch_re_1=1-_-_-&JobSearch_re_2=1-_-_--_-_-&JobSearch_Submit=Search&_tr=JobSearch&_ts=351099',
  },
];

var SEEN_IDS_KEY     = 'seenVacancyIds';
var DAILY_COUNTS_KEY = 'dailyNewCounts';

var FETCH_OPTS = {
  muteHttpExceptions: true,
  headers: {
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept':          'text/html,application/xhtml+xml,*/*;q=0.9',
    'Accept-Language': 'en-GB,en;q=0.9',
    'Referer':         'https://www.healthjobsuk.com/',
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
      var jobs = fetchJobs(search.url);
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

// ─── SCRAPING ──────────────────────────────────────────────────────────────────

function fetchJobs(url) {
  var res  = UrlFetchApp.fetch(url, FETCH_OPTS);
  var code = res.getResponseCode();
  if (code !== 200) throw new Error('HTTP ' + code);
  return scrapeJobs(res.getContentText());
}

function scrapeJobs(html) {
  var jobs = [];
  var seen = {};

  var anchorRe = /<a\s[^>]*href="(https?:\/\/(?:www\.)?healthjobsuk\.com\/job\/[^"#?]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  var m;

  while ((m = anchorRe.exec(html)) !== null) {
    var url   = m[1];
    var title = stripTags(m[2]).trim();

    if (!title || title.length < 4 || seen[url]) continue;
    seen[url] = true;

    var ctxRaw = html.slice(m.index, Math.min(html.length, m.index + 1000));
    var ctx    = stripTags(ctxRaw).replace(/\s+/g, ' ').trim();

    jobs.push({
      id:       url,
      title:    title,
      employer: extractField(ctx, [
        /(?:employer|organisation|trust)[:\s]+([^|•·\n]{3,60})/i,
        /(?:nhs|foundation|hospital|trust|community|council)\s[^|•·\n]{3,50}/i,
      ]),
      location: extractField(ctx, [
        /(?:location|town|city|county)[:\s]+([^|•·\n]{2,50})/i,
      ]),
      band: extractField(ctx, [
        /(Band\s+\d[A-Za-z]?(?:\s*[–\-]\s*Band\s*\d[A-Za-z]?)?)/i,
        /(?:salary|pay)[:\s]+([£][^|•·\n]{3,50})/i,
        /([£][\d,]+\s*[-–]\s*[£][\d,]+[^|•·\n]{0,30})/,
      ]),
      url: url,
    });
  }

  return jobs;
}

function stripTags(str) {
  return str
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ');
}

function extractField(text, patterns) {
  for (var i = 0; i < patterns.length; i++) {
    var m = text.match(patterns[i]);
    if (m) {
      var val = (m[1] || m[0]).replace(/\s+/g, ' ').trim();
      if (val.length >= 2) return val;
    }
  }
  return 'N/A';
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

// ─── ADMIN / DEBUG ────────────────────────────────────────────────────────────

function debugScrape() {
  var url = SEARCHES[0].url;
  Logger.log('Fetching: ' + url);

  var res  = UrlFetchApp.fetch(url, FETCH_OPTS);
  var code = res.getResponseCode();
  var html = res.getContentText();

  Logger.log('HTTP status: ' + code);
  Logger.log('Page length: ' + html.length + ' chars');
  Logger.log('\n── Raw HTML (first 3 000 chars) ──────────────────────────────\n' + html.slice(0, 3000));

  if (code !== 200) return;

  var jobs = scrapeJobs(html);
  Logger.log('\n── Parsed ' + jobs.length + ' jobs. First 5: ──────────────────────────────');
  jobs.slice(0, 5).forEach(function(j, i) {
    Logger.log(
      '\n[' + (i + 1) + '] ' + j.title +
      '\n    Employer : ' + j.employer +
      '\n    Location : ' + j.location +
      '\n    Band     : ' + j.band +
      '\n    URL      : ' + j.url
    );
  });

  if (jobs.length === 0) {
    Logger.log('\nNo jobs found — site may require JavaScript or HTML structure differs.');
    Logger.log('Check raw HTML above for anchor tags containing "/job/".');
  }
}

function testTelegram() {
  sendTelegramMessage('✅ NHS Vacancy Monitor — Telegram connection confirmed!');
  Logger.log('Test message sent.');
}

function resetSeenIds() {
  PropertiesService.getScriptProperties().deleteProperty(SEEN_IDS_KEY);
  Logger.log('Seen IDs cleared. Next checkAllSearches() will baseline without sending alerts.');
}
