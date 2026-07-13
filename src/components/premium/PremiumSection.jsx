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
              icon="star_fill"
              iconBg="bg-primary/10"
              iconColor="text-primary"
              label="Premium"
              value="Active"
              showChevron={false}
              first
            />
            {isDespia && (
              <ListRow
                icon="gear_alt_fill"
                iconBg="bg-muted"
                label="Manage subscription"
                onClick={() => openCustomerCenter(user.id)}
              />
            )}
          </>
        ) : (
          <ListRow
            icon="star_fill"
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