import { safeStorage } from 'electron'
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'

export class CredentialStore {
  constructor(private path: string) {}
  hasKey() {
    return existsSync(this.path)
  }
  async set(key: string) {
    if (!safeStorage.isEncryptionAvailable())
      throw new Error(
        'Windows credential encryption is unavailable. Please restart the app and try again.'
      )
    const encrypted = safeStorage.encryptString(key.trim())
    writeFileSync(`${this.path}.tmp`, encrypted)
    renameSync(`${this.path}.tmp`, this.path)
  }
  get() {
    if (!this.hasKey())
      throw new Error('Add your TypeSafe API key in Settings to run this experiment.')
    try {
      return safeStorage.decryptString(readFileSync(this.path))
    } catch {
      throw new Error('Your saved API key could not be unlocked. Replace it in Settings.')
    }
  }
  remove() {
    if (this.hasKey()) unlinkSync(this.path)
  }
}
