-- ============================================================
-- 0010_tables_payments_billing.sql — Paiements & Facturation
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PAYMENT_PROVIDERS (table de configuration des PSP)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.payment_providers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              public.payment_provider UNIQUE NOT NULL,
  label             text NOT NULL,
  enabled           boolean DEFAULT false,
  supports_methods  public.payment_method[],
  fee_percent       numeric(5,2) DEFAULT 0,
  fee_fixed         integer DEFAULT 0,
  config            jsonb DEFAULT '{}', -- config non secrète
  updated_by        uuid REFERENCES public.profiles(id),
  updated_at        timestamptz DEFAULT now() NOT NULL
);

-- Données initiales
INSERT INTO public.payment_providers (code, label, enabled, supports_methods)
VALUES
  ('stripe',       'Stripe',        true,  '{card}'),
  ('wave',         'Wave',          false, '{wave}'),
  ('orange_money', 'Orange Money',  false, '{orange_money}'),
  ('manual',       'Virement',      true,  '{bank_transfer}');

ALTER TABLE public.payment_providers ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- PAYMENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.payments (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number           text UNIQUE, -- PAY-########
  purpose                  public.payment_purpose NOT NULL,
  reservation_id           uuid REFERENCES public.pharmacy_reservations(id),
  appointment_id           uuid REFERENCES public.appointments(id),
  coverage_request_id      uuid REFERENCES public.coverage_requests(id),
  subscription_id          uuid, -- FK subscriptions migration 0011
  credit_pack_purchase_id  uuid, -- FK credit_pack_purchases migration 0011
  payer_type               public.payer_type,
  payer_id                 uuid NOT NULL, -- profile ou organization
  recipient_type           public.recipient_type,
  recipient_id             uuid NOT NULL,
  amount                   integer NOT NULL CHECK (amount > 0),
  currency                 char(3) DEFAULT 'XOF',
  payment_method           public.payment_method,
  provider                 public.payment_provider NOT NULL,
  provider_transaction_id  text,
  provider_checkout_url    text,
  reference_code           text, -- = reservation_code ou payment_number
  idempotency_key          text UNIQUE NOT NULL,
  status                   public.payment_status DEFAULT 'pending',
  failure_code             text,
  failure_message          text,
  provider_fee             integer DEFAULT 0,
  paid_at                  timestamptz,
  expires_at               timestamptz,
  metadata                 jsonb DEFAULT '{}',
  created_at               timestamptz DEFAULT now() NOT NULL,
  updated_at               timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_payments_reservation ON public.payments(reservation_id);
CREATE INDEX idx_payments_payer ON public.payments(payer_id, status);
CREATE INDEX idx_payments_provider_tx ON public.payments(provider, provider_transaction_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger : génère PAY-########
CREATE OR REPLACE FUNCTION public.generate_payment_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.payment_number IS NULL THEN
    NEW.payment_number := 'PAY-' || lpad(
      extract(epoch from now())::bigint::text, 8, '0'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_payment_number
  BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.generate_payment_number();

-- FK différées → payments
ALTER TABLE public.appointments
  ADD CONSTRAINT fk_appointment_payment
  FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;

ALTER TABLE public.coverage_requests
  ADD CONSTRAINT fk_coverage_payment
  FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- PAYMENT_EVENTS (webhooks PSP — idempotents)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.payment_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider         public.payment_provider NOT NULL,
  provider_event_id text NOT NULL,
  event_type       text NOT NULL,
  payment_id       uuid REFERENCES public.payments(id),
  payload_hash     text,
  payload          jsonb NOT NULL,
  signature_valid  boolean NOT NULL DEFAULT false,
  processed        boolean DEFAULT false,
  processed_at     timestamptz,
  processing_error text,
  created_at       timestamptz DEFAULT now() NOT NULL,
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX idx_payment_events_unprocessed ON public.payment_events(processed, created_at)
  WHERE processed = false;

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- REFUNDS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.refunds (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_number     text UNIQUE,
  payment_id        uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  reservation_id    uuid REFERENCES public.pharmacy_reservations(id),
  appointment_id    uuid REFERENCES public.appointments(id),
  requested_by      uuid REFERENCES public.profiles(id),
  approved_by       uuid REFERENCES public.profiles(id),
  amount            integer NOT NULL CHECK (amount > 0),
  reason            text NOT NULL,
  status            public.refund_status DEFAULT 'requested',
  provider_refund_id text,
  failure_message   text,
  completed_at      timestamptz,
  created_at        timestamptz DEFAULT now() NOT NULL,
  updated_at        timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_refunds_updated_at
  BEFORE UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- INVOICES
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  text UNIQUE, -- INV-YYYY-######
  invoice_type    text NOT NULL CHECK (invoice_type IN (
    'reservation','appointment','subscription','credit_pack','commission_statement'
  )),
  reservation_id  uuid REFERENCES public.pharmacy_reservations(id),
  appointment_id  uuid REFERENCES public.appointments(id),
  subscription_id uuid, -- FK subscriptions
  patient_id      uuid REFERENCES public.patients(id),
  organization_id uuid REFERENCES public.organizations(id),
  professional_id uuid REFERENCES public.professionals(id),
  total_amount    integer NOT NULL,
  insurance_amount integer DEFAULT 0,
  patient_amount  integer DEFAULT 0,
  tax_amount      integer DEFAULT 0,
  currency        char(3) DEFAULT 'XOF',
  status          public.invoice_status DEFAULT 'draft',
  pdf_document_id uuid REFERENCES public.documents(id),
  stripe_invoice_id text,
  issued_at       timestamptz,
  due_at          timestamptz,
  paid_at         timestamptz,
  created_at      timestamptz DEFAULT now() NOT NULL,
  updated_at      timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_invoices_patient ON public.invoices(patient_id, created_at);
CREATE INDEX idx_invoices_org ON public.invoices(organization_id, created_at);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger : génère INV-YYYY-######
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_year text := to_char(now(), 'YYYY');
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := 'INV-' || v_year || '-' || lpad(
      (SELECT count(*) + 1 FROM public.invoices
       WHERE invoice_number LIKE 'INV-' || v_year || '-%')::text, 6, '0'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_invoice_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.generate_invoice_number();

-- ────────────────────────────────────────────────────────────
-- COMMISSION_ENTRIES
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.commission_entries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id    uuid NOT NULL REFERENCES public.pharmacy_reservations(id),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id),
  plan_code         public.plan_code NOT NULL,
  gross_amount      integer NOT NULL,
  rate              numeric(5,2) NOT NULL,
  cap               integer,
  commission_amount integer NOT NULL,
  net_amount        integer NOT NULL,
  payout_id         uuid, -- FK payouts
  created_at        timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_commission_entries_org ON public.commission_entries(organization_id, created_at);

ALTER TABLE public.commission_entries ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- PAYOUTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.payouts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_type public.recipient_type NOT NULL,
  beneficiary_id   uuid NOT NULL,
  organization_id  uuid REFERENCES public.organizations(id),
  period_start     date NOT NULL,
  period_end       date NOT NULL,
  gross_amount     integer NOT NULL,
  commission_amount integer NOT NULL,
  net_amount       integer NOT NULL,
  status           public.payout_status DEFAULT 'pending',
  payment_provider public.payment_provider,
  provider_reference text,
  paid_at          timestamptz,
  created_by       uuid REFERENCES public.profiles(id),
  created_at       timestamptz DEFAULT now() NOT NULL,
  updated_at       timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_payouts_updated_at
  BEFORE UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FK différées : commission_entries → payouts
ALTER TABLE public.commission_entries
  ADD CONSTRAINT fk_commission_payout
  FOREIGN KEY (payout_id) REFERENCES public.payouts(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- REMINDERS (relances admin)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.reminders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target              public.reminder_target NOT NULL,
  reservation_id      uuid REFERENCES public.pharmacy_reservations(id),
  coverage_request_id uuid REFERENCES public.coverage_requests(id),
  payment_id          uuid REFERENCES public.payments(id),
  organization_id     uuid REFERENCES public.organizations(id),
  recipient_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  sent_by             uuid REFERENCES public.profiles(id),
  channel             public.notification_channel NOT NULL,
  message             text NOT NULL,
  sequence_number     int DEFAULT 1,
  next_due_at         timestamptz,
  created_at          timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- NOTE: private.apply_commission est définie dans 0011 (après subscription_plans)
