/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║          NHS JOBS VACANCY MONITOR — Google Apps Script                  ║
 * ║          Monitors 4 search categories · Telegram alerts · 15-min        ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ── QUICK START ──────────────────────────────────────────────────────────────
 *
 *  1. Go to https://script.google.com → New project → paste this entire file.
 *
 *  2. Add your credentials:
 *       Extensions → Apps Script → (gear icon) Project Settings
 *       → Script Properties → Add property:
 *
 *       TELEGRAM_BOT_TOKEN   your bot token from @BotFather
 *                            e.g.  7123456789:AAHxyz...
 *       TELEGRAM_CHAT_ID     your personal or group chat ID
 *                            e.g.  -1001234567890   (groups are negative)
 *
 *  3. HOW TO GET TELEGRAM CREDENTIALS
 *       Bot token  : Message @BotFather → /newbot → follow prompts
 *       Personal ID: Message @userinfobot — it replies with your ID
 *       Group ID   : Add @userinfobot to the group → it posts the group ID
 *                    OR forward any group message to @userinfobot
 *
 *  4. Run  setupTriggers()  once:
 *       Editor toolbar → Run → setupTriggers
 *       Authorise when prompted (internet + properties access needed).
 *       This creates:
 *         • A 15-minute trigger  →  checkAllSearches()
 *         • A daily 7 am trigger →  sendDailySummary()
 *
 *  5. Run  checkAllSearches()  once manually to baseline existing vacancies.
 *       This first run records all current vacancies WITHOUT sending alerts,
 *       so you only receive alerts for genuinely new postings going forward.
 *
 *  6. Run  testTelegram()  to confirm your bot can send messages.
 *
 * ── USEFUL ADMIN FUNCTIONS ───────────────────────────────────────────────────
 *
 *  resetSeenIds()    — wipe the stored vacancy list and start fresh
 *  debugFirstSearch()— logs the raw XML from Search 1 so you can inspect it
 *  testTelegram()    — sends a test message to your chat
 *  setupTriggers()   — (re)creates both time-based triggers
 *
 * ── NOTES ────────────────────────────────────────────────────────────────────
 *
 *  • All seen vacancy IDs are stored in Script Properties (free, persistent).
 *  • If the stored list grows beyond ~8 KB the oldest IDs are trimmed to keep
 *    the newest 2 000 — enough for months of normal use.
 *  • The daily summary resets its counter each morning after sending.
 *  • Telegram rate limit: 30 messages/second per bot. The script sleeps 300 ms
 *    between alerts, so bursts of up to ~100 vacancies are fine.
 */

// ─── SEARCH CONFIGURATIONS ────────────────────────────────────────────────────

var SEARCHES = [
  {
    name: 'Nursing & Midwifery',
    emoji: '🩺',
    params: {
      staffGroup:   'NURSING_AND_MIDWIFERY_REGD',
      payBand:      'BAND_3,BAND_4',
      contractType: 'Permanent',
      sort:         'publicationDateDesc',
    },
  },
  {
    name: 'Support Services',
    emoji: '🤝',
    params: {
      staffGroup:   'CLINICAL_SERVICES',
      payBand:      'BAND_2,BAND_3,BAND_4',
      contractType: 'Permanent',
      sort:         'publicationDateDesc',
    },
  },
  {
    name: 'Allied Health',
    emoji: '⚕️',
    params: {
      staffGroup:   'ALLIED_HEALTH_PROF',
      payBand:      'BAND_3,BAND_4',
      contractType: 'Permanent',
      sort:         'publicationDateDesc',
    },
  },
  {
    name: 'Emergency',
    emoji: '🚨',
    params: {
      staffGroup:   'CLINICAL_SERVICES',
      keyword:      'emergency',
      payBand:      'BAND_3,BAND_4',
      contractType: 'Permanent',
      sort:         'publicationDateDesc',
    },
  },
];

var API_BASE         = 'https://www.jobs.nhs.uk/api/v1/search_xml';
var VACANCY_BASE_URL = 'https://www.jobs.nhs.uk/candidate/jobadvert/';
var SEEN_IDS_KEY     = 'seenVacancyIds';
var DAILY_COUNTS_KEY = 'dailyNewCounts';

// ─── MAIN ENTRY POINT (runs every 15 minutes via trigger) ────────────────────

function checkAllSearches() {
  // ── API reachability probe ──────────────────────────────────────────────────
  try {
    var probe = UrlFetchApp.fetch(
      buildUrl(API_BASE, { sort: 'publicationDateDesc', pageSize: '1' }),
      { muteHttpExceptions: true, headers: { Accept: 'application/xml, text/xml, */*' } }
    );
    var probeCode = probe.getResponseCode();
    Logger.log('API reachability check: HTTP ' + probeCode);
    if (probeCode !== 200) {
      Logger.log('API not reachable — aborting. Response:\n' + probe.getContentText().slice(0, 500));
      return;
    }
  } catch (probeErr) {
    Logger.log('API reachability check FAILED: ' + probeErr.message);
    return;
  }
  // ───────────────────────────────────────────────────────────────────────────

  var props    = PropertiesService.getScriptProperties();
  var seenIds  = loadSeenIds(props);
  var isFirstRun = seenIds.size === 0;

  // We use an object keyed by vacancy ID to deduplicate across all 4 searches
  var newById    = {};
  var dailyCounts = {};

  SEARCHES.forEach(function(search) {
    try {
      var vacancies = fetchVacancies(search.params);
      Logger.log('[' + search.name + '] fetched ' + vacancies.length + ' vacancies');

      var fresh = vacancies.filter(function(v) { return !seenIds.has(v.id); });

      // Mark everything seen (new and existing)
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
    Logger.log('First run complete — baseline recorded. No alerts sent.');
    sendTelegramMessage(
      '✅ NHS Jobs Monitor is now active!\n\n' +
      'Baseline recorded across all 4 search categories.\n' +
      'You will receive alerts as new vacancies appear.'
    );
    return;
  }

  var newVacancies = Object.values(newById);
  newVacancies.forEach(function(v) {
    sendVacancyAlert(v);
    Utilities.sleep(300); // respect Telegram rate limit
  });

  accumulateDailyCounts(props, dailyCounts);
  Logger.log('Done. Alerted on ' + newVacancies.length + ' new vacancies.');
}

// ─── DAILY SUMMARY (runs at 7 am every day via trigger) ──────────────────────

function sendDailySummary() {
  var props  = PropertiesService.getScriptProperties();
  var raw    = props.getProperty(DAILY_COUNTS_KEY);
  var counts = raw ? JSON.parse(raw) : {};

  var lines = SEARCHES.map(function(s) {
    var n = counts[s.name] || 0;
    return s.emoji + ' ' + s.name + ': ' + n + ' new';
  });

  var total = Object.values(counts).reduce(function(a, b) { return a + b; }, 0);
  var today = Utilities.formatDate(
    new Date(), Session.getScriptTimeZone(), 'EEE d MMM yyyy'
  );

  var msg =
    '📊 NHS JOBS OVERNIGHT SUMMARY\n' +
    '📅 ' + today + '\n\n' +
    lines.join('\n') +
    '\n\n🔢 Total new vacancies overnight: ' + total;

  sendTelegramMessage(msg);

  // Reset counter ready for the next 24 hours
  props.deleteProperty(DAILY_COUNTS_KEY);
  Logger.log('Daily summary sent. Counter reset.');
}

// ─── XML FETCH & PARSE ────────────────────────────────────────────────────────

function fetchVacancies(params) {
  var url = buildUrl(API_BASE, params);
  Logger.log('Fetching: ' + url);

  var response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: { Accept: 'application/xml, text/xml, */*' },
  });

  var code = response.getResponseCode();
  if (code !== 200) {
    throw new Error('HTTP ' + code + ': ' + response.getContentText().slice(0, 200));
  }

  return parseXmlResponse(response.getContentText());
}

function parseXmlResponse(xmlText) {
  var vacancies = [];

  try {
    var doc  = XmlService.parse(xmlText);
    var root = doc.getRootElement();

    // Walk down one level if the root is a wrapper element (e.g. <jobs><channel>)
    var items = findVacancyElements(root);

    if (items.length === 0) {
      Logger.log(
        'WARNING: no vacancy elements found. Raw XML (first 1 000 chars):\n' +
        xmlText.slice(0, 1000)
      );
      return vacancies;
    }

    items.forEach(function(el) {
      var v = extractVacancy(el);
      if (v) vacancies.push(v);
    });
  } catch (e) {
    Logger.log('XML parse error: ' + e.message);
    Logger.log('Raw response (first 1 000 chars):\n' + xmlText.slice(0, 1000));
    throw e;
  }

  return vacancies;
}

/**
 * Searches the XML tree (up to 2 levels deep) for elements whose local name
 * matches any of the known vacancy element names.
 */
function findVacancyElements(root) {
  var knownNames = ['vacancy', 'Vacancy', 'job', 'Job', 'item', 'Item'];
  var result     = [];

  // Level 1: direct children of root
  result = childrenByName(root, knownNames);
  if (result.length) return result;

  // Level 2: children of each direct child
  var children = root.getChildren();
  for (var i = 0; i < children.length; i++) {
    result = childrenByName(children[i], knownNames);
    if (result.length) return result;
  }

  return [];
}

function childrenByName(el, names) {
  for (var i = 0; i < names.length; i++) {
    // Try with the element's namespace and without
    var found = el.getChildren(names[i], el.getNamespace());
    if (!found || found.length === 0) {
      found = el.getChildren(names[i]);
    }
    if (found && found.length > 0) return found;
  }
  return [];
}

function extractVacancy(el) {
  // Each candidate set lists the most-likely tag name first
  var id = getText(el, ['id', 'vacancyId', 'VacancyId', 'jobId', 'JobId', 'guid']);
  if (!id) return null; // cannot track without an ID

  var title       = getText(el, ['title', 'jobTitle', 'JobTitle', 'Title', 'name']);
  var employer    = getText(el, ['employer', 'Employer', 'employerName', 'EmployerName', 'organisation']);
  var location    = getText(el, ['location', 'Location', 'town', 'Town', 'city', 'City', 'region']);
  var payBand     = getText(el, ['payBand', 'PayBand', 'band', 'Band', 'salary', 'Salary', 'salaryRange']);
  var closingDate = getText(el, ['closingDate', 'ClosingDate', 'expiryDate', 'ExpiryDate', 'deadline', 'closeDate']);
  var urlRaw      = getText(el, ['url', 'link', 'Url', 'Link', 'href', 'vacancyUrl', 'jobUrl']);

  var directUrl = (urlRaw && urlRaw.indexOf('http') === 0)
    ? urlRaw
    : VACANCY_BASE_URL + id;

  return {
    id:          id,
    title:       title,
    employer:    employer,
    location:    location,
    payBand:     payBand,
    closingDate: closingDate,
    directUrl:   directUrl,
  };
}

/** Try each name in the list; return trimmed text of the first match */
function getText(el, names) {
  for (var i = 0; i < names.length; i++) {
    var child = el.getChild(names[i], el.getNamespace()) || el.getChild(names[i]);
    if (child) return child.getText().trim();
  }
  return '';
}

// ─── TELEGRAM ─────────────────────────────────────────────────────────────────

function sendVacancyAlert(v) {
  var msg =
    '🏥 NEW NHS VACANCY\n' +
    '📋 ' + (v.title    || 'N/A') + '\n' +
    '🏢 ' + (v.employer || 'N/A') + '\n' +
    '📍 ' + (v.location || 'N/A') + '\n' +
    '💰 ' + formatBand(v.payBand)  + '\n' +
    '📅 Closes: ' + formatDate(v.closingDate) + '\n' +
    '🔗 ' + v.directUrl;

  sendTelegramMessage(msg);
}

function sendTelegramMessage(text) {
  var props   = PropertiesService.getScriptProperties();
  var token   = props.getProperty('TELEGRAM_BOT_TOKEN');
  var chatId  = props.getProperty('TELEGRAM_CHAT_ID');

  if (!token || !chatId) {
    Logger.log(
      'Telegram credentials missing.\n' +
      'Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Project Settings → Script Properties.'
    );
    return;
  }

  var url     = 'https://api.telegram.org/bot' + token + '/sendMessage';
  var payload = JSON.stringify({
    chat_id:                  chatId,
    text:                     text,
    disable_web_page_preview: false,
  });

  try {
    var res    = UrlFetchApp.fetch(url, {
      method:          'post',
      contentType:     'application/json',
      payload:         payload,
      muteHttpExceptions: true,
    });
    var result = JSON.parse(res.getContentText());
    if (!result.ok) {
      Logger.log('Telegram API error: ' + result.description);
    }
  } catch (e) {
    Logger.log('Failed to reach Telegram: ' + e.message);
  }
}

// ─── TRIGGER SETUP ────────────────────────────────────────────────────────────

function setupTriggers() {
  // Clear all existing triggers to prevent duplicates
  ScriptApp.getProjectTriggers().forEach(function(t) {
    ScriptApp.deleteTrigger(t);
  });

  // 15-minute vacancy check
  ScriptApp.newTrigger('checkAllSearches')
    .timeBased()
    .everyMinutes(15)
    .create();

  // Daily 7 am summary
  ScriptApp.newTrigger('sendDailySummary')
    .timeBased()
    .atHour(7)
    .everyDays(1)
    .create();

  Logger.log('✅ Triggers created: 15-min check + daily 7 am summary.');
}

// ─── UTILITY HELPERS ─────────────────────────────────────────────────────────

function buildUrl(base, params) {
  if (!params || typeof params !== 'object') return base;
  var parts = [];
  Object.keys(params).forEach(function(k) {
    var v = params[k];
    if (v === undefined || v === null || v === '') return; // skip empty values
    parts.push(
      encodeURIComponent(k) + '=' +
      encodeURIComponent(String(v)).replace(/%2C/gi, ',')
    );
  });
  return parts.length ? base + '?' + parts.join('&') : base;
}

function loadSeenIds(props) {
  var raw = props.getProperty(SEEN_IDS_KEY);
  var arr = raw ? JSON.parse(raw) : [];
  return new Set(arr);
}

function saveSeenIds(props, seenSet) {
  var arr = Array.from(seenSet);
  // Trim to newest 2 000 if the JSON would exceed the 9 KB property limit
  if (JSON.stringify(arr).length > 8000) {
    arr = arr.slice(-2000);
  }
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

function formatBand(raw) {
  if (!raw) return 'N/A';
  return raw.replace(/BAND_?(\w+)/gi, 'Band $1').replace(/_/g, ' ');
}

function formatDate(raw) {
  if (!raw) return 'N/A';
  try {
    var d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd MMM yyyy');
  } catch (_) {
    return raw;
  }
}

// ─── ADMIN / DEBUG FUNCTIONS ──────────────────────────────────────────────────

/** Wipe stored vacancy IDs — next checkAllSearches() will re-baseline */
function resetSeenIds() {
  PropertiesService.getScriptProperties().deleteProperty(SEEN_IDS_KEY);
  Logger.log('Seen IDs cleared. Next run will baseline without sending alerts.');
}

/** Fetch Search 1 and log the raw XML so you can inspect the actual schema */
function debugFirstSearch() {
  var url = buildUrl(API_BASE, SEARCHES[0].params);
  Logger.log('URL: ' + url);
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  Logger.log('Status: ' + res.getResponseCode());
  Logger.log('Body (first 2 000 chars):\n' + res.getContentText().slice(0, 2000));
}

/** Send a test message to confirm Telegram is wired up */
function testTelegram() {
  sendTelegramMessage('✅ NHS Jobs Monitor — Telegram connection confirmed!');
  Logger.log('Test message sent.');
}
