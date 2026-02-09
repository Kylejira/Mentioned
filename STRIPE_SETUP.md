# Stripe Payment Integration Setup Guide

## What's Been Implemented

### Database Schema
- **File**: `supabase-subscriptions.sql`
- Run this in Supabase SQL Editor to create the subscriptions table

### API Endpoints
- `POST /api/checkout` - Creates Stripe Checkout session
- `POST /api/webhook/stripe` - Handles Stripe webhook events
- `GET /api/subscription` - Returns user's subscription status
- `POST /api/subscription` - Creates Stripe Customer Portal session

### Frontend Components
- **Pricing Page**: `/pricing` - Shows all plan options
- **Billing Page**: `/settings/billing` - Manage subscription
- **Upgrade Modal**: Shown when free users try paid features
- **Scan Limit Modal**: Shown when Starter users hit their limit
- **Scans Remaining Indicator**: Shows in dashboard header

### Feature Gating
- Free users: 1 scan only, blocked from checklist/history/drafts
- Starter users: 10 scans/month, all features
- Pro users: Unlimited scans, all features

---

## Setup Instructions

### Step 1: Create Stripe Account
1. Go to https://dashboard.stripe.com
2. Create account or sign in

### Step 2: Create Products in Stripe

Go to **Products** in Stripe Dashboard and create:

#### Product 1: Mentioned Starter
- Name: "Mentioned Starter"
- Price: $19/month (recurring)
- Metadata: `plan=starter`, `scans_limit=10`
- Copy the Price ID (starts with `price_`)

#### Product 2: Mentioned Pro
- Name: "Mentioned Pro"  
- Price 1: $37/month (recurring)
  - Metadata: `plan=pro_monthly`
  - Copy the Price ID
- Price 2: $299/year (recurring)
  - Metadata: `plan=pro_annual`
  - Copy the Price ID

### Step 3: Get API Keys

In Stripe Dashboard → Developers → API Keys:
- Copy **Publishable key** (starts with `pk_`)
- Copy **Secret key** (starts with `sk_`)

### Step 4: Set Up Webhook

1. Go to Developers → Webhooks
2. Click "Add endpoint"
3. URL: `https://mentioned.pro/api/webhook/stripe`
4. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Copy the **Webhook signing secret** (starts with `whsec_`)

### Step 5: Add Environment Variables

Add to Vercel (Settings → Environment Variables):

```
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_STARTER_PRICE_ID=price_xxx
STRIPE_PRO_MONTHLY_PRICE_ID=price_xxx
STRIPE_PRO_ANNUAL_PRICE_ID=price_xxx

# Also add these as NEXT_PUBLIC_ for client-side
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID=price_xxx
NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID=price_xxx
NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID=price_xxx

# Make sure this is set
NEXT_PUBLIC_APP_URL=https://mentioned.pro

# For webhook (service role key bypasses RLS)
SUPABASE_SERVICE_ROLE_KEY=xxx
```

### Step 6: Run Database Migration

Run `supabase-subscriptions.sql` in Supabase SQL Editor:
1. Go to Supabase → SQL Editor
2. Paste contents of `supabase-subscriptions.sql`
3. Click "Run" (accept the warning about DROP TRIGGER)

### Step 7: Deploy

```bash
git add -A
git commit -m "Add Stripe payment integration"
npx vercel --prod
```

### Step 8: Test

1. Use Stripe test mode first (`pk_test_`, `sk_test_`)
2. Use test card: `4242 4242 4242 4242`
3. Any future date, any CVC
4. Verify:
   - Checkout flow works
   - Webhook updates subscription status
   - Feature gating works correctly
   - Scan limits enforced

---

## Pricing Summary

| Plan | Price | Scans | Features |
|------|-------|-------|----------|
| Free | $0 | 1 total | View results only |
| Starter | $19/mo | 10/month | All features |
| Pro Monthly | $37/mo | Unlimited | All features + priority support |
| Pro Annual | $299/yr | Unlimited | All features + priority support (save 33%) |

---

## Files Modified/Created

### New Files
- `supabase-subscriptions.sql` - Database schema
- `src/app/api/checkout/route.ts` - Checkout API
- `src/app/api/webhook/stripe/route.ts` - Webhook handler
- `src/app/api/subscription/route.ts` - Subscription API
- `src/app/settings/billing/page.tsx` - Billing management page
- `src/components/upgrade-modal.tsx` - Upgrade/scan limit modals
- `src/components/scans-remaining.tsx` - Usage indicator

### Modified Files
- `src/lib/subscription.ts` - Updated hook with new tiers
- `src/app/pricing/page.tsx` - Updated pricing page
- `src/app/dashboard/page.tsx` - Added usage indicator + modals
- `src/app/checklist/page.tsx` - Added feature gating
- `src/app/progress/page.tsx` - Added feature gating
- `src/app/settings/page.tsx` - Added billing link
- `src/app/api/scan/route.ts` - Added subscription checks
- `src/components/upgrade-prompt.tsx` - Updated with pricing tiers
