-- ============================================================
-- 0011_tables_subscriptions_credits.sql — Modèle économique
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- SUBSCRIPTION_PLANS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.subscription_plans (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                    public.plan_code UNIQUE NOT NULL,
  actor_type              public.actor_type NOT NULL,
  name                    text NOT NULL,
  monthly_price           integer NOT NULL DEFAULT 0,
  yearly_price            integer NOT NULL DEFAULT 0,
  transaction_fee_percent numeric(5,2) DEFAULT 0,
  transaction_fee_cap     integer,
  included_ai_credits     integer DEFAULT 0,
  max_users               integer,
  max_locations           integer,
  max_appointments_monthly integer,
  max_members             integer,
  stripe_price_id_monthly text,
  stripe_price_id_yearly  text,
  stripe_product_id       text,
  public                  boolean DEFAULT true,
  position                integer DEFAULT 0,
  status                  text DEFAULT 'active',
  created_at              timestamptz DEFAULT now() NOT NULL,
  updated_at              timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_subscription_plans_actor ON public.subscription_plans(actor_type, status);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Données de base des plans (montants XOF)
INSERT INTO public.subscription_plans
  (code, actor_type, name, monthly_price, yearly_price, transaction_fee_percent, transaction_fee_cap, included_ai_credits, max_users, max_appointments_monthly, position)
VALUES
  -- PATIENT
  ('patient_free',        'patient',            'Patient Gratuit',       0,      0,      0,    NULL, 10,  1, 20,   0),
  -- PROFESSIONNEL
  ('pro_free',            'professional',       'Pro Gratuit',           0,      0,      0,    NULL, 0,   1, 20,   0),
  ('pro_solo',            'professional',       'Pro Solo',              9900,   99000,  0,    NULL, 30,  1, NULL, 1),
  ('pro_pro',             'professional',       'Pro Pro',               19900,  199000, 0,    NULL, 150, 1, NULL, 2),
  ('pro_expert',          'professional',       'Pro Expert',            39900,  399000, 0,    NULL, 500, 1, NULL, 3),
  -- PHARMACIE
  ('pharmacy_free',       'pharmacy',           'Pharmacie Gratuit',     0,      0,      5,    5000, 0,   2, NULL, 0),
  ('pharmacy_start',      'pharmacy',           'Pharmacie Start',       5900,   59000,  5,    5000, 20,  3, NULL, 1),
  ('pharmacy_pro',        'pharmacy',           'Pharmacie Pro',         14900,  149000, 4,    4000, 100, 5, NULL, 2),
  ('pharmacy_premium',    'pharmacy',           'Pharmacie Premium',     29900,  299000, 3,    3000, 300, 10,NULL, 3),
  -- ÉTABLISSEMENT
  ('est_cabinet',         'establishment',      'Cabinet',               9900,   99000,  0,    NULL, 20,  3, NULL, 0),
  ('est_centre',          'establishment',      'Centre Médical',        39900,  399000, 0,    NULL, 100, 5, NULL, 1),
  ('est_clinique',        'establishment',      'Clinique',              79900,  799000, 0,    NULL, 300, 10,NULL, 2),
  ('est_clinique_plus',   'establishment',      'Clinique+',             149900, 1490000,0,    NULL, 500, 20,NULL, 3),
  -- MUTUELLE
  ('mutual_start',        'insurance_provider', 'Mutuelle Start',        29900,  299000, 0,    NULL, 20,  3, NULL, 0),
  ('mutual_pro',          'insurance_provider', 'Mutuelle Pro',          79900,  799000, 0,    NULL, 50,  10,NULL, 1),
  ('mutual_enterprise',   'insurance_provider', 'Mutuelle Enterprise',   149900, 1490000,0,    NULL, 200, 25,NULL, 2);

-- ────────────────────────────────────────────────────────────
-- PLAN_FEATURES
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.plan_features (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled     boolean NOT NULL DEFAULT false,
  limit_value integer,
  created_at  timestamptz DEFAULT now() NOT NULL,
  UNIQUE (plan_id, feature_key)
);

ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- SUBSCRIPTIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_type       text NOT NULL CHECK (subscriber_type IN ('profile','organization')),
  profile_id            uuid REFERENCES public.profiles(id),
  organization_id       uuid REFERENCES public.organizations(id),
  plan_id               uuid NOT NULL REFERENCES public.subscription_plans(id),
  billing_interval      public.billing_interval NOT NULL DEFAULT 'monthly',
  status                public.subscription_status DEFAULT 'active',
  stripe_customer_id    text,
  stripe_subscription_id text UNIQUE,
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  cancel_at_period_end  boolean DEFAULT false,
  trial_ends_at         timestamptz,
  promo_code_id         uuid, -- FK promo_codes
  extra_users           int DEFAULT 0,
  changed_by            uuid REFERENCES public.profiles(id),
  created_at            timestamptz DEFAULT now() NOT NULL,
  updated_at            timestamptz DEFAULT now() NOT NULL
);

-- Un seul abonnement actif par entité
CREATE UNIQUE INDEX idx_subscriptions_profile_active
  ON public.subscriptions(profile_id)
  WHERE status IN ('active','trialing','past_due') AND profile_id IS NOT NULL;

CREATE UNIQUE INDEX idx_subscriptions_org_active
  ON public.subscriptions(organization_id)
  WHERE status IN ('active','trialing','past_due') AND organization_id IS NOT NULL;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FK différées → subscriptions
ALTER TABLE public.payments
  ADD CONSTRAINT fk_payment_subscription
  FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE SET NULL;

ALTER TABLE public.invoices
  ADD CONSTRAINT fk_invoice_subscription
  FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- SUBSCRIPTION_EVENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.subscription_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  event_type      text NOT NULL,
  old_plan_id     uuid REFERENCES public.subscription_plans(id),
  new_plan_id     uuid REFERENCES public.subscription_plans(id),
  stripe_event_id text,
  actor           uuid REFERENCES public.profiles(id),
  created_at      timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- USAGE_EVENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.usage_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  profile_id      uuid REFERENCES public.profiles(id),
  feature_key     text NOT NULL,
  quantity        int DEFAULT 1,
  period_month    date NOT NULL, -- 1er du mois
  entity_id       uuid,
  created_at      timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_usage_events_profile_period ON public.usage_events(profile_id, feature_key, period_month);
CREATE INDEX idx_usage_events_org_period ON public.usage_events(organization_id, feature_key, period_month);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- CREDIT_WALLETS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.credit_wallets (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type            text NOT NULL CHECK (owner_type IN ('profile','organization')),
  profile_id            uuid UNIQUE REFERENCES public.profiles(id),
  organization_id       uuid UNIQUE REFERENCES public.organizations(id),
  plan_credits          integer DEFAULT 0 CHECK (plan_credits >= 0),
  purchased_credits     integer DEFAULT 0 CHECK (purchased_credits >= 0),
  plan_credits_reset_at timestamptz,
  created_at            timestamptz DEFAULT now() NOT NULL,
  updated_at            timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.credit_wallets ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_credit_wallets_updated_at
  BEFORE UPDATE ON public.credit_wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- CREDIT_TRANSACTIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.credit_transactions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id             uuid NOT NULL REFERENCES public.credit_wallets(id),
  type                  public.credit_transaction_type NOT NULL,
  amount                integer NOT NULL, -- positif = crédit, négatif = débit
  balance_after         integer NOT NULL,
  ai_generation_id      uuid, -- FK ai_generations
  credit_pack_purchase_id uuid, -- FK credit_pack_purchases
  performed_by          uuid REFERENCES public.profiles(id),
  reason                text,
  created_at            timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_credit_transactions_wallet ON public.credit_transactions(wallet_id, created_at);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Fonctions de gestion des crédits IA (atomiques)
CREATE OR REPLACE FUNCTION private.charge_credits(
  p_wallet_id uuid,
  p_amount    int,
  p_generation_id uuid DEFAULT NULL,
  p_reason    text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_plan_credits      int;
  v_purchased_credits int;
  v_plan_debit        int;
  v_purchased_debit   int;
  v_new_plan          int;
  v_new_purchased     int;
  v_balance_after     int;
BEGIN
  SELECT plan_credits, purchased_credits
  INTO v_plan_credits, v_purchased_credits
  FROM public.credit_wallets WHERE id = p_wallet_id FOR UPDATE;

  IF v_plan_credits + v_purchased_credits < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS: Crédits IA insuffisants'
      USING ERRCODE = 'P0004';
  END IF;

  -- Débite d'abord les crédits de plan, puis les achetés
  v_plan_debit      := least(p_amount, v_plan_credits);
  v_purchased_debit := p_amount - v_plan_debit;
  v_new_plan        := v_plan_credits - v_plan_debit;
  v_new_purchased   := v_purchased_credits - v_purchased_debit;
  v_balance_after   := v_new_plan + v_new_purchased;

  UPDATE public.credit_wallets
  SET plan_credits = v_new_plan, purchased_credits = v_new_purchased
  WHERE id = p_wallet_id;

  INSERT INTO public.credit_transactions
    (wallet_id, type, amount, balance_after, ai_generation_id, reason)
  VALUES
    (p_wallet_id, 'consumption', -p_amount, v_balance_after, p_generation_id, p_reason);
END;
$$;

CREATE OR REPLACE FUNCTION private.refund_credits(
  p_wallet_id uuid,
  p_amount    int,
  p_generation_id uuid DEFAULT NULL,
  p_reason    text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_balance_after int; BEGIN
  UPDATE public.credit_wallets
  SET purchased_credits = purchased_credits + p_amount
  WHERE id = p_wallet_id
  RETURNING plan_credits + purchased_credits INTO v_balance_after;

  INSERT INTO public.credit_transactions
    (wallet_id, type, amount, balance_after, ai_generation_id, reason)
  VALUES
    (p_wallet_id, 'refund', p_amount, v_balance_after, p_generation_id, p_reason);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- CREDIT_PACKS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.credit_packs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text UNIQUE NOT NULL,
  name           text NOT NULL,
  credits        integer NOT NULL,
  price          integer NOT NULL,
  stripe_price_id text,
  position       integer DEFAULT 0,
  active         boolean DEFAULT true,
  created_at     timestamptz DEFAULT now() NOT NULL
);

-- 4 packs de crédits
INSERT INTO public.credit_packs (code, name, credits, price, position)
VALUES
  ('pack_decouverte', 'Pack Découverte', 50,   4900,  0),
  ('pack_standard',   'Pack Standard',   150,  11900, 1),
  ('pack_pro',        'Pack Pro',        500,  34900, 2),
  ('pack_max',        'Pack Max',        1500, 89900, 3);

ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- CREDIT_PACK_PURCHASES
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.credit_pack_purchases (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id        uuid NOT NULL REFERENCES public.credit_packs(id),
  wallet_id      uuid NOT NULL REFERENCES public.credit_wallets(id),
  payment_id     uuid REFERENCES public.payments(id),
  credits        integer NOT NULL,
  amount_paid    integer NOT NULL,
  promo_code_id  uuid, -- FK promo_codes
  status         public.payment_status DEFAULT 'pending',
  created_at     timestamptz DEFAULT now() NOT NULL,
  updated_at     timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.credit_pack_purchases ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_credit_pack_purchases_updated_at
  BEFORE UPDATE ON public.credit_pack_purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FK différées → credit_pack_purchases
ALTER TABLE public.payments
  ADD CONSTRAINT fk_payment_credit_pack
  FOREIGN KEY (credit_pack_purchase_id) REFERENCES public.credit_pack_purchases(id) ON DELETE SET NULL;

ALTER TABLE public.credit_transactions
  ADD CONSTRAINT fk_credit_tx_pack_purchase
  FOREIGN KEY (credit_pack_purchase_id) REFERENCES public.credit_pack_purchases(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- PROMO_CODES
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.promo_codes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              citext UNIQUE NOT NULL
    CHECK (code ~ '^[a-z]+[0-9]{2}$'),
  discount_type     text NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value    integer NOT NULL,
  applies_to        text[] NOT NULL, -- subscription, credit_pack
  plan_codes        public.plan_code[],
  max_redemptions   integer,
  redemptions_count integer DEFAULT 0,
  valid_from        timestamptz,
  valid_until       timestamptz,
  stripe_coupon_id  text,
  active            boolean DEFAULT true,
  created_by        uuid REFERENCES public.profiles(id),
  created_at        timestamptz DEFAULT now() NOT NULL,
  updated_at        timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_promo_codes_updated_at
  BEFORE UPDATE ON public.promo_codes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- PROMO_CODE_REDEMPTIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.promo_code_redemptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id            uuid NOT NULL REFERENCES public.promo_codes(id),
  profile_id               uuid NOT NULL REFERENCES public.profiles(id),
  organization_id          uuid REFERENCES public.organizations(id),
  subscription_id          uuid REFERENCES public.subscriptions(id),
  credit_pack_purchase_id  uuid REFERENCES public.credit_pack_purchases(id),
  discount_amount          integer NOT NULL,
  created_at               timestamptz DEFAULT now() NOT NULL,
  UNIQUE (promo_code_id, profile_id)
);

ALTER TABLE public.promo_code_redemptions ENABLE ROW LEVEL SECURITY;

-- FK différées : subscriptions → promo_codes
ALTER TABLE public.subscriptions
  ADD CONSTRAINT fk_subscription_promo
  FOREIGN KEY (promo_code_id) REFERENCES public.promo_codes(id) ON DELETE SET NULL;

ALTER TABLE public.credit_pack_purchases
  ADD CONSTRAINT fk_pack_purchase_promo
  FOREIGN KEY (promo_code_id) REFERENCES public.promo_codes(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- AI_GENERATIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.ai_generations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action           public.ai_action NOT NULL,
  profile_id       uuid NOT NULL REFERENCES public.profiles(id),
  organization_id  uuid REFERENCES public.organizations(id),
  wallet_id        uuid NOT NULL REFERENCES public.credit_wallets(id),
  credits_charged  integer NOT NULL,
  model            text NOT NULL,
  prompt_version   text,
  input_tokens     integer,
  output_tokens    integer,
  audio_seconds    numeric(8,2),
  provider_cost_usd numeric(10,6),
  provider_cost_xof integer,
  status           public.ai_generation_status DEFAULT 'started',
  error_code       text,
  error_message    text,
  entity_type      text,
  entity_id        uuid,
  latency_ms       integer,
  created_at       timestamptz DEFAULT now() NOT NULL,
  updated_at       timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_ai_generations_profile ON public.ai_generations(profile_id, created_at);
CREATE INDEX idx_ai_generations_org ON public.ai_generations(organization_id, created_at);

ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_ai_generations_updated_at
  BEFORE UPDATE ON public.ai_generations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FK différées : credit_transactions → ai_generations
ALTER TABLE public.credit_transactions
  ADD CONSTRAINT fk_credit_tx_ai_generation
  FOREIGN KEY (ai_generation_id) REFERENCES public.ai_generations(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- APPLY_COMMISSION (déplacée ici car référence subscriptions)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.apply_commission(p_reservation_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  r   public.pharmacy_reservations%ROWTYPE;
  s   public.subscriptions%ROWTYPE;
  pl  public.subscription_plans%ROWTYPE;
  v_rate numeric(5,2);
  v_cap  integer;
  v_comm integer;
  v_net  integer;
BEGIN
  SELECT * INTO r FROM public.pharmacy_reservations WHERE id = p_reservation_id;

  SELECT s.* INTO s FROM public.subscriptions s
  WHERE s.organization_id = r.organization_id
    AND s.status IN ('active','trialing');

  IF FOUND THEN
    SELECT * INTO pl FROM public.subscription_plans WHERE id = s.plan_id;
    v_rate := pl.transaction_fee_percent;
    v_cap  := pl.transaction_fee_cap;
  ELSE
    v_rate := 5;
    v_cap  := 5000;
  END IF;

  v_comm := least(
    (r.total_amount * v_rate / 100)::int,
    COALESCE(v_cap, 2147483647)
  );
  v_net := r.total_amount - v_comm;

  INSERT INTO public.commission_entries (
    reservation_id, organization_id, plan_code,
    gross_amount, rate, cap, commission_amount, net_amount
  ) VALUES (
    p_reservation_id, r.organization_id,
    COALESCE(pl.code, 'pharmacy_free'),
    r.total_amount, v_rate, v_cap, v_comm, v_net
  );

  UPDATE public.pharmacy_reservations
  SET commission_amount = v_comm, commission_rate = v_rate
  WHERE id = p_reservation_id;
END;
$$;
