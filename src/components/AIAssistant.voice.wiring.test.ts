import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import hu from '@/i18n/translations/hu.json'

describe('chat voice input wiring', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/AIAssistant.tsx'), 'utf-8')
  const headers = readFileSync(join(process.cwd(), 'src/lib/admin-security-headers.ts'), 'utf-8')

  it('starts Web Speech recognition from the microphone button click', () => {
    expect(src).toContain('webkitSpeechRecognition')
    expect(src).toContain('createSpeechRecognition')
    expect(src).toContain('onClick={toggleVoice}')
    expect(src).toContain('recognition.start()')
    expect(src).toContain('setInput(next)')
    expect(src).toContain('animate-pulse')
    expect(src).toContain('aria-pressed={listening}')
    expect(src).toContain("placeholder={listening ? t('ai.voiceListening')")
    expect(src).toMatch(/try \{[\s\S]*recognition\.start\(\)/)
  })

  it('allows same-origin microphone so mobile Chrome/Safari can capture speech', () => {
    expect(headers).toContain('microphone=(self)')
    expect(headers).not.toMatch(/microphone=\(\),/)
    expect(hu.ai.voiceDenied).toMatch(/mikrofon/i)
  })

  it('surfaces permission failures instead of failing silently', () => {
    expect(src).toContain('voiceErrorKey')
    expect(src).toContain("'ai.voiceDenied'")
    expect(src).toContain("setVoiceError('ai.voiceError')")
    expect(src).toContain('setVoiceError(key)')
    expect(src).toContain('role="alert"')
    expect(src).not.toMatch(/recognition\.onerror = \(\) => \{/)
  })
})
