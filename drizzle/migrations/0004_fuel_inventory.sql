ALTER TABLE public.stations ADD COLUMN dip_variance_litres numeric(14,2) CHECK (dip_variance_litres IS NULL OR dip_variance_litres >= 0);
COMMENT ON COLUMN public.tanks.opening_stock_litres IS 'Opening stock at tank creation only. Live expected stock = sum of public.stock_movements.';

CREATE TABLE public.fuel_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  tank_id uuid NOT NULL REFERENCES public.tanks(id),
  delivered_at timestamptz NOT NULL,
  challan_no text NOT NULL CHECK (char_length(trim(challan_no)) BETWEEN 1 AND 60),
  litres numeric(14,2) NOT NULL CHECK (litres > 0),
  rate_per_litre numeric(12,2) NOT NULL CHECK (rate_per_litre > 0),
  calculated_amount numeric(14,2) NOT NULL,
  invoice_amount numeric(14,2) NOT NULL CHECK (invoice_amount >= 0),
  notes text,
  received_by uuid NOT NULL,
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX fuel_deliveries_unique_challan ON public.fuel_deliveries (station_id, supplier_id, lower(trim(challan_no)));
GRANT SELECT ON public.fuel_deliveries TO authenticated;
GRANT ALL ON public.fuel_deliveries TO service_role;
ALTER TABLE public.fuel_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read deliveries" ON public.fuel_deliveries FOR SELECT TO authenticated USING (public.is_station_member(station_id, auth.uid()));

CREATE TABLE public.tank_dips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id),
  tank_id uuid NOT NULL REFERENCES public.tanks(id),
  measured_at timestamptz NOT NULL,
  measured_litres numeric(14,2) NOT NULL CHECK (measured_litres >= 0),
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tank_dips_tank ON public.tank_dips (tank_id, measured_at DESC);
GRANT SELECT ON public.tank_dips TO authenticated;
GRANT ALL ON public.tank_dips TO service_role;
ALTER TABLE public.tank_dips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read dips" ON public.tank_dips FOR SELECT TO authenticated USING (public.is_station_member(station_id, auth.uid()));

CREATE TABLE public.stock_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id),
  tank_id uuid NOT NULL REFERENCES public.tanks(id),
  litres numeric(14,2) NOT NULL CHECK (litres <> 0),
  reason text NOT NULL CHECK (char_length(trim(reason)) >= 3),
  dip_id uuid REFERENCES public.tank_dips(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_by uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text
);
GRANT SELECT ON public.stock_adjustments TO authenticated;
GRANT ALL ON public.stock_adjustments TO service_role;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read adjustments" ON public.stock_adjustments FOR SELECT TO authenticated USING (public.is_station_member(station_id, auth.uid()));

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id),
  tank_id uuid NOT NULL REFERENCES public.tanks(id),
  kind text NOT NULL CHECK (kind IN ('opening','delivery','delivery_reversal','sale','sale_correction','adjustment')),
  litres numeric(14,2) NOT NULL,
  occurred_at timestamptz NOT NULL,
  source_id uuid NOT NULL,
  shift_id uuid,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, source_id)
);
CREATE INDEX stock_movements_tank ON public.stock_movements (tank_id, occurred_at);
GRANT SELECT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read movements" ON public.stock_movements FOR SELECT TO authenticated USING (public.is_station_member(station_id, auth.uid()));

-- Backfill: opening entry per tank and sale entries for already-closed shifts
INSERT INTO public.stock_movements (station_id, tank_id, kind, litres, occurred_at, source_id, note)
SELECT station_id, id, 'opening', opening_stock_litres, created_at, id, 'backfill' FROM public.tanks;
INSERT INTO public.stock_movements (station_id, tank_id, kind, litres, occurred_at, source_id, shift_id)
SELECT r.station_id, n.tank_id, 'sale', -(r.litres_sold + r.test_litres) + r.test_litres, s.closed_at, r.id, s.id
FROM public.shift_readings r JOIN public.shifts s ON s.id = r.shift_id JOIN public.nozzles n ON n.id = r.nozzle_id
WHERE s.status = 'closed' AND r.litres_sold IS NOT NULL;

CREATE OR REPLACE FUNCTION public.tank_opening_movement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.stock_movements (station_id, tank_id, kind, litres, occurred_at, source_id, created_by)
  VALUES (NEW.station_id, NEW.id, 'opening', NEW.opening_stock_litres, NEW.created_at, NEW.id, auth.uid());
  RETURN NEW;
END $$;
CREATE TRIGGER tanks_opening_movement AFTER INSERT ON public.tanks FOR EACH ROW EXECUTE FUNCTION public.tank_opening_movement();

CREATE OR REPLACE FUNCTION public.tank_expected(_tank_id uuid, _at timestamptz DEFAULT NULL)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sum(litres), 0) FROM public.stock_movements WHERE tank_id = _tank_id AND (_at IS NULL OR occurred_at <= _at)
$$;

CREATE OR REPLACE FUNCTION public.record_delivery(_station_id uuid, _supplier_id uuid, _tank_id uuid, _delivered_at timestamptz,
  _challan text, _litres numeric, _rate numeric, _invoice numeric, _notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t public.tanks%ROWTYPE; _id uuid;
BEGIN
  IF NOT public.is_station_member(_station_id, auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO _t FROM public.tanks WHERE id = _tank_id AND station_id = _station_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'bad_tank'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = _supplier_id AND station_id = _station_id) THEN RAISE EXCEPTION 'bad_supplier'; END IF;
  IF _litres IS NULL OR _litres <= 0 OR _rate IS NULL OR _rate <= 0 OR _invoice IS NULL OR _invoice < 0 THEN RAISE EXCEPTION 'bad_amount'; END IF;
  IF _delivered_at > now() + interval '5 minutes' THEN RAISE EXCEPTION 'future_date'; END IF;
  IF public.tank_expected(_tank_id) + _litres > _t.capacity_litres THEN RAISE EXCEPTION 'over_capacity'; END IF;
  IF EXISTS (SELECT 1 FROM public.fuel_deliveries WHERE station_id = _station_id AND supplier_id = _supplier_id AND lower(trim(challan_no)) = lower(trim(_challan))) THEN
    RAISE EXCEPTION 'duplicate_challan'; END IF;
  INSERT INTO public.fuel_deliveries (station_id, supplier_id, product_id, tank_id, delivered_at, challan_no, litres, rate_per_litre, calculated_amount, invoice_amount, notes, received_by)
  VALUES (_station_id, _supplier_id, _t.product_id, _tank_id, _delivered_at, trim(_challan), _litres, _rate, round(_litres * _rate, 2), _invoice, nullif(trim(_notes), ''), auth.uid())
  RETURNING id INTO _id;
  INSERT INTO public.stock_movements (station_id, tank_id, kind, litres, occurred_at, source_id, created_by)
  VALUES (_station_id, _tank_id, 'delivery', _litres, _delivered_at, _id, auth.uid());
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.reverse_delivery(_delivery_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _d public.fuel_deliveries%ROWTYPE;
BEGIN
  SELECT * INTO _d FROM public.fuel_deliveries WHERE id = _delivery_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_station_role(_d.station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _d.reversed_at IS NOT NULL THEN RAISE EXCEPTION 'already_reversed'; END IF;
  IF _reason IS NULL OR char_length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
  UPDATE public.fuel_deliveries SET reversed_at = now(), reversed_by = auth.uid(), reversal_reason = trim(_reason) WHERE id = _d.id;
  INSERT INTO public.stock_movements (station_id, tank_id, kind, litres, occurred_at, source_id, note, created_by)
  VALUES (_d.station_id, _d.tank_id, 'delivery_reversal', -_d.litres, now(), _d.id, trim(_reason), auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.record_tank_dip(_tank_id uuid, _measured_at timestamptz, _litres numeric, _notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t public.tanks%ROWTYPE; _id uuid;
BEGIN
  SELECT * INTO _t FROM public.tanks WHERE id = _tank_id;
  IF NOT FOUND OR NOT public.is_station_member(_t.station_id, auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _litres IS NULL OR _litres < 0 THEN RAISE EXCEPTION 'bad_amount'; END IF;
  IF _litres > _t.capacity_litres THEN RAISE EXCEPTION 'over_capacity'; END IF;
  IF _measured_at > now() + interval '5 minutes' THEN RAISE EXCEPTION 'future_date'; END IF;
  INSERT INTO public.tank_dips (station_id, tank_id, measured_at, measured_litres, notes, created_by)
  VALUES (_t.station_id, _t.id, _measured_at, _litres, nullif(trim(_notes), ''), auth.uid()) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.request_stock_adjustment(_tank_id uuid, _litres numeric, _reason text, _dip_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t public.tanks%ROWTYPE; _id uuid;
BEGIN
  SELECT * INTO _t FROM public.tanks WHERE id = _tank_id;
  IF NOT FOUND OR NOT public.is_station_member(_t.station_id, auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _litres IS NULL OR _litres = 0 THEN RAISE EXCEPTION 'bad_amount'; END IF;
  IF _reason IS NULL OR char_length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF _dip_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.tank_dips WHERE id = _dip_id AND tank_id = _tank_id) THEN RAISE EXCEPTION 'bad_dip'; END IF;
  INSERT INTO public.stock_adjustments (station_id, tank_id, litres, reason, dip_id, requested_by)
  VALUES (_t.station_id, _t.id, _litres, trim(_reason), _dip_id, auth.uid()) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.review_stock_adjustment(_adjustment_id uuid, _approve boolean, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _a public.stock_adjustments%ROWTYPE; _t public.tanks%ROWTYPE;
BEGIN
  SELECT * INTO _a FROM public.stock_adjustments WHERE id = _adjustment_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_station_role(_a.station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _a.status <> 'pending' THEN RAISE EXCEPTION 'already_reviewed'; END IF;
  SELECT * INTO _t FROM public.tanks WHERE id = _a.tank_id FOR UPDATE;
  IF _approve AND _a.litres > 0 AND public.tank_expected(_a.tank_id) + _a.litres > _t.capacity_litres THEN RAISE EXCEPTION 'over_capacity'; END IF;
  UPDATE public.stock_adjustments SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    reviewed_by = auth.uid(), reviewed_at = now(), review_note = nullif(trim(_note), '') WHERE id = _a.id;
  IF _approve THEN
    INSERT INTO public.stock_movements (station_id, tank_id, kind, litres, occurred_at, source_id, note, created_by)
    VALUES (_a.station_id, _a.tank_id, 'adjustment', _a.litres, now(), _a.id, _a.reason, auth.uid());
  END IF;
END $$;

-- Shift close now also posts one sale movement per reading to the nozzle's tank (test litres go back to tank, so only litres_sold leave)
CREATE OR REPLACE FUNCTION public.close_shift(_shift_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s public.shifts%ROWTYPE; _r record;
BEGIN
  SELECT * INTO _s FROM public.shifts WHERE id = _shift_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_station_member(_s.station_id, auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _s.status <> 'draft' THEN RAISE EXCEPTION 'shift_already_closed'; END IF;
  FOR _r IN SELECT id FROM public.shift_readings WHERE shift_id = _shift_id FOR UPDATE LOOP
    PERFORM public._price_shift_reading(_r.id);
  END LOOP;
  UPDATE public.shift_readings SET is_draft = false WHERE shift_id = _shift_id;
  UPDATE public.nozzles n SET meter_reading = r.closing_reading FROM public.shift_readings r WHERE r.shift_id = _shift_id AND r.nozzle_id = n.id;
  UPDATE public.shifts SET status = 'closed', closed_by = auth.uid(), closed_at = now() WHERE id = _shift_id;
  PERFORM public._total_shift(_shift_id);
  INSERT INTO public.stock_movements (station_id, tank_id, kind, litres, occurred_at, source_id, shift_id, created_by)
  SELECT r.station_id, n.tank_id, 'sale', -r.litres_sold, now(), r.id, _shift_id, auth.uid()
  FROM public.shift_readings r JOIN public.nozzles n ON n.id = r.nozzle_id WHERE r.shift_id = _shift_id;
END $$;

CREATE OR REPLACE FUNCTION public.correct_closed_reading(_reading_id uuid, _closing numeric, _test numeric, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r public.shift_readings%ROWTYPE; _cid uuid; _new_l numeric; _tank uuid;
BEGIN
  SELECT * INTO _r FROM public.shift_readings WHERE id = _reading_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_station_role(_r.station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _r.is_draft THEN RAISE EXCEPTION 'shift_not_closed'; END IF;
  IF _reason IS NULL OR char_length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF _closing IS NULL OR _closing < 0 OR _test IS NULL OR _test < 0 THEN RAISE EXCEPTION 'bad_amount'; END IF;
  IF _closing <> _r.closing_reading THEN
    INSERT INTO public.shift_corrections (station_id, shift_id, reading_id, field, old_value, new_value, reason, created_by)
    VALUES (_r.station_id, _r.shift_id, _r.id, 'closing_reading', _r.closing_reading, _closing, trim(_reason), auth.uid()) RETURNING id INTO _cid;
  END IF;
  IF _test <> _r.test_litres THEN
    INSERT INTO public.shift_corrections (station_id, shift_id, reading_id, field, old_value, new_value, reason, created_by)
    VALUES (_r.station_id, _r.shift_id, _r.id, 'test_litres', _r.test_litres, _test, trim(_reason), auth.uid()) RETURNING id INTO _cid;
  END IF;
  IF _cid IS NULL THEN RETURN; END IF;
  UPDATE public.shift_readings SET closing_reading = _closing, test_litres = _test WHERE id = _r.id;
  PERFORM public._price_shift_reading(_r.id);
  SELECT litres_sold INTO _new_l FROM public.shift_readings WHERE id = _r.id;
  SELECT tank_id INTO _tank FROM public.stock_movements WHERE kind = 'sale' AND source_id = _r.id;
  IF _tank IS NULL THEN SELECT tank_id INTO _tank FROM public.nozzles WHERE id = _r.nozzle_id; END IF;
  IF _new_l <> _r.litres_sold THEN
    INSERT INTO public.stock_movements (station_id, tank_id, kind, litres, occurred_at, source_id, shift_id, note, created_by)
    VALUES (_r.station_id, _tank, 'sale_correction', -(_new_l - _r.litres_sold), now(), _cid, _r.shift_id, trim(_reason), auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shift_readings x JOIN public.shifts s ON s.id = x.shift_id
                 WHERE x.nozzle_id = _r.nozzle_id AND x.id <> _r.id
                   AND (x.is_draft OR s.closed_at > (SELECT closed_at FROM public.shifts WHERE id = _r.shift_id))) THEN
    UPDATE public.nozzles SET meter_reading = _closing WHERE id = _r.nozzle_id;
  END IF;
  PERFORM public._total_shift(_r.shift_id);
END $$;

REVOKE ALL ON FUNCTION public.correct_tank_stock(uuid, numeric, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.tank_opening_movement() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tank_expected(uuid, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_delivery(uuid, uuid, uuid, timestamptz, text, numeric, numeric, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reverse_delivery(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_tank_dip(uuid, timestamptz, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_stock_adjustment(uuid, numeric, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_stock_adjustment(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_delivery(uuid, uuid, uuid, timestamptz, text, numeric, numeric, numeric, text),
  public.reverse_delivery(uuid, text), public.record_tank_dip(uuid, timestamptz, numeric, text),
  public.request_stock_adjustment(uuid, numeric, text, uuid), public.review_stock_adjustment(uuid, boolean, text) TO authenticated;