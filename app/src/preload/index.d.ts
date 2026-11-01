import { ElectronAPI } from '@electron-toolkit/preload'
import type { OrchestraApi } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: OrchestraApi
  }
}
