import { useEffect, useState } from 'react'

type Provider = 'gemini' | 'chutes'

export default function Settings() {
  const [provider, setProvider] = useState<Provider>('gemini')
  const [geminiKey, setGeminiKey] = useState('')
  const [chutesKey, setChutesKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    chrome.storage.sync.get(['llm_provider', 'gemini_api_key', 'chutes_api_key'], (result) => {
      if (result.llm_provider) setProvider(result.llm_provider as Provider)
      if (result.gemini_api_key) setGeminiKey(result.gemini_api_key as string)
      if (result.chutes_api_key) setChutesKey(result.chutes_api_key as string)
      setLoading(false)
    })
  }, [])

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    chrome.storage.sync.set({
      llm_provider: provider,
      gemini_api_key: geminiKey.trim(),
      chutes_api_key: chutesKey.trim(),
    }, () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  const activeKeyMissing = provider === 'gemini' ? !geminiKey.trim() : !chutesKey.trim()

  if (loading) return <div className="settings__loading">Loading…</div>

  return (
    <div className="settings">
      <header className="settings__header">
        <h1 className="settings__title">
          <span className="settings__logo-p">P</span>INTAR Settings
        </h1>
      </header>

      <form className="settings__form" onSubmit={handleSave}>

        {/* Provider selector */}
        <div className="settings__field">
          <label className="settings__label">AI Provider</label>
          <div className="settings__toggle" data-provider={provider}>
            <div className="settings__toggle-track">
              <div className="settings__toggle-thumb" />
              <button
                type="button"
                className={`settings__toggle-option ${provider === 'gemini' ? 'settings__toggle-option--active' : ''}`}
                onClick={() => setProvider('gemini')}
              >
                Google Gemini
              </button>
              <button
                type="button"
                className={`settings__toggle-option ${provider === 'chutes' ? 'settings__toggle-option--active' : ''}`}
                onClick={() => setProvider('chutes')}
              >
                Chutes.ai (Qwen3)
              </button>
            </div>
            <p className="settings__toggle-caption">
              {provider === 'gemini'
                ? 'Using gemini-2.5-flash — fast and free with an API key from Google AI Studio'
                : 'Using Qwen3-32B-TEE via Chutes.ai — requires a Chutes API key'}
            </p>
          </div>
        </div>

        {/* Gemini key */}
        {provider === 'gemini' && (
          <div className="settings__field">
            <label className="settings__label" htmlFor="gemini-key">
              Gemini API Key
            </label>
            <p className="settings__hint">
              Get your free key from{' '}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
                Google AI Studio
              </a>.
            </p>
            <input
              id="gemini-key"
              className="settings__input"
              type="password"
              value={geminiKey}
              onChange={e => setGeminiKey(e.target.value)}
              placeholder="AIza…"
              autoComplete="off"
            />
          </div>
        )}

        {/* Chutes key */}
        {provider === 'chutes' && (
          <div className="settings__field">
            <label className="settings__label" htmlFor="chutes-key">
              Chutes.ai API Key
            </label>
            <p className="settings__hint">
              Get your key from{' '}
              <a href="https://chutes.ai" target="_blank" rel="noreferrer">chutes.ai</a>.
            </p>
            <input
              id="chutes-key"
              className="settings__input"
              type="password"
              value={chutesKey}
              onChange={e => setChutesKey(e.target.value)}
              placeholder="chutes-sk-…"
              autoComplete="off"
            />
          </div>
        )}

        <button className="settings__save-btn" type="submit" disabled={activeKeyMissing}>
          {saved ? '✅ Saved!' : 'Save'}
        </button>
      </form>

      <div className="settings__about">
        <h2>About PINTAR</h2>
        <p>
          <strong>PINTAR</strong> is an AI recruitment agent that screens resumes against a job
          description, enriches candidate profiles, and produces ranked recommendations.
        </p>
        <ul>
          <li>Upload PDF resumes and describe the role in chat</li>
          <li>Agent screens, ranks, and deep-reviews candidates autonomously</li>
          <li>Live annotations injected into LinkedIn / GitHub tabs</li>
          <li>Final comparative report with hiring recommendation</li>
        </ul>
      </div>
    </div>
  )
}
