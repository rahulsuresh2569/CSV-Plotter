//displays sample files for the user to try
import { useTranslation } from '../LanguageContext'

export default function SampleFilesRow({ samples, onSelect, disabled }) {
  const t = useTranslation()

  return (
    <div className="sample-row">
      <span className="sample-label">{t.trySample}</span>
      <span className="sample-btns">
        {samples.map((sample) => (
          <button
            key={sample.name}
            className="sample-btn"
            onClick={() => onSelect(sample)}
            disabled={disabled}
          >
            {sample.name}
          </button>
        ))}
      </span>
    </div>
  )
}
