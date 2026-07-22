import { useEffect, useState } from 'react'
import F7Icon from '@/components/F7Icon'
import { getLastNotificationEvent, onNotificationOpen } from '@/lib/notificationEvents'

// Shows the payload of the last tapped notification (path / url / metadata) —
// verifies the full send → tap → receive round-trip on device.
export default function PushDemoReceived() {
  const [event, setEvent] = useState(getLastNotificationEvent())

  useEffect(() => onNotificationOpen(setEvent), [])

  return (
    <div className="rounded-3xl ember-card p-4 mt-2">
      <div className="flex items-center gap-2 mb-2">
        <F7Icon name="arrow_down_circle_fill" size={17} className="text-secondary" />
        <p className="text-[14px] font-semibold text-foreground">Last received tap</p>
      </div>
      {event ? (
        <div className="flex flex-col gap-1 text-[13px]">
          {event.path && <p><span className="text-muted-foreground">Path:</span> <span className="font-mono">{event.path}</span></p>}
          {event.url && <p><span className="text-muted-foreground">URL:</span> <span className="font-mono break-all">{event.url}</span></p>}
          {event.metadata !== undefined && (
            <pre className="mt-1 rounded-xl bg-muted p-3 font-mono text-[12px] overflow-x-auto">
              {typeof event.metadata === 'string' ? event.metadata : JSON.stringify(event.metadata, null, 2)}
            </pre>
          )}
          <p className="text-[12px] text-muted-foreground mt-1">
            Received {new Date(event.receivedAt).toLocaleTimeString()}
          </p>
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground leading-snug">
          Nothing yet — send yourself a push with a path or metadata, then tap the notification when it arrives.
        </p>
      )}
    </div>
  )
}