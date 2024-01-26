module.exports = function (number) {
  if (!number || !process.env.LOCALE) {
    return number
  }

  return new Intl.NumberFormat(process.env.LOCALE || 'en-US').format(number)
}
