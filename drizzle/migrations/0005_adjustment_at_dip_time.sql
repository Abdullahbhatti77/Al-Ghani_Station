CREATE OR REPLACE FUNCTION public.review_stock_adjustment(_adjustment_id uuid, _approve boolean, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _a public.stock_adjustments%ROWTYPE; _t public.tanks%ROWTYPE; _at timestamptz;
BEGIN
  SELECT * INTO _a FROM public.stock_adjustments WHERE id = _adjustment_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_station_role(_a.station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _a.status <> 'pending' THEN RAISE EXCEPTION 'already_reviewed'; END IF;
  SELECT * INTO _t FROM public.tanks WHERE id = _a.tank_id FOR UPDATE;
  IF _approve AND _a.litres > 0 AND public.tank_expected(_a.tank_id) + _a.litres > _t.capacity_litres THEN RAISE EXCEPTION 'over_capacity'; END IF;
  UPDATE public.stock_adjustments SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    reviewed_by = auth.uid(), reviewed_at = now(), review_note = nullif(trim(_note), '') WHERE id = _a.id;
  IF _approve THEN
    -- an adjustment that settles a dip difference is dated at the dip, so the dip then reads as matched
    SELECT measured_at INTO _at FROM public.tank_dips WHERE id = _a.dip_id;
    INSERT INTO public.stock_movements (station_id, tank_id, kind, litres, occurred_at, source_id, note, created_by)
    VALUES (_a.station_id, _a.tank_id, 'adjustment', _a.litres, coalesce(_at, now()), _a.id, _a.reason, auth.uid());
  END IF;
END $$;
UPDATE public.stock_movements m SET occurred_at = d.measured_at
FROM public.stock_adjustments a JOIN public.tank_dips d ON d.id = a.dip_id
WHERE m.kind = 'adjustment' AND m.source_id = a.id;