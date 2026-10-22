// Kinetic Ledger: Settings form — no borders, tonal layers, bottom-line inputs

import { useState, useEffect, useCallback } from 'react'
import { PlatformSection } from './PlatformSection'
import { getConfig, setConfig } from '../../utils/storage'
import { STORAGE_KEYS } from '../../config/constants'

interface Toast { message: string; ok: boolean }

export function SettingsForm() {
  const [toast, setToast] = useState<Toast | null>(null)

  const [schwab,   setSchwab]   = useState({ appKey: '', appSecret: '', refreshToken: '' })
  const [okx,      setOkx]      = useState({ apiKey: '', secret: '', passphrase: '' })
  const [zerion,   setZerion]   = useState({ apiKey: '', walletAddresses: '', aaveAppBalance: '' })
  const [finnhub,  setFinnhub]  = useState({ apiKey: '' })
  const [futu,     setFutu]     = useState({ bridgeUrl: '', token: '' })
  const [manual,   setManual]   = useState({ holdings: '' })
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const s = getConfig<typeof schwab>(STORAGE_KEYS.schwab)
    if (s) { setSchwab(s); setSaved((p) => ({ ...p, schwab: true })) }
    const o = getConfig<typeof okx>(STORAGE_KEYS.okx)
    if (o) { setOkx(o); setSaved((p) => ({ ...p, okx: true })) }
    const z = getConfig<typeof zerion>(STORAGE_KEYS.zerion)
    if (z) { setZerion((s) => ({ ...s, ...z })); setSaved((p) => ({ ...p, zerion: true })) }
    const f = getConfig<typeof finnhub>(STORAGE_KEYS.finnhub)
    if (f) { setFinnhub(f); setSaved((p) => ({ ...p, finnhub: true })) }
    const fu = getConfig<typeof futu>(STORAGE_KEYS.futu)
    if (fu) { setFutu(fu); setSaved((p) => ({ ...p, futu: true })) }
    const m = getConfig<typeof manual>(STORAGE_KEYS.manualHoldings)
    if (m) { setManual(m); setSaved((p) => ({ ...p, manual: true })) }
  }, [])

  const flash = (message: string, ok = true) => {
    setToast({ message, ok })
    setTimeout(() => setToast(null), 2800)
  }

  const save = useCallback((key: string, value: unknown, name: string) => {
    try {
      setConfig(key, value)
      setSaved((p) => ({ ...p, [name]: true }))
      flash(`${name} saved`)
    } catch {
      flash(`Failed to save ${name}`, false)
    }
  }, [])

  return (
    <div className="space-y-px relative">
      {/* Toast — top-right, no border, tonal */}
      {toast && (
        <div
          className={`fixed top-4 right-6 z-50 px-5 py-3 font-body text-label-lg blade-left ${
            toast.ok ? 'bg-ch text-gain border-l-gain' : 'bg-ch text-loss border-l-loss'
          }`}
          style={{ borderLeftWidth: '2px' }}
        >
          {toast.message}
        </div>
      )}

      <PlatformSection
        title="Charles Schwab" tag="SCHW" saved={saved.schwab ?? false}
        fields={[
          { key: 'appKey',       label: 'App Key',       placeholder: 'schwab_app_key_…' },
          { key: 'appSecret',    label: 'App Secret',    type: 'password', placeholder: '••••••••' },
          { key: 'refreshToken', label: 'Refresh Token', type: 'password', placeholder: 'obtained via Postman / OAuth' },
        ]}
        values={schwab}
        onChange={(k, v) => setSchwab((s) => ({ ...s, [k]: v }))}
        onSave={() => save(STORAGE_KEYS.schwab, schwab, 'schwab')}
      />

      <PlatformSection
        title="OKX Exchange" tag="OKX" saved={saved.okx ?? false}
        fields={[
          { key: 'apiKey',     label: 'API Key',                 placeholder: 'okx_api_key_…' },
          { key: 'secret',     label: 'Secret Key', type: 'password', placeholder: '••••••••' },
          { key: 'passphrase', label: 'Passphrase (optional)',   type: 'password', placeholder: 'leave blank if none' },
        ]}
        values={okx}
        onChange={(k, v) => setOkx((s) => ({ ...s, [k]: v }))}
        onSave={() => save(STORAGE_KEYS.okx, okx, 'okx')}
      />

      <PlatformSection
        title="Zerion Wallets" tag="ZRN" saved={saved.zerion ?? false}
        fields={[
          { key: 'apiKey',         label: 'API Key',          type: 'password', placeholder: 'zerion_api_key_…' },
          { key: 'walletAddresses',label: 'Wallet Addresses', placeholder: '0xabc…, 0xdef… (comma-separated)' },
          { key: 'aaveAppBalance', label: 'Aave App Balance (USD, copy from the app)', placeholder: '2439.25' },
        ]}
        values={zerion}
        onChange={(k, v) => setZerion((s) => ({ ...s, [k]: v }))}
        onSave={() => save(STORAGE_KEYS.zerion, zerion, 'zerion')}
      />

      <PlatformSection
        title="Finnhub News" tag="FNH" saved={saved.finnhub ?? false}
        fields={[
          { key: 'apiKey', label: 'API Key', placeholder: 'free key from finnhub.io' },
        ]}
        values={finnhub}
        onChange={(k, v) => setFinnhub((s) => ({ ...s, [k]: v }))}
        onSave={() => save(STORAGE_KEYS.finnhub, finnhub, 'finnhub')}
      />

      <PlatformSection
        title="Futu (US, via futu-bridge)" tag="FUTU" saved={saved.futu ?? false}
        fields={[
          { key: 'bridgeUrl', label: 'Bridge URL',   placeholder: 'https://1-2-3-4.sslip.io' },
          { key: 'token',     label: 'Bridge Token', type: 'password', placeholder: 'BRIDGE_TOKEN on the VM' },
        ]}
        values={futu}
        onChange={(k, v) => setFutu((s) => ({ ...s, [k]: v }))}
        onSave={() => save(STORAGE_KEYS.futu, futu, 'futu')}
      />

      <PlatformSection
        title="Manual Holdings" tag="MAN" saved={saved.manual ?? false}
        fields={[
          { key: 'holdings', label: 'Holdings (SYMBOL:qty@cost, comma-separated; priced via Finnhub)', placeholder: 'TSLA:13@207.9' },
        ]}
        values={manual}
        onChange={(k, v) => setManual((s) => ({ ...s, [k]: v }))}
        onSave={() => save(STORAGE_KEYS.manualHoldings, manual, 'manual')}
      />

      {/* Security note */}
      <div className="pt-8 pl-5">
        <p className="font-body text-label-sm text-muted leading-relaxed max-w-md">
          All credentials stored in <span className="text-on-s">localStorage</span> only.
          Never transmitted to any server other than the respective platform APIs.
          Keep this repository private.
        </p>
      </div>
    </div>
  )
}
