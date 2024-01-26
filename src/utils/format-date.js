module.exports = function (date) {
  const locale = process.env.LOCALE

  if (!date || !locale) {
    return date
  }

  date = new Date(date)

  if (isNaN(date.getTime())) {
    return date
  }

  const hasDate = date.getUTCDate() > 1 ||
                  date.getUTCMonth() > 0 ||
                  date.getUTCFullYear() > 0

  const hasTime = date.getUTCHours() > 0 ||
                  date.getUTCMinutes() > 0 ||
                  date.getUTCSeconds() > 0

  if (hasDate && hasTime) {
    return date.toLocaleString(locale)
  } else if (hasDate) {
    return date.toLocaleDateString(locale)
  } else if (hasTime) {
    return date.toLocaleTimeString(locale)
  }

  return date
}
