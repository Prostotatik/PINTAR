import { useEffect, useState } from 'react'
import { Icon, Logo } from '../sidebar/components/Icon'
import { GEMINI_MODEL, MODEL, MORPHEUS_MODEL } from '../shared/constants'

type Provider = 'gemini' | 'chutes' | 'morpheus'

const PROVIDER_INFO: Record<Provider, { name: string; caption: string }> = {
  gemini: { name: 'Google Gemini', caption: `Using ${GEMINI_MODEL} — fast, with a free key from Google AI Studio.` },
  chutes: { name: 'Chutes.ai', caption: `Using ${MODEL} via Chutes.ai — requires a Chutes API key.` },
  morpheus: { name: 'Morpheus', caption: `Using ${MORPHEUS_MODEL} via mor.org — requires a Morpheus API key.` },
}

export default function Settings() {
  const [provider, setProvider] = useState<Provider>('gemini')
  const [geminiKey, setGeminiKey] = useState('')
  const [chutesKey, setChutesKey] = useState('')
  const [morpheusKey, setMorpheusKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    chrome.storage.sync.get(['llm_provider', 'gemini_api_key', 'chutes_api_key', 'morpheus_api_key'], (result) => {
      if (result.llm_provider) setProvider(result.llm_provider as Provider)
      if (result.gemini_api_key) setGeminiKey(result.gemini_api_key as string)
      if (result.chutes_api_key) setChutesKey(result.chutes_api_key as string)
      if (result.morpheus_api_key) setMorpheusKey(result.morpheus_api_key as string)
      setLoading(false)
    })
  }, [])

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    chrome.storage.sync.set(
      {
        llm_provider: provider,
        gemini_api_key: geminiKey.trim(),
        chutes_api_key: chutesKey.trim(),
        morpheus_api_key: morpheusKey.trim(),
      },
      () => {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    )
  }

  const isGemini = provider === 'gemini'
  const isMorpheus = provider === 'morpheus'
  const activeKeyMissing = isGemini ? !geminiKey.trim() : isMorpheus ? !morpheusKey.trim() : !chutesKey.trim()

  if (loading) {
    return (
      <div className="set-loading">
        <Icon name="loader" size={20} className="spin" />
      </div>
    )
  }

  return (
    <div className="set">
      <header className="set__header">
        <Logo size={34} />
        <div>
          <h1 className="set__title">PINTAR</h1>
          <p className="set__subtitle">Settings</p>
        </div>
      </header>

      <form className="set__card" onSubmit={handleSave}>
        <div className="set__field">
          <label className="set__label">AI provider</label>
          <div className="set__seg" role="radiogroup" aria-label="AI provider">
            {(['gemini', 'chutes', 'morpheus'] as Provider[]).map(p => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={provider === p}
                className={`set__seg-opt ${provider === p ? 'set__seg-opt--active' : ''}`}
                onClick={() => setProvider(p)}
              >
                {PROVIDER_INFO[p].name}
              </button>
            ))}
          </div>
          <p className="set__hint">{PROVIDER_INFO[provider].caption}</p>
        </div>

        <div className="set__field">
          <label className="set__label" htmlFor="api-key">
            {isGemini ? 'Gemini API key' : isMorpheus ? 'Morpheus API key' : 'Chutes.ai API key'}
          </label>
          <p className="set__hint">
            {isGemini ? (
              <>Get a free key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>.</>
            ) : isMorpheus ? (
              <>Get a key from <a href="https://mor.org" target="_blank" rel="noreferrer">mor.org</a>.</>
            ) : (
              <>Get a key from <a href="https://chutes.ai" target="_blank" rel="noreferrer">chutes.ai</a>.</>
            )}
          </p>
          <div className="set__input-wrap">
            <input
              id="api-key"
              key={provider}
              className="set__input"
              type={showKey ? 'text' : 'password'}
              value={isGemini ? geminiKey : isMorpheus ? morpheusKey : chutesKey}
              onChange={e => isGemini ? setGeminiKey(e.target.value) : isMorpheus ? setMorpheusKey(e.target.value) : setChutesKey(e.target.value)}
              placeholder={isGemini ? 'AIza…' : isMorpheus ? 'mor-…' : 'cpk-…'}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="set__reveal"
              onClick={() => setShowKey(s => !s)}
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
            >
              <Icon name={showKey ? 'x-circle' : 'search'} size={16} />
            </button>
          </div>
        </div>

        <button className="set__save" type="submit" disabled={activeKeyMissing}>
          {saved ? (
            <><Icon name="check" size={16} strokeWidth={2.4} /> Saved</>
          ) : (
            'Save'
          )}
        </button>
        {activeKeyMissing && (
          <p className="set__warn">
            <Icon name="alert-triangle" size={13} />
            Enter your {isGemini ? 'Gemini' : isMorpheus ? 'Morpheus' : 'Chutes.ai'} key to enable PINTAR.
          </p>
        )}
      </form>

      <div className="set__card set__about">
        <h2 className="set__about-title">How PINTAR works</h2>
        <ol className="set__steps">
          <li><span>1</span> Upload PDF résumés and describe the role in chat.</li>
          <li><span>2</span> The agent screens, ranks, and deep-reviews candidates autonomously.</li>
          <li><span>3</span> Finalists are cross-checked against their live LinkedIn / GitHub pages.</li>
          <li><span>4</span> You get a ranked shortlist with a clear hire recommendation.</li>
        </ol>
      </div>
    </div>
  )
}
