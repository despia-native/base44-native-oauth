import { Crown, Settings2 } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { usePremium } from '@/lib/PremiumContext'
import { launchPaywall, openCustomerCenter, isDespia } from '@/lib/revenuecat'
import ListRow from '@/components/mobile/ListRow'

// Account page section: upgrade via the RevenueCat paywall, or manage an
// active subscription through the native Customer Center.
export default function PremiumSection() {
  const { user } = useAuth()
  const { isPremium } = usePremium()

  return (
    <>
      <p className="px-1 pt-6 pb-2 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
        Membership
      </p>
      <div className="rounded-3xl ember-card overflow-hidden">
        {isPremium ? (
          <>
            <ListRow
              icon={Crown}
              iconBg="bg-primary/10"
              iconColor="text-primary"
              label="Premium"
              value="Active"
              showChevron={false}
              first
            />
            {isDespia && (
              <ListRow
                icon={Settings2}
                iconBg="bg-muted"
                label="Manage subscription"
                onClick={() => openCustomerCenter(user.id)}
              />
            )}
          </>
        ) : (
          <ListRow
            icon={Crown}
            iconBg="bg-primary/10"
            iconColor="text-primary"
            label="Upgrade to Premium"
            onClick={() => launchPaywall(user.id)}
            first
          />
        )}
      </div>
    </>
  )
}