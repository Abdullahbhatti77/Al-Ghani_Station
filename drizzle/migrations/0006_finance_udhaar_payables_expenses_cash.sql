
-- ===== customers =====
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id),
  name text NOT NULL CHECK (length(trim(name)) >= 2),
  business_name text,
  phone text,
  address text,
  vehicles text[] NOT NULL DEFAULT '{}',
  credit_limit numeric CHECK (credit_limit IS NULL OR credit_limit >= 0),
  opening_balance numeric NOT NULL DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read customers" ON public.customers FOR SELECT TO authenticated USING (public.is_station_member(station_id, auth.uid()));
CREATE POLICY "managers insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.has_station_role(station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]));
CREATE POLICY "managers update customers" ON public.customers FOR UPDATE TO authenticated USING (public.has_station_role(station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[])) WITH CHECK (public.has_station_role(station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]));
CREATE TRIGGER customers_touch BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.customer_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  kind text NOT NULL CHECK (kind IN ('credit_sale','payment')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  shift_id uuid REFERENCES public.shifts(id),
  product_id uuid REFERENCES public.products(id),
  litres numeric,
  rate numeric,
  price_id uuid REFERENCES public.fuel_prices(id),
  amount numeric NOT NULL CHECK (amount > 0),
  method text CHECK (method IS NULL OR method IN ('cash','bank','card','wallet','other')),
  reference text,
  vehicle text,
  notes text,
  over_limit boolean NOT NULL DEFAULT false,
  approved_by uuid,
  approval_reason text,
  client_key uuid NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text
);
CREATE INDEX ON public.customer_transactions (customer_id);
CREATE INDEX ON public.customer_transactions (shift_id);
GRANT SELECT ON public.customer_transactions TO authenticated;
GRANT ALL ON public.customer_transactions TO service_role;
ALTER TABLE public.customer_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read customer txns" ON public.customer_transactions FOR SELECT TO authenticated USING (public.is_station_member(station_id, auth.uid()));

-- ===== supplier payments =====
CREATE TABLE public.supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  paid_at timestamptz NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  method text NOT NULL CHECK (method IN ('cash','bank','cheque','wallet','other')),
  reference text,
  notes text,
  client_key uuid NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text
);
CREATE INDEX ON public.supplier_payments (supplier_id);
GRANT SELECT ON public.supplier_payments TO authenticated;
GRANT ALL ON public.supplier_payments TO service_role;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read supplier payments" ON public.supplier_payments FOR SELECT TO authenticated USING (public.is_station_member(station_id, auth.uid()));

-- ===== expenses =====
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id),
  name text NOT NULL CHECK (length(trim(name)) >= 2),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX expense_categories_name_uq ON public.expense_categories (station_id, lower(trim(name)));
GRANT SELECT, INSERT, UPDATE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read categories" ON public.expense_categories FOR SELECT TO authenticated USING (public.is_station_member(station_id, auth.uid()));
CREATE POLICY "managers insert categories" ON public.expense_categories FOR INSERT TO authenticated WITH CHECK (public.has_station_role(station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]));
CREATE POLICY "managers update categories" ON public.expense_categories FOR UPDATE TO authenticated USING (public.has_station_role(station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[])) WITH CHECK (public.has_station_role(station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]));
CREATE TRIGGER expense_categories_touch BEFORE UPDATE ON public.expense_categories FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id),
  category_id uuid NOT NULL REFERENCES public.expense_categories(id),
  occurred_at timestamptz NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  method text NOT NULL CHECK (method IN ('drawer','bank','other')),
  shift_id uuid REFERENCES public.shifts(id),
  reference text,
  client_key uuid NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text,
  CHECK ((method = 'drawer') = (shift_id IS NOT NULL))
);
CREATE INDEX ON public.expenses (station_id, occurred_at);
CREATE INDEX ON public.expenses (shift_id);
GRANT SELECT ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read expenses" ON public.expenses FOR SELECT TO authenticated USING (public.is_station_member(station_id, auth.uid()));

-- ===== shift drawer cash movements =====
CREATE TABLE public.shift_cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id),
  shift_id uuid NOT NULL REFERENCES public.shifts(id),
  kind text NOT NULL CHECK (kind IN ('cash_in','cash_out')),
  amount numeric NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  client_key uuid NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz,
  reversed_by uuid
);
CREATE INDEX ON public.shift_cash_movements (shift_id);
GRANT SELECT ON public.shift_cash_movements TO authenticated;
GRANT ALL ON public.shift_cash_movements TO service_role;
ALTER TABLE public.shift_cash_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read cash movements" ON public.shift_cash_movements FOR SELECT TO authenticated USING (public.is_station_member(station_id, auth.uid()));

-- ===== shift columns =====
ALTER TABLE public.shifts
  ADD COLUMN cash_counted numeric CHECK (cash_counted IS NULL OR cash_counted >= 0),
  ADD COLUMN credit_sales numeric NOT NULL DEFAULT 0,
  ADD COLUMN cash_repayments numeric NOT NULL DEFAULT 0,
  ADD COLUMN cash_in numeric NOT NULL DEFAULT 0,
  ADD COLUMN drawer_expenses numeric NOT NULL DEFAULT 0,
  ADD COLUMN cash_out numeric NOT NULL DEFAULT 0,
  ADD COLUMN drawer_expected numeric,
  ADD COLUMN cash_variance numeric,
  ADD COLUMN variance_reason text,
  ADD COLUMN variance_approved_by uuid;

-- ===== balances =====
CREATE OR REPLACE FUNCTION public.customer_balance(_customer_id uuid) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.opening_balance + coalesce((SELECT sum(CASE WHEN t.kind = 'credit_sale' THEN t.amount ELSE -t.amount END)
    FROM public.customer_transactions t WHERE t.customer_id = c.id AND t.reversed_at IS NULL), 0)
  FROM public.customers c WHERE c.id = _customer_id AND public.is_station_member(c.station_id, auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.supplier_balance(_supplier_id uuid) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.opening_payable
    + coalesce((SELECT sum(d.invoice_amount) FROM public.fuel_deliveries d WHERE d.supplier_id = s.id AND d.reversed_at IS NULL), 0)
    - coalesce((SELECT sum(p.amount) FROM public.supplier_payments p WHERE p.supplier_id = s.id AND p.reversed_at IS NULL), 0)
  FROM public.suppliers s WHERE s.id = _supplier_id AND public.is_station_member(s.station_id, auth.uid())
$$;

-- Opening balances lock once transactions exist (balances must stay derived)
CREATE OR REPLACE FUNCTION public.guard_customer_opening() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.opening_balance IS DISTINCT FROM OLD.opening_balance
     AND EXISTS (SELECT 1 FROM public.customer_transactions WHERE customer_id = OLD.id) THEN
    RAISE EXCEPTION 'opening_locked'; END IF;
  IF NEW.station_id <> OLD.station_id THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER customers_guard BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.guard_customer_opening();

CREATE OR REPLACE FUNCTION public.guard_supplier_opening() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.opening_payable IS DISTINCT FROM OLD.opening_payable
     AND (EXISTS (SELECT 1 FROM public.fuel_deliveries WHERE supplier_id = OLD.id)
       OR EXISTS (SELECT 1 FROM public.supplier_payments WHERE supplier_id = OLD.id)) THEN
    RAISE EXCEPTION 'opening_locked'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER suppliers_guard_opening BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.guard_supplier_opening();

-- ===== starter expense categories =====
CREATE OR REPLACE FUNCTION public.seed_expense_categories() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.expense_categories (station_id, name)
  SELECT NEW.id, n FROM unnest(ARRAY['Salaries','Electricity','Repairs','Refreshments','Station Supplies','Other']) n
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER stations_seed_categories AFTER INSERT ON public.stations FOR EACH ROW EXECUTE FUNCTION public.seed_expense_categories();
INSERT INTO public.expense_categories (station_id, name)
SELECT s.id, n FROM public.stations s, unnest(ARRAY['Salaries','Electricity','Repairs','Refreshments','Station Supplies','Other']) n
ON CONFLICT DO NOTHING;

-- ===== shift totals (meter formula unchanged; adds credit + drawer) =====
CREATE OR REPLACE FUNCTION public._total_shift(_shift_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _credit numeric; _rep numeric; _in numeric; _out numeric; _exp numeric;
BEGIN
  SELECT coalesce(sum(amount),0) INTO _credit FROM public.customer_transactions WHERE shift_id = _shift_id AND kind = 'credit_sale' AND reversed_at IS NULL;
  SELECT coalesce(sum(amount),0) INTO _rep FROM public.customer_transactions WHERE shift_id = _shift_id AND kind = 'payment' AND method = 'cash' AND reversed_at IS NULL;
  SELECT coalesce(sum(amount) FILTER (WHERE kind='cash_in'),0), coalesce(sum(amount) FILTER (WHERE kind='cash_out'),0) INTO _in, _out
    FROM public.shift_cash_movements WHERE shift_id = _shift_id AND reversed_at IS NULL;
  SELECT coalesce(sum(amount),0) INTO _exp FROM public.expenses WHERE shift_id = _shift_id AND method = 'drawer' AND reversed_at IS NULL;
  UPDATE public.shifts s SET
    total_litres = x.l, total_sales = x.a,
    total_collected = s.cash_received + s.bank_received + s.card_received + s.wallet_received + s.other_received,
    credit_sales = _credit, cash_repayments = _rep, cash_in = _in, cash_out = _out, drawer_expenses = _exp,
    difference = (s.cash_received + s.bank_received + s.card_received + s.wallet_received + s.other_received) + _credit - x.a,
    drawer_expected = s.opening_float + s.cash_received + _rep + _in - _exp - _out,
    cash_variance = CASE WHEN s.cash_counted IS NULL THEN NULL ELSE s.cash_counted - (s.opening_float + s.cash_received + _rep + _in - _exp - _out) END
  FROM (SELECT coalesce(sum(litres_sold),0) l, coalesce(sum(amount),0) a FROM public.shift_readings WHERE shift_id = _shift_id) x
  WHERE s.id = _shift_id;
END $$;

-- draft save also stores counted cash
CREATE OR REPLACE FUNCTION public.save_shift_draft(_shift_id uuid, _header jsonb, _readings jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s public.shifts%ROWTYPE; _r jsonb;
BEGIN
  SELECT * INTO _s FROM public.shifts WHERE id = _shift_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_station_member(_s.station_id, auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _s.status <> 'draft' THEN RAISE EXCEPTION 'shift_closed'; END IF;
  IF _header ? 'attendant_id' AND NOT public.is_station_member(_s.station_id, (_header->>'attendant_id')::uuid) THEN RAISE EXCEPTION 'bad_attendant'; END IF;
  UPDATE public.shifts SET
    name = coalesce(nullif(trim(_header->>'name'), ''), name),
    attendant_id = coalesce((_header->>'attendant_id')::uuid, attendant_id),
    opening_float = coalesce((_header->>'opening_float')::numeric, opening_float),
    cash_received = coalesce((_header->>'cash_received')::numeric, cash_received),
    bank_received = coalesce((_header->>'bank_received')::numeric, bank_received),
    card_received = coalesce((_header->>'card_received')::numeric, card_received),
    wallet_received = coalesce((_header->>'wallet_received')::numeric, wallet_received),
    other_received = coalesce((_header->>'other_received')::numeric, other_received),
    cash_counted = CASE WHEN _header ? 'cash_counted' THEN (_header->>'cash_counted')::numeric ELSE cash_counted END,
    notes = CASE WHEN _header ? 'notes' THEN _header->>'notes' ELSE notes END
  WHERE id = _shift_id;
  FOR _r IN SELECT * FROM jsonb_array_elements(coalesce(_readings, '[]'::jsonb)) LOOP
    UPDATE public.shift_readings SET
      closing_reading = CASE WHEN _r ? 'closing_reading' THEN (_r->>'closing_reading')::numeric ELSE closing_reading END,
      test_litres = coalesce((_r->>'test_litres')::numeric, test_litres)
    WHERE id = (_r->>'id')::uuid AND shift_id = _shift_id;
  END LOOP;
END $$;

DROP FUNCTION public.close_shift(uuid);
CREATE FUNCTION public.close_shift(_shift_id uuid, _reason text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s public.shifts%ROWTYPE; _r record;
BEGIN
  SELECT * INTO _s FROM public.shifts WHERE id = _shift_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_station_member(_s.station_id, auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _s.status <> 'draft' THEN RAISE EXCEPTION 'shift_already_closed'; END IF;
  IF _s.cash_counted IS NULL THEN RAISE EXCEPTION 'cash_count_missing'; END IF;
  FOR _r IN SELECT id FROM public.shift_readings WHERE shift_id = _shift_id FOR UPDATE LOOP
    PERFORM public._price_shift_reading(_r.id);
  END LOOP;
  PERFORM public._total_shift(_shift_id);
  SELECT * INTO _s FROM public.shifts WHERE id = _shift_id;
  IF abs(_s.difference) >= 0.005 OR abs(_s.cash_variance) >= 0.005 THEN
    IF NOT public.has_station_role(_s.station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]) THEN RAISE EXCEPTION 'variance_needs_manager'; END IF;
    IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
    UPDATE public.shifts SET variance_reason = trim(_reason), variance_approved_by = auth.uid() WHERE id = _shift_id;
    INSERT INTO public.shift_corrections (station_id, shift_id, field, old_value, new_value, reason, created_by)
    VALUES (_s.station_id, _shift_id, 'variance_override', _s.difference, _s.cash_variance, trim(_reason), auth.uid());
  END IF;
  UPDATE public.shift_readings SET is_draft = false WHERE shift_id = _shift_id;
  UPDATE public.nozzles n SET meter_reading = r.closing_reading FROM public.shift_readings r WHERE r.shift_id = _shift_id AND r.nozzle_id = n.id;
  UPDATE public.shifts SET status = 'closed', closed_by = auth.uid(), closed_at = now() WHERE id = _shift_id;
  INSERT INTO public.stock_movements (station_id, tank_id, kind, litres, occurred_at, source_id, shift_id, created_by)
  SELECT r.station_id, n.tank_id, 'sale', -r.litres_sold, now(), r.id, _shift_id, auth.uid()
  FROM public.shift_readings r JOIN public.nozzles n ON n.id = r.nozzle_id WHERE r.shift_id = _shift_id;
END $$;

-- helper: shift must be an open draft of this station
CREATE OR REPLACE FUNCTION public._open_shift(_station_id uuid, _shift_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM 1 FROM public.shifts WHERE id = _shift_id AND station_id = _station_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'bad_shift'; END IF;
  IF (SELECT status FROM public.shifts WHERE id = _shift_id) <> 'draft' THEN RAISE EXCEPTION 'shift_closed'; END IF;
END $$;

-- ===== customer RPCs =====
CREATE OR REPLACE FUNCTION public.record_credit_sale(_customer_id uuid, _shift_id uuid, _product_id uuid, _litres numeric, _amount numeric,
  _vehicle text, _reference text, _notes text, _approval_reason text, _client_key uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.customers%ROWTYPE; _s public.shifts%ROWTYPE; _p public.fuel_prices%ROWTYPE; _id uuid; _l numeric; _a numeric; _bal numeric; _over boolean := false;
BEGIN
  SELECT id INTO _id FROM public.customer_transactions WHERE client_key = _client_key;
  IF FOUND THEN RETURN _id; END IF;
  SELECT * INTO _c FROM public.customers WHERE id = _customer_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_station_member(_c.station_id, auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT _c.is_active THEN RAISE EXCEPTION 'customer_archived'; END IF;
  PERFORM public._open_shift(_c.station_id, _shift_id);
  SELECT * INTO _s FROM public.shifts WHERE id = _shift_id;
  SELECT * INTO _p FROM public.fuel_prices WHERE product_id = _product_id AND station_id = _c.station_id AND effective_at <= _s.price_at ORDER BY effective_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_price'; END IF;
  IF _litres IS NOT NULL AND _litres > 0 THEN _l := round(_litres, 2); _a := round(_l * _p.price_per_litre, 2);
  ELSIF _amount IS NOT NULL AND _amount > 0 THEN _a := round(_amount, 2); _l := round(_a / _p.price_per_litre, 2);
  ELSE RAISE EXCEPTION 'bad_amount'; END IF;
  _bal := public.customer_balance(_customer_id);
  IF _c.credit_limit IS NOT NULL AND _bal + _a > _c.credit_limit THEN
    IF _approval_reason IS NULL THEN RAISE EXCEPTION 'over_limit'; END IF;
    IF NOT public.has_station_role(_c.station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]) THEN RAISE EXCEPTION 'over_limit_needs_manager'; END IF;
    IF length(trim(_approval_reason)) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
    _over := true;
  END IF;
  INSERT INTO public.customer_transactions (station_id, customer_id, kind, shift_id, product_id, litres, rate, price_id, amount, vehicle, reference, notes,
    over_limit, approved_by, approval_reason, client_key, created_by)
  VALUES (_c.station_id, _customer_id, 'credit_sale', _shift_id, _product_id, _l, _p.price_per_litre, _p.id, _a, nullif(trim(_vehicle),''), nullif(trim(_reference),''), nullif(trim(_notes),''),
    _over, CASE WHEN _over THEN auth.uid() END, CASE WHEN _over THEN trim(_approval_reason) END, _client_key, auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.receive_customer_payment(_customer_id uuid, _amount numeric, _method text, _shift_id uuid,
  _occurred_at timestamptz, _reference text, _notes text, _client_key uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.customers%ROWTYPE; _id uuid;
BEGIN
  SELECT id INTO _id FROM public.customer_transactions WHERE client_key = _client_key;
  IF FOUND THEN RETURN _id; END IF;
  SELECT * INTO _c FROM public.customers WHERE id = _customer_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_station_member(_c.station_id, auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'bad_amount'; END IF;
  IF _method NOT IN ('cash','bank','card','wallet','other') THEN RAISE EXCEPTION 'bad_method'; END IF;
  IF _shift_id IS NOT NULL THEN
    IF _method <> 'cash' THEN RAISE EXCEPTION 'shift_cash_only'; END IF;
    PERFORM public._open_shift(_c.station_id, _shift_id);
  END IF;
  IF _occurred_at > now() + interval '5 minutes' THEN RAISE EXCEPTION 'future_date'; END IF;
  INSERT INTO public.customer_transactions (station_id, customer_id, kind, occurred_at, shift_id, amount, method, reference, notes, client_key, created_by)
  VALUES (_c.station_id, _customer_id, 'payment', coalesce(_occurred_at, now()), _shift_id, round(_amount,2), _method, nullif(trim(_reference),''), nullif(trim(_notes),''), _client_key, auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.reverse_customer_txn(_txn_id uuid, _reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t public.customer_transactions%ROWTYPE;
BEGIN
  SELECT * INTO _t FROM public.customer_transactions WHERE id = _txn_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_station_role(_t.station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _t.reversed_at IS NOT NULL THEN RAISE EXCEPTION 'already_reversed'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF _t.shift_id IS NOT NULL THEN PERFORM public._open_shift(_t.station_id, _t.shift_id); END IF;
  UPDATE public.customer_transactions SET reversed_at = now(), reversed_by = auth.uid(), reversal_reason = trim(_reason) WHERE id = _txn_id;
END $$;

-- ===== supplier RPCs =====
CREATE OR REPLACE FUNCTION public.pay_supplier(_supplier_id uuid, _amount numeric, _method text, _paid_at timestamptz, _reference text, _notes text, _client_key uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s public.suppliers%ROWTYPE; _id uuid;
BEGIN
  SELECT id INTO _id FROM public.supplier_payments WHERE client_key = _client_key;
  IF FOUND THEN RETURN _id; END IF;
  SELECT * INTO _s FROM public.suppliers WHERE id = _supplier_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_station_role(_s.station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'bad_amount'; END IF;
  IF _method NOT IN ('cash','bank','cheque','wallet','other') THEN RAISE EXCEPTION 'bad_method'; END IF;
  IF _paid_at > now() + interval '5 minutes' THEN RAISE EXCEPTION 'future_date'; END IF;
  IF nullif(trim(_reference),'') IS NOT NULL AND EXISTS (SELECT 1 FROM public.supplier_payments WHERE supplier_id = _supplier_id AND reversed_at IS NULL AND lower(trim(reference)) = lower(trim(_reference))) THEN
    RAISE EXCEPTION 'duplicate_payment'; END IF;
  INSERT INTO public.supplier_payments (station_id, supplier_id, paid_at, amount, method, reference, notes, client_key, created_by)
  VALUES (_s.station_id, _supplier_id, coalesce(_paid_at, now()), round(_amount,2), _method, nullif(trim(_reference),''), nullif(trim(_notes),''), _client_key, auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.reverse_supplier_payment(_payment_id uuid, _reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.supplier_payments%ROWTYPE;
BEGIN
  SELECT * INTO _p FROM public.supplier_payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_station_role(_p.station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _p.reversed_at IS NOT NULL THEN RAISE EXCEPTION 'already_reversed'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
  UPDATE public.supplier_payments SET reversed_at = now(), reversed_by = auth.uid(), reversal_reason = trim(_reason) WHERE id = _payment_id;
END $$;

-- ===== expense RPCs =====
CREATE OR REPLACE FUNCTION public.record_expense(_station_id uuid, _category_id uuid, _occurred_at timestamptz, _description text, _amount numeric,
  _method text, _shift_id uuid, _reference text, _client_key uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  SELECT id INTO _id FROM public.expenses WHERE client_key = _client_key;
  IF FOUND THEN RETURN _id; END IF;
  IF NOT public.is_station_member(_station_id, auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE id = _category_id AND station_id = _station_id AND is_active) THEN RAISE EXCEPTION 'bad_category'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'bad_amount'; END IF;
  IF _description IS NULL OR length(trim(_description)) < 2 THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF _method NOT IN ('drawer','bank','other') THEN RAISE EXCEPTION 'bad_method'; END IF;
  IF _method = 'drawer' THEN
    IF _shift_id IS NULL THEN RAISE EXCEPTION 'shift_required'; END IF;
    PERFORM public._open_shift(_station_id, _shift_id);
  ELSE _shift_id := NULL; END IF;
  IF _occurred_at > now() + interval '5 minutes' THEN RAISE EXCEPTION 'future_date'; END IF;
  INSERT INTO public.expenses (station_id, category_id, occurred_at, description, amount, method, shift_id, reference, client_key, created_by)
  VALUES (_station_id, _category_id, coalesce(_occurred_at, now()), trim(_description), round(_amount,2), _method, _shift_id, nullif(trim(_reference),''), _client_key, auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.reverse_expense(_expense_id uuid, _reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _e public.expenses%ROWTYPE;
BEGIN
  SELECT * INTO _e FROM public.expenses WHERE id = _expense_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_station_role(_e.station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _e.reversed_at IS NOT NULL THEN RAISE EXCEPTION 'already_reversed'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF _e.shift_id IS NOT NULL THEN PERFORM public._open_shift(_e.station_id, _e.shift_id); END IF;
  UPDATE public.expenses SET reversed_at = now(), reversed_by = auth.uid(), reversal_reason = trim(_reason) WHERE id = _expense_id;
END $$;

-- ===== drawer cash in/out =====
CREATE OR REPLACE FUNCTION public.record_shift_cash_movement(_shift_id uuid, _kind text, _amount numeric, _reason text, _client_key uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _st uuid; _id uuid;
BEGIN
  SELECT id INTO _id FROM public.shift_cash_movements WHERE client_key = _client_key;
  IF FOUND THEN RETURN _id; END IF;
  SELECT station_id INTO _st FROM public.shifts WHERE id = _shift_id;
  IF _st IS NULL OR NOT public.is_station_member(_st, auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM public._open_shift(_st, _shift_id);
  IF _kind NOT IN ('cash_in','cash_out') THEN RAISE EXCEPTION 'bad_method'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'bad_amount'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
  INSERT INTO public.shift_cash_movements (station_id, shift_id, kind, amount, reason, client_key, created_by)
  VALUES (_st, _shift_id, _kind, round(_amount,2), trim(_reason), _client_key, auth.uid()) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.reverse_shift_cash_movement(_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _m public.shift_cash_movements%ROWTYPE;
BEGIN
  SELECT * INTO _m FROM public.shift_cash_movements WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_station_member(_m.station_id, auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _m.reversed_at IS NOT NULL THEN RAISE EXCEPTION 'already_reversed'; END IF;
  PERFORM public._open_shift(_m.station_id, _m.shift_id);
  UPDATE public.shift_cash_movements SET reversed_at = now(), reversed_by = auth.uid() WHERE id = _id;
END $$;

-- ===== execute grants =====
REVOKE EXECUTE ON FUNCTION public._open_shift(uuid, uuid), public.seed_expense_categories(), public.guard_customer_opening(), public.guard_supplier_opening() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._total_shift(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.close_shift(uuid, text), public.customer_balance(uuid), public.supplier_balance(uuid),
  public.record_credit_sale(uuid, uuid, uuid, numeric, numeric, text, text, text, text, uuid),
  public.receive_customer_payment(uuid, numeric, text, uuid, timestamptz, text, text, uuid),
  public.reverse_customer_txn(uuid, text), public.pay_supplier(uuid, numeric, text, timestamptz, text, text, uuid),
  public.reverse_supplier_payment(uuid, text), public.record_expense(uuid, uuid, timestamptz, text, numeric, text, uuid, text, uuid),
  public.reverse_expense(uuid, text), public.record_shift_cash_movement(uuid, text, numeric, text, uuid), public.reverse_shift_cash_movement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_shift(uuid, text), public.customer_balance(uuid), public.supplier_balance(uuid),
  public.record_credit_sale(uuid, uuid, uuid, numeric, numeric, text, text, text, text, uuid),
  public.receive_customer_payment(uuid, numeric, text, uuid, timestamptz, text, text, uuid),
  public.reverse_customer_txn(uuid, text), public.pay_supplier(uuid, numeric, text, timestamptz, text, text, uuid),
  public.reverse_supplier_payment(uuid, text), public.record_expense(uuid, uuid, timestamptz, text, numeric, text, uuid, text, uuid),
  public.reverse_expense(uuid, text), public.record_shift_cash_movement(uuid, text, numeric, text, uuid), public.reverse_shift_cash_movement(uuid) TO authenticated;
