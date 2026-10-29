CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id),
  shift_date date NOT NULL,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 60),
  attendant_id uuid NOT NULL,
  opening_float numeric(14,2) NOT NULL DEFAULT 0 CHECK (opening_float >= 0),
  price_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','closed')),
  cash_received numeric(14,2) NOT NULL DEFAULT 0 CHECK (cash_received >= 0),
  bank_received numeric(14,2) NOT NULL DEFAULT 0 CHECK (bank_received >= 0),
  card_received numeric(14,2) NOT NULL DEFAULT 0 CHECK (card_received >= 0),
  wallet_received numeric(14,2) NOT NULL DEFAULT 0 CHECK (wallet_received >= 0),
  other_received numeric(14,2) NOT NULL DEFAULT 0 CHECK (other_received >= 0),
  notes text,
  total_litres numeric(14,2),
  total_sales numeric(14,2),
  total_collected numeric(14,2),
  difference numeric(14,2),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  closed_by uuid,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, station_id)
);
CREATE INDEX shifts_station_date ON public.shifts (station_id, shift_date DESC);
GRANT SELECT ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read shifts" ON public.shifts FOR SELECT TO authenticated USING (public.is_station_member(station_id, auth.uid()));
CREATE TRIGGER shifts_touch BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.shift_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL,
  shift_id uuid NOT NULL,
  nozzle_id uuid NOT NULL REFERENCES public.nozzles(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  is_draft boolean NOT NULL DEFAULT true,
  opening_reading numeric(14,2) NOT NULL CHECK (opening_reading >= 0),
  opening_source text NOT NULL CHECK (opening_source IN ('previous','nozzle','manual')),
  closing_reading numeric(14,2) CHECK (closing_reading >= 0),
  test_litres numeric(14,2) NOT NULL DEFAULT 0 CHECK (test_litres >= 0),
  rollover_max numeric(14,2) CHECK (rollover_max > 0),
  price_id uuid REFERENCES public.fuel_prices(id),
  price_per_litre numeric(12,2),
  litres_sold numeric(14,2),
  amount numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (shift_id, station_id) REFERENCES public.shifts(id, station_id),
  UNIQUE (shift_id, nozzle_id)
);
CREATE UNIQUE INDEX shift_readings_one_open_per_nozzle ON public.shift_readings (nozzle_id) WHERE is_draft;
CREATE INDEX shift_readings_shift ON public.shift_readings (shift_id);
GRANT SELECT ON public.shift_readings TO authenticated;
GRANT ALL ON public.shift_readings TO service_role;
ALTER TABLE public.shift_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read shift readings" ON public.shift_readings FOR SELECT TO authenticated USING (public.is_station_member(station_id, auth.uid()));
CREATE TRIGGER shift_readings_touch BEFORE UPDATE ON public.shift_readings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.shift_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL,
  shift_id uuid NOT NULL,
  reading_id uuid,
  field text NOT NULL,
  old_value numeric(14,2),
  new_value numeric(14,2),
  reason text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (shift_id, station_id) REFERENCES public.shifts(id, station_id)
);
GRANT SELECT ON public.shift_corrections TO authenticated;
GRANT ALL ON public.shift_corrections TO service_role;
ALTER TABLE public.shift_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read shift corrections" ON public.shift_corrections FOR SELECT TO authenticated USING (public.is_station_member(station_id, auth.uid()));

-- Same formula as src/lib/shifts.ts litresSold()
CREATE OR REPLACE FUNCTION public.shift_litres(_opening numeric, _closing numeric, _test numeric, _rollover numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN _rollover IS NULL THEN _closing - _opening ELSE (_rollover - _opening) + _closing END - coalesce(_test, 0)
$$;

CREATE OR REPLACE FUNCTION public.station_people(_station_id uuid)
RETURNS TABLE (user_id uuid, full_name text, role public.station_role)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.user_id, coalesce(nullif(trim(p.full_name), ''), 'Member'), m.role
  FROM public.station_members m LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.station_id = _station_id AND public.is_station_member(_station_id, auth.uid())
  ORDER BY m.created_at
$$;

CREATE OR REPLACE FUNCTION public.start_shift(_station_id uuid, _date date, _name text, _attendant uuid, _float numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _at timestamptz;
BEGIN
  IF NOT public.is_station_member(_station_id, auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT public.is_station_member(_station_id, _attendant) THEN RAISE EXCEPTION 'bad_attendant'; END IF;
  IF _float IS NULL OR _float < 0 THEN RAISE EXCEPTION 'bad_amount'; END IF;
  IF _date > (now() AT TIME ZONE 'Asia/Karachi')::date THEN RAISE EXCEPTION 'future_date'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.nozzles WHERE station_id = _station_id AND is_active) THEN RAISE EXCEPTION 'no_nozzles'; END IF;
  IF EXISTS (SELECT 1 FROM public.shift_readings r JOIN public.nozzles n ON n.id = r.nozzle_id
             WHERE n.station_id = _station_id AND n.is_active AND r.is_draft) THEN RAISE EXCEPTION 'nozzle_in_open_shift'; END IF;
  _at := CASE WHEN _date = (now() AT TIME ZONE 'Asia/Karachi')::date THEN now()
              ELSE (_date::timestamp + time '12:00') AT TIME ZONE 'Asia/Karachi' END;
  INSERT INTO public.shifts (station_id, shift_date, name, attendant_id, opening_float, price_at, created_by)
  VALUES (_station_id, _date, trim(_name), _attendant, _float, _at, auth.uid()) RETURNING id INTO _id;
  INSERT INTO public.shift_readings (station_id, shift_id, nozzle_id, product_id, opening_reading, opening_source)
  SELECT _station_id, _id, n.id, n.product_id, n.meter_reading,
         CASE WHEN EXISTS (SELECT 1 FROM public.shift_readings x WHERE x.nozzle_id = n.id AND NOT x.is_draft) THEN 'previous' ELSE 'nozzle' END
  FROM public.nozzles n WHERE n.station_id = _station_id AND n.is_active;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.save_shift_draft(_shift_id uuid, _header jsonb, _readings jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    notes = CASE WHEN _header ? 'notes' THEN _header->>'notes' ELSE notes END
  WHERE id = _shift_id;
  FOR _r IN SELECT * FROM jsonb_array_elements(coalesce(_readings, '[]'::jsonb)) LOOP
    UPDATE public.shift_readings SET
      closing_reading = CASE WHEN _r ? 'closing_reading' THEN (_r->>'closing_reading')::numeric ELSE closing_reading END,
      test_litres = coalesce((_r->>'test_litres')::numeric, test_litres)
    WHERE id = (_r->>'id')::uuid AND shift_id = _shift_id;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.correct_shift_opening(_reading_id uuid, _value numeric, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r public.shift_readings%ROWTYPE;
BEGIN
  SELECT * INTO _r FROM public.shift_readings WHERE id = _reading_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_station_role(_r.station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT _r.is_draft THEN RAISE EXCEPTION 'shift_closed'; END IF;
  IF _value IS NULL OR _value < 0 THEN RAISE EXCEPTION 'bad_amount'; END IF;
  IF _reason IS NULL OR char_length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
  INSERT INTO public.shift_corrections (station_id, shift_id, reading_id, field, old_value, new_value, reason, created_by)
  VALUES (_r.station_id, _r.shift_id, _r.id, 'opening_reading', _r.opening_reading, _value, trim(_reason), auth.uid());
  UPDATE public.shift_readings SET opening_reading = _value, opening_source = 'manual' WHERE id = _r.id;
END $$;

CREATE OR REPLACE FUNCTION public.set_shift_rollover(_reading_id uuid, _rollover numeric, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r public.shift_readings%ROWTYPE;
BEGIN
  SELECT * INTO _r FROM public.shift_readings WHERE id = _reading_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_station_role(_r.station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT _r.is_draft THEN RAISE EXCEPTION 'shift_closed'; END IF;
  IF _rollover IS NOT NULL AND _rollover <= _r.opening_reading THEN RAISE EXCEPTION 'rollover_below_opening'; END IF;
  IF _reason IS NULL OR char_length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
  INSERT INTO public.shift_corrections (station_id, shift_id, reading_id, field, old_value, new_value, reason, created_by)
  VALUES (_r.station_id, _r.shift_id, _r.id, 'meter_rollover', _r.rollover_max, _rollover, trim(_reason), auth.uid());
  UPDATE public.shift_readings SET rollover_max = _rollover WHERE id = _r.id;
END $$;

-- Recompute one reading's snapshot from the shift's stored price time. Raises on invalid values.
CREATE OR REPLACE FUNCTION public._price_shift_reading(_reading_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r public.shift_readings%ROWTYPE; _s public.shifts%ROWTYPE; _p public.fuel_prices%ROWTYPE; _l numeric;
BEGIN
  SELECT * INTO _r FROM public.shift_readings WHERE id = _reading_id;
  SELECT * INTO _s FROM public.shifts WHERE id = _r.shift_id;
  IF _r.closing_reading IS NULL THEN RAISE EXCEPTION 'closing_missing'; END IF;
  IF _r.rollover_max IS NULL AND _r.closing_reading < _r.opening_reading THEN RAISE EXCEPTION 'closing_below_opening'; END IF;
  IF _r.rollover_max IS NOT NULL AND _r.closing_reading > _r.rollover_max THEN RAISE EXCEPTION 'closing_above_rollover'; END IF;
  _l := public.shift_litres(_r.opening_reading, _r.closing_reading, _r.test_litres, _r.rollover_max);
  IF _l < 0 THEN RAISE EXCEPTION 'test_exceeds_dispensed'; END IF;
  SELECT * INTO _p FROM public.fuel_prices WHERE product_id = _r.product_id AND station_id = _r.station_id AND effective_at <= _s.price_at
    ORDER BY effective_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_price'; END IF;
  UPDATE public.shift_readings SET litres_sold = _l, price_id = _p.id, price_per_litre = _p.price_per_litre,
    amount = round(_l * _p.price_per_litre, 2) WHERE id = _r.id;
END $$;

CREATE OR REPLACE FUNCTION public._total_shift(_shift_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.shifts s SET
    total_litres = x.l, total_sales = x.a,
    total_collected = s.cash_received + s.bank_received + s.card_received + s.wallet_received + s.other_received,
    difference = (s.cash_received + s.bank_received + s.card_received + s.wallet_received + s.other_received) - x.a
  FROM (SELECT coalesce(sum(litres_sold),0) l, coalesce(sum(amount),0) a FROM public.shift_readings WHERE shift_id = _shift_id) x
  WHERE s.id = _shift_id;
END $$;

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
END $$;

CREATE OR REPLACE FUNCTION public.correct_closed_reading(_reading_id uuid, _closing numeric, _test numeric, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r public.shift_readings%ROWTYPE;
BEGIN
  SELECT * INTO _r FROM public.shift_readings WHERE id = _reading_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_station_role(_r.station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _r.is_draft THEN RAISE EXCEPTION 'shift_not_closed'; END IF;
  IF _reason IS NULL OR char_length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF _closing IS NULL OR _closing < 0 OR _test IS NULL OR _test < 0 THEN RAISE EXCEPTION 'bad_amount'; END IF;
  IF _closing <> _r.closing_reading THEN
    INSERT INTO public.shift_corrections (station_id, shift_id, reading_id, field, old_value, new_value, reason, created_by)
    VALUES (_r.station_id, _r.shift_id, _r.id, 'closing_reading', _r.closing_reading, _closing, trim(_reason), auth.uid());
  END IF;
  IF _test <> _r.test_litres THEN
    INSERT INTO public.shift_corrections (station_id, shift_id, reading_id, field, old_value, new_value, reason, created_by)
    VALUES (_r.station_id, _r.shift_id, _r.id, 'test_litres', _r.test_litres, _test, trim(_reason), auth.uid());
  END IF;
  UPDATE public.shift_readings SET closing_reading = _closing, test_litres = _test WHERE id = _r.id;
  PERFORM public._price_shift_reading(_r.id);
  -- keep nozzle meter in step if this is the nozzle's latest closed shift and no shift is open on it
  IF NOT EXISTS (SELECT 1 FROM public.shift_readings x JOIN public.shifts s ON s.id = x.shift_id
                 WHERE x.nozzle_id = _r.nozzle_id AND x.id <> _r.id
                   AND (x.is_draft OR s.closed_at > (SELECT closed_at FROM public.shifts WHERE id = _r.shift_id))) THEN
    UPDATE public.nozzles SET meter_reading = _closing WHERE id = _r.nozzle_id;
  END IF;
  PERFORM public._total_shift(_r.shift_id);
END $$;

CREATE OR REPLACE FUNCTION public.correct_closed_collections(_shift_id uuid, _values jsonb, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s public.shifts%ROWTYPE; _f text; _old numeric; _new numeric;
BEGIN
  SELECT * INTO _s FROM public.shifts WHERE id = _shift_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_station_role(_s.station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _s.status <> 'closed' THEN RAISE EXCEPTION 'shift_not_closed'; END IF;
  IF _reason IS NULL OR char_length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
  FOREACH _f IN ARRAY ARRAY['cash_received','bank_received','card_received','wallet_received','other_received'] LOOP
    IF _values ? _f THEN
      _new := (_values->>_f)::numeric;
      IF _new IS NULL OR _new < 0 THEN RAISE EXCEPTION 'bad_amount'; END IF;
      EXECUTE format('SELECT %I FROM public.shifts WHERE id = $1', _f) INTO _old USING _shift_id;
      IF _new <> _old THEN
        INSERT INTO public.shift_corrections (station_id, shift_id, field, old_value, new_value, reason, created_by)
        VALUES (_s.station_id, _shift_id, _f, _old, _new, trim(_reason), auth.uid());
        EXECUTE format('UPDATE public.shifts SET %I = $1 WHERE id = $2', _f) USING _new, _shift_id;
      END IF;
    END IF;
  END LOOP;
  PERFORM public._total_shift(_shift_id);
END $$;

REVOKE ALL ON FUNCTION public._price_shift_reading(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._total_shift(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.station_people(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_shift(uuid, date, text, uuid, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_shift_draft(uuid, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.correct_shift_opening(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_shift_rollover(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_shift(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.correct_closed_reading(uuid, numeric, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.correct_closed_collections(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.station_people(uuid), public.start_shift(uuid, date, text, uuid, numeric),
  public.save_shift_draft(uuid, jsonb, jsonb), public.correct_shift_opening(uuid, numeric, text),
  public.set_shift_rollover(uuid, numeric, text), public.close_shift(uuid),
  public.correct_closed_reading(uuid, numeric, numeric, text), public.correct_closed_collections(uuid, jsonb, text) TO authenticated;