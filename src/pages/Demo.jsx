import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import F7Icon from '@/components/F7Icon'
import { isDespia, checkPushPermission, openDeviceSettings } from '@/lib/push'
import PushDemoForm from '@/components/demo/PushDemoForm'

// Push notification demo (/demo) — reachable from Account. Lets any signed-in
// user send THEMSELVES a test push with every supported OneSignal option.
export default function Demo() {
  const navigate = useNavigate()
  const [permission, setPermission] = useState(null) // true | false | null (web/unknown)

  useEffect(() => {
    if (isDespia) checkPushPermission().then(setPermission)
  }, [])

  const status = !isDespia
    ? { icon: 'globe', text: 'Web preview — pushes only arrive in the native app', color: 'text-muted-foreground' }
    : permission === false
      ? { icon: 'bell_slash_fill', text: 'Notifications are disabled on this device', color: 'text-destructive' }
      : { icon: 'bell_fill', text: permission ? 'Notifications enabled on this device' : 'Checking permission…', color: 'text-secondary' }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="scroll-container flex flex-col px-5 pt-safe-top pb-safe-bottom">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center text-primary text-[17px] active:opacity-60 self-start mt-4 -ml-1"
        >
          <F7Icon name="chevron_left" size={22} /> Back
        </button>

        <div className="w-full max-w-sm md:max-w-md mx-auto flex flex-col pt-4 pb-16">
          <h1 className="text-[26px] font-bold tracking-tight text-foreground mb-1">Push Demo</h1>
          <p className="text-[13px] text-muted-foreground mb-5">
            Sends a test notification to yourself with any combination of options.
          </p>

          <div className="rounded-3xl ember-card p-4 mb-4 flex items-center gap-3">
            <F7Icon name={status.icon} size={19} className={status.color} />
            <p className="text-[14px] text-foreground">{status.text}</p>
          </div>

          {isDespia && permission === false && (
            <button
              type="button"
              onClick={openDeviceSettings}
              className="w-full h-14 rounded-full ember-glass ember-press text-[15px] font-semibold text-foreground active:scale-95 transition-transform mb-4"
            >
              Open device settings
            </button>
          )}

          <PushDemoForm />
        </div>
      </div>
    </div>
  )
}