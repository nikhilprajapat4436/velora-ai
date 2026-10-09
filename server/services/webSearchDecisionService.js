const shouldSearchWeb = (message) => {
  if (!message?.trim()) return false;

  const text = message.toLowerCase().trim();

  // Weather queries should use the dedicated Weather Tool
  // instead of automatic Web Search.
  const weatherPatterns = [
    /\bweather\b/,
    /\btemperature\b/,
    /\bforecast\b/,
    /\brain\b/,
    /\braining\b/,
    /\bhumidity\b/,
    /\bwind\b/,
    /\bwind speed\b/,
    /\bair quality\b/,
    /\bclimate\b/,
  ];

  if (weatherPatterns.some((pattern) => pattern.test(text))) {
    return false;
  }

  const webSearchPatterns = [
    // Current / latest information
    /\blatest\b/,
    /\bcurrent\b/,
    /\btoday\b/,
    /\btonight\b/,
    /\bnow\b/,
    /\brecent\b/,
    /\bcurrently\b/,
    /\bthis week\b/,
    /\bthis month\b/,
    /\bthis year\b/,

    // News / updates
    /\bnews\b/,
    /\bupdates?\b/,
    /\bannouncement\b/,
    /\breleased?\b/,
    /\brelease\b/,

    // Time-sensitive information
    /\bprice\b/,
    /\brate\b/,
    /\bscore\b/,
    /\bresults?\b/,
    /\bstock\b/,
    /\bmarket\b/,
    /\bbitcoin\b/,
    /\bcryptocurrency\b/,
    /\bexchange rate\b/,

    // Events / schedules
    /\bschedule\b/,
    /\bmatch\b/,
    /\bgame\b/,
    /\bevent\b/,
    /\bopening hours\b/,
    /\bopen now\b/,

    // Explicit web requests
    /\bsearch the web\b/,
    /\bsearch online\b/,
    /\bsearch internet\b/,
    /\blook it up\b/,
    /\blook online\b/,
    /\bfind online\b/,
  ];

  return webSearchPatterns.some((pattern) => pattern.test(text));
};

export default shouldSearchWeb;