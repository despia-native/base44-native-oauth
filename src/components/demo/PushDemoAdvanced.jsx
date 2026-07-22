// Advanced push options: tap behavior, scheduling, iOS badge, metadata.
// Controlled by the parent form via values + set(key)(value).
export default function PushDemoAdvanced({ values: v, set }) {
  const label = 'px-1 pt-2 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground'
  const hint = 'px-1 -mt-1 text-[12px] text-muted-foreground/80 leading-snug'

  return (
    <>
      <p className={label}>Tap behavior</p>
      <input type="text" placeholder="Open path on tap (e.g. /account)" value={v.path} onChange={(e) => set('path')(e.target.value)} className="ember-input" />
      <input type="text" placeholder="Open URL on tap (full reload)" value={v.url} onChange={(e) => set('url')(e.target.value)} className="ember-input" />
      <p className={hint}>Path navigates in-app without a reload; URL forces a full reload. Use one or neither.</p>

      <p className={label}>Scheduling</p>
      <input
        type="datetime-local"
        aria-label="Send at exact time"
        value={v.sendAfter}
        onChange={(e) => set('sendAfter')(e.target.value)}
        className="ember-input"
      />
      <input
        type="text"
        placeholder="Deliver at local time (e.g. 9:00AM)"
        value={v.deliveryTimeOfDay}
        onChange={(e) => set('deliveryTimeOfDay')(e.target.value)}
        className="ember-input"
      />
      <p className={hint}>Leave both empty to send immediately. The first is an exact time; the second delivers at that time in each device's timezone.</p>

      <p className={label}>iOS badge</p>
      <div className="flex gap-3">
        <select
          aria-label="Badge type"
          value={v.badgeType}
          onChange={(e) => set('badgeType')(e.target.value)}
          className="ember-input flex-1 appearance-none"
        >
          <option value="None">No badge change</option>
          <option value="Increase">Increase badge</option>
          <option value="SetTo">Set badge to…</option>
        </select>
        {v.badgeType !== 'None' && (
          <input
            type="number"
            min="0"
            aria-label="Badge count"
            value={v.badgeCount}
            onChange={(e) => set('badgeCount')(e.target.value)}
            className="ember-input !w-24"
          />
        )}
      </div>

      <p className={label}>Metadata</p>
      <textarea
        placeholder='Custom JSON (e.g. {"orderId": 42})'
        value={v.metadata}
        onChange={(e) => set('metadata')(e.target.value)}
        rows={2}
        className="ember-input !h-auto !rounded-3xl py-4 resize-none font-mono !text-[13px]"
      />
      <p className={hint}>Delivered silently to the app alongside the notification.</p>
    </>
  )
}