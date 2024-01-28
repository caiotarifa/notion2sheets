const booleanLocalization = {
  'ar-AR': { true: 'نعم', false: 'لا' },
  'de-DE': { true: 'Ja', false: 'Nein' },
  'en-US': { true: 'Yes', false: 'No' },
  'es-ES': { true: 'Sí', false: 'No' },
  'fr-FR': { true: 'Oui', false: 'Non' },
  'it-IT': { true: 'Sì', false: 'No' },
  'ja-JP': { true: 'はい', false: 'いいえ' },
  'pt-BR': { true: 'Sim', false: 'Não' },
  'ru-RU': { true: 'Да', false: 'Нет' },
  'zh-CN': { true: '是', false: '否' }
}

module.exports = function (boolean) {
  const locale = process.env.LOCALE

  if (!locale || !booleanLocalization[locale]) {
    return String(boolean)
  }

  return booleanLocalization[locale][boolean]
}
