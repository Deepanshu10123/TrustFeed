// Which tab you were on, remembered for as long as this browser tab stays open,
// so reloading the page puts you back where you were instead of on the feed.
// (Closing the tab and coming back another day still starts on the feed.)

export type Tab = 'feed' | 'upload' | 'myposts' | 'interests'

const TABS: readonly Tab[] = ['feed', 'upload', 'myposts', 'interests']
const STORAGE_KEY = 'trustfeed:tab'

export function loadSavedTab(): Tab {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY)
    return TABS.find((tab) => tab === value) ?? 'feed'
  } catch {
    return 'feed' // storage is unavailable (a private window, say)
  }
}

export function rememberTab(tab: Tab): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, tab)
  } catch {
    // storage is unavailable -- the app works, it just won't remember
  }
}
