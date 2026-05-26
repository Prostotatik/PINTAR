import { sendUserMessage, setAbort, resetConversation } from './agent-loop'
import type { AgentEvent, SidebarCommand } from '../shared/message-types'

let sidebarPort: chrome.runtime.Port | null = null

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error)
  console.log('[PINTAR SW] installed/updated')
})

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'pintar-sidebar') return

  console.log('[PINTAR SW] sidebar connected')
  sidebarPort = port

  port.onDisconnect.addListener(() => {
    console.log('[PINTAR SW] sidebar disconnected')
    sidebarPort = null
  })

  port.onMessage.addListener((msg: SidebarCommand) => {
    console.log('[PINTAR SW] received command:', msg.type)

    if (msg.type === 'KEEPALIVE') return

    if (msg.type === 'RESET') {
      resetConversation()
      pushEvent({ type: 'AGENT_DONE' })
      return
    }

    if (msg.type === 'USER_MESSAGE') {
      // Immediate ACK so the sidebar knows the SW is alive
      pushEvent({ type: 'AGENT_TEXT', text: '' })

      sendUserMessage(msg.text, msg.resumes, pushEvent)
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err)
          console.error('[PINTAR SW] sendUserMessage threw:', message)
          pushEvent({ type: 'AGENT_ERROR', message })
          pushEvent({ type: 'AGENT_DONE' })
        })

    } else if (msg.type === 'ABORT') {
      setAbort()
      pushEvent({ type: 'AGENT_DONE' })
    }
  })
})

function pushEvent(event: AgentEvent) {
  if (!sidebarPort) {
    console.warn('[PINTAR SW] pushEvent called but no sidebar port', event.type)
    return
  }
  try {
    sidebarPort.postMessage(event)
  } catch (err) {
    console.error('[PINTAR SW] postMessage failed:', err)
    sidebarPort = null
  }
}
