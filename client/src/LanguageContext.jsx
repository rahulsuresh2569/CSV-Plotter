import { createContext, useContext } from 'react'
import translations from './i18n'

const LanguageContext = createContext('en')

export function LanguageProvider({ language, children }) {
  return (
    <LanguageContext.Provider value={language}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslation() {
  const language = useContext(LanguageContext)
  return translations[language] || translations.en
}
