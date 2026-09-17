-- ============================================================
-- BLOC 5 — Modèle économique : adaptation au schéma existant
-- ============================================================

-- ── Colonnes manquantes sur subscription_plans ────────────
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS trial_days             integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS founder_offer_active   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS founder_slots_remaining integer;

-- ── Colonnes manquantes sur credit_wallets ────────────────
ALTER TABLE public.credit_wallets
  ADD COLUMN IF NOT EXISTS plan_credits_total integer DEFAULT 0;

UPDATE public.credit_wallets
SET plan_credits_total = plan_credits
WHERE plan_credits_total = 0 AND plan_credits > 0;

-- ── Colonnes manquantes sur credit_transactions ───────────
ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS reference_type text,
  ADD COLUMN IF NOT EXISTS description    text;

-- ── Colonnes manquantes sur promo_codes ───────────────────
ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS duration_months      integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS stripe_promo_code_id text;

-- ── Table manquante : promo_code_uses ─────────────────────
CREATE TABLE IF NOT EXISTS public.promo_code_uses (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  promo_code_id    uuid REFERENCES public.promo_codes(id) NOT NULL,
  profile_id       uuid REFERENCES public.profiles(id),
  organization_id  uuid REFERENCES public.organizations(id),
  subscription_id  uuid,
  used_at          timestamptz DEFAULT now()
);

ALTER TABLE public.promo_code_uses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='promo_code_uses' AND policyname='promo_uses_own') THEN
    CREATE POLICY "promo_uses_own" ON public.promo_code_uses
      FOR SELECT USING (
        profile_id = auth.uid()
        OR organization_id IN (SELECT id FROM public.organizations WHERE owner_profile_id = auth.uid())
        OR private.is_platform()
      );
  END IF;
END $$;

-- ── trial_days sur les plans établissements et mutuelles ──
UPDATE public.subscription_plans SET trial_days = 14
WHERE code IN ('est_cabinet','est_centre','est_clinique','est_clinique_plus',
               'mutual_start','mutual_pro','mutual_enterprise')
  AND trial_days = 0;

-- ── SEED : promo_codes ────────────────────────────────────
INSERT INTO public.promo_codes
  (code, discount_type, discount_value, applies_to, plan_codes, max_redemptions, valid_from, valid_until, duration_months, active)
VALUES
  ('fonda20',  'percent', 20, 'subscription', null,              null, now(), now() + interval '1 year',   3, true),
  ('solo50',   'percent', 50, 'subscription', ARRAY['pro_solo'], 500,  now(), now() + interval '6 months', 1, true),
  ('retour30', 'percent', 30, 'subscription', null,              null, now(), now() + interval '1 year',   1, true),
  ('moussa10', 'percent', 10, 'subscription', null,              null, now(), now() + interval '3 months', 1, true)
ON CONFLICT (code) DO NOTHING;

-- ── apply_commission SECURITY DEFINER ─────────────────────
CREATE OR REPLACE FUNCTION public.apply_commission(p_reservation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id      uuid;
  v_gross       integer;
  v_rate        numeric(5,2);
  v_cap         integer;
  v_commission  integer;
  v_cap_default integer;
BEGIN
  SELECT e.organization_id, r.total_amount
  INTO v_org_id, v_gross
  FROM public.pharmacy_reservations r
  JOIN public.establishments e ON e.id = r.pharmacy_id
  WHERE r.id = p_reservation_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found'; END IF;

  SELECT sp.transaction_fee_percent, sp.transaction_fee_cap
  INTO v_rate, v_cap
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.organization_id = v_org_id
    AND s.subscriber_type = 'pharmacy'
    AND s.status IN ('active','trialing')
  ORDER BY s.created_at DESC LIMIT 1;

  IF v_rate IS NULL THEN
    SELECT transaction_fee_percent, transaction_fee_cap
    INTO v_rate, v_cap
    FROM public.subscription_plans WHERE code = 'pharmacy_free';
  END IF;

  SELECT COALESCE(
    (SELECT value::integer FROM public.platform_settings WHERE key = 'commission_cap_default'),
    5000
  ) INTO v_cap_default;

  v_commission := LEAST(
    ROUND(v_gross * v_rate / 100)::integer,
    COALESCE(v_cap, v_cap_default)
  );

  INSERT INTO public.commission_entries (organization_id, reservation_id, amount, rate)
  VALUES (v_org_id, p_reservation_id, v_commission, v_rate)
  ON CONFLICT DO NOTHING;
END;
$$;

-- ── reset_plan_credits SECURITY DEFINER ──────────────────
CREATE OR REPLACE FUNCTION public.reset_plan_credits(
  p_profile_id      uuid,
  p_organization_id uuid,
  p_owner_type      text,
  p_credits         integer
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_wallet_id       uuid;
  v_purchased       integer;
BEGIN
  -- Trouver le wallet existant
  IF p_profile_id IS NOT NULL THEN
    SELECT id INTO v_wallet_id FROM public.credit_wallets WHERE profile_id = p_profile_id LIMIT 1;
  ELSIF p_organization_id IS NOT NULL THEN
    SELECT id INTO v_wallet_id FROM public.credit_wallets WHERE organization_id = p_organization_id LIMIT 1;
  END IF;

  IF v_wallet_id IS NULL THEN
    -- Créer le wallet
    INSERT INTO public.credit_wallets
      (profile_id, organization_id, owner_type, plan_credits, plan_credits_total, purchased_credits, plan_credits_reset_at)
    VALUES
      (p_profile_id, p_organization_id, p_owner_type, p_credits, p_credits, 0, now())
    RETURNING id INTO v_wallet_id;
    v_purchased := 0;
  ELSE
    -- Mettre à jour
    UPDATE public.credit_wallets SET
      plan_credits       = p_credits,
      plan_credits_total = p_credits,
      plan_credits_reset_at = now(),
      updated_at         = now()
    WHERE id = v_wallet_id
    RETURNING purchased_credits INTO v_purchased;
  END IF;

  -- Log la transaction
  INSERT INTO public.credit_transactions (wallet_id, type, amount, balance_after, description)
  VALUES (v_wallet_id, 'plan_reset', p_credits, p_credits + COALESCE(v_purchased, 0), 'Réinitialisation mensuelle des crédits');
END;
$$;

-- ── Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ai_gen_profile_b5 ON public.ai_generations(profile_id, created_at);
CREATE INDEX IF NOT EXISTS idx_credit_tx_wallet_b5 ON public.credit_transactions(wallet_id, created_at);
CREATE INDEX IF NOT EXISTS idx_subs_org_b5 ON public.subscriptions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_subs_profile_b5 ON public.subscriptions(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_wallets_profile_b5 ON public.credit_wallets(profile_id);
CREATE INDEX IF NOT EXISTS idx_wallets_org_b5 ON public.credit_wallets(organization_id);
