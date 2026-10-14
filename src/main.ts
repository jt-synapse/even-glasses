import {
  waitForEvenAppBridge,
  TextContainerProperty,
  TextContainerUpgrade,
  CreateStartUpPageContainer,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'

// Wait for the bridge to be ready before doing anything else.
// In the simulator this resolves immediately; on hardware it waits
// for the WebView to initialize the SDK bridge.
const bridge = await waitForEvenAppBridge()

// Build a single text container that fills the visible canvas (576×288).
const mainText = new TextContainerProperty({
  xPosition: 0,
  yPosition: 0,
  width: 576,
  height: 288,
  borderWidth: 0,
  borderColor: 5,
  paddingLength: 4,
  containerID: 1,
  containerName: 'main',
  content: 'Hello from G2! (v2)\n\nTap to count: 0\nLast: none yet\nDouble-tap to exit',
  isEventCapture: 1,           // ← receive click events on this container
})

// Render the page. `result` is 0 on success.
const result = await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({
    containerTotalNum: 1,
    textObject: [mainText],
  }),
)

if (result !== 0) {
  console.error('createStartUpPageContainer failed:', result)
  // 1 = invalid params, 2 = oversize, 3 = out of memory
}

// Single event subscription - all OS events arrive through onEvenHubEvent.
// On real hardware a temple/ring press may arrive as a sysEvent (with an
// eventSource) rather than a textEvent, so accept clicks from both.
// The last event seen is shown on the glasses as a diagnostic.
let count = 0
let lastClickAt = 0

function show(last: string) {
  bridge.textContainerUpgrade(new TextContainerUpgrade({
    containerID: 1,
    containerName: 'main',
    content: `Hello from G2! (v2)\n\nTap to count: ${count}\nLast: ${last}\nDouble-tap to exit`,
  }))
}

function onClick(origin: string) {
  const now = Date.now()
  if (now - lastClickAt < 250) return // ignore duplicate delivery of one tap
  lastClickAt = now
  count += 1
  show(origin)
}

bridge.onEvenHubEvent((event) => {
  console.log('EvenHub event:', JSON.stringify(event.jsonData ?? event))

  const textEvent = event.textEvent
  if (textEvent && textEvent.containerID === 1) {
    switch (textEvent.eventType) {
      case OsEventTypeList.CLICK_EVENT:
      case undefined: // SDK normalizes 0 to undefined in some cases
        onClick('text tap')
        return
      case OsEventTypeList.DOUBLE_CLICK_EVENT:
        // Mode 1 shows the system exit-confirmation dialog.
        bridge.shutDownPageContainer(1)
        return
    }
  }

  const sysEvent = event.sysEvent
  if (sysEvent) {
    const sourceName = ['none', 'glasses R', 'ring', 'glasses L'][sysEvent.eventSource ?? 0] ?? String(sysEvent.eventSource)
    switch (sysEvent.eventType) {
      case OsEventTypeList.CLICK_EVENT:
      case undefined:
        onClick(`sys tap (${sourceName})`)
        return
      case OsEventTypeList.DOUBLE_CLICK_EVENT:
        bridge.shutDownPageContainer(1)
        return
      default:
        show(`sys type=${sysEvent.eventType} src=${sourceName}`)
        return
    }
  }

  if (textEvent) show(`text type=${textEvent.eventType} id=${textEvent.containerID}`)
})
