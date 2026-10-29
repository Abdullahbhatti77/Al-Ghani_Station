-- Role helper
CREATE OR REPLACE FUNCTION public.station_role_of(_station_id uuid, _user_id uuid) RETURNS public.station_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.station_members WHERE station_id = _station_id AND user_id = _user_id LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.station_role_of(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.station_role_of(uuid, uuid) TO authenticated;

-- ===== Audit log =====
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id),
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  reason text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_station_time ON public.audit_log(station_id, created_at DESC);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners managers read audit" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_station_role(station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]));

CREATE OR REPLACE FUNCTION public._audit(_station uuid, _action text, _entity text, _entity_id uuid, _reason text, _details jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.audit_log(station_id, actor_id, action, entity, entity_id, reason, details)
  VALUES (_station, auth.uid(), _action, _entity, _entity_id, _reason, COALESCE(_details, '{}'::jsonb));
$$;
REVOKE EXECUTE ON FUNCTION public._audit(uuid, text, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.audit_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb := to_jsonb(NEW); o jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
BEGIN
  IF TG_TABLE_NAME = 'fuel_prices' THEN
    PERFORM public._audit(NEW.station_id, 'price_set', 'fuel_price', NEW.id, r->>'note', jsonb_build_object('product_id', r->'product_id', 'price', r->'price_per_litre', 'effective_at', r->'effective_at'));
  ELSIF TG_TABLE_NAME = 'shifts' THEN
    IF o->>'status' = 'draft' AND r->>'status' = 'closed' THEN
      PERFORM public._audit(NEW.station_id, 'shift_closed', 'shift', NEW.id, r->>'variance_reason', jsonb_build_object('name', r->'name', 'date', r->'shift_date', 'sales', r->'total_sales', 'difference', r->'difference', 'cash_variance', r->'cash_variance'));
    END IF;
  ELSIF TG_TABLE_NAME = 'shift_corrections' THEN
    PERFORM public._audit(NEW.station_id, 'shift_corrected', 'shift', (r->>'shift_id')::uuid, r->>'reason', jsonb_build_object('field', r->'field', 'old', r->'old_value', 'new', r->'new_value'));
  ELSIF TG_TABLE_NAME = 'stock_adjustments' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public._audit(NEW.station_id, 'adjustment_requested', 'tank', (r->>'tank_id')::uuid, r->>'reason', jsonb_build_object('litres', r->'litres'));
    ELSIF o->>'status' IS DISTINCT FROM r->>'status' THEN
      PERFORM public._audit(NEW.station_id, 'adjustment_' || (r->>'status'), 'tank', (r->>'tank_id')::uuid, COALESCE(r->>'review_note', r->>'reason'), jsonb_build_object('litres', r->'litres'));
    END IF;
  ELSIF TG_TABLE_NAME = 'customer_transactions' THEN
    IF TG_OP = 'INSERT' AND (r->>'over_limit')::boolean THEN
      PERFORM public._audit(NEW.station_id, 'credit_override', 'customer', (r->>'customer_id')::uuid, r->>'approval_reason', jsonb_build_object('amount', r->'amount'));
    ELSIF TG_OP = 'UPDATE' AND o->>'reversed_at' IS NULL AND r->>'reversed_at' IS NOT NULL THEN
      PERFORM public._audit(NEW.station_id, 'customer_txn_reversed', 'customer', (r->>'customer_id')::uuid, r->>'reversal_reason', jsonb_build_object('kind', r->'kind', 'amount', r->'amount'));
    END IF;
  ELSIF TG_TABLE_NAME = 'supplier_payments' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public._audit(NEW.station_id, 'supplier_paid', 'supplier', (r->>'supplier_id')::uuid, r->>'notes', jsonb_build_object('amount', r->'amount', 'method', r->'method'));
    ELSIF o->>'reversed_at' IS NULL AND r->>'reversed_at' IS NOT NULL THEN
      PERFORM public._audit(NEW.station_id, 'supplier_payment_reversed', 'supplier', (r->>'supplier_id')::uuid, r->>'reversal_reason', jsonb_build_object('amount', r->'amount'));
    END IF;
  ELSIF TG_TABLE_NAME = 'expenses' THEN
    IF TG_OP = 'UPDATE' AND o->>'reversed_at' IS NULL AND r->>'reversed_at' IS NOT NULL THEN
      PERFORM public._audit(NEW.station_id, 'expense_reversed', 'expense', NEW.id, r->>'reversal_reason', jsonb_build_object('amount', r->'amount', 'description', r->'description'));
    END IF;
  ELSIF TG_TABLE_NAME = 'fuel_deliveries' THEN
    IF TG_OP = 'UPDATE' AND o->>'reversed_at' IS NULL AND r->>'reversed_at' IS NOT NULL THEN
      PERFORM public._audit(NEW.station_id, 'delivery_reversed', 'tank', (r->>'tank_id')::uuid, r->>'reversal_reason', jsonb_build_object('challan', r->'challan_no', 'litres', r->'litres'));
    END IF;
  ELSIF TG_TABLE_NAME = 'shift_cash_movements' THEN
    IF TG_OP = 'UPDATE' AND o->>'reversed_at' IS NULL AND r->>'reversed_at' IS NOT NULL THEN
      PERFORM public._audit(NEW.station_id, 'cash_movement_reversed', 'shift', (r->>'shift_id')::uuid, r->>'reason', jsonb_build_object('kind', r->'kind', 'amount', r->'amount'));
    END IF;
  ELSIF TG_TABLE_NAME = 'stations' THEN
    PERFORM public._audit(NEW.id, 'settings_changed', 'station', NEW.id, NULL,
      jsonb_build_object('before', o - 'updated_at' - 'created_at' - 'created_by', 'after', r - 'updated_at' - 'created_at' - 'created_by'));
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER audit_prices AFTER INSERT ON public.fuel_prices FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_shifts AFTER UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_shift_corr AFTER INSERT ON public.shift_corrections FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_adjust AFTER INSERT OR UPDATE ON public.stock_adjustments FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_cust_txn AFTER INSERT OR UPDATE ON public.customer_transactions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_sup_pay AFTER INSERT OR UPDATE ON public.supplier_payments FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_expenses AFTER UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_deliveries AFTER UPDATE ON public.fuel_deliveries FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_cash_moves AFTER UPDATE ON public.shift_cash_movements FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_stations AFTER UPDATE ON public.stations FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
REVOKE EXECUTE ON FUNCTION public.audit_trigger() FROM PUBLIC, anon, authenticated;

-- ===== Attendant (staff) guards =====
CREATE OR REPLACE FUNCTION public.guard_staff_writes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _role public.station_role; _shift uuid; _att uuid;
BEGIN
  IF _uid IS NULL THEN RETURN NEW; END IF;
  _role := public.station_role_of(NEW.station_id, _uid);
  IF _role IS DISTINCT FROM 'staff' THEN RETURN NEW; END IF;

  IF TG_TABLE_NAME = 'shifts' THEN
    IF NEW.attendant_id <> _uid THEN RAISE EXCEPTION 'attendant_own_shift_only'; END IF;
    IF TG_OP = 'UPDATE' AND OLD.attendant_id <> _uid THEN RAISE EXCEPTION 'attendant_own_shift_only'; END IF;
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'fuel_deliveries' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME IN ('customer_transactions','expenses','shift_cash_movements') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  _shift := (to_jsonb(NEW)->>'shift_id')::uuid;
  IF _shift IS NULL THEN RAISE EXCEPTION 'attendant_needs_shift'; END IF;
  SELECT attendant_id INTO _att FROM public.shifts WHERE id = _shift;
  IF _att IS DISTINCT FROM _uid THEN RAISE EXCEPTION 'attendant_own_shift_only'; END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_staff_writes() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER staff_guard_shifts BEFORE INSERT OR UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.guard_staff_writes();
CREATE TRIGGER staff_guard_readings BEFORE INSERT OR UPDATE ON public.shift_readings FOR EACH ROW EXECUTE FUNCTION public.guard_staff_writes();
CREATE TRIGGER staff_guard_cust_txn BEFORE INSERT OR UPDATE ON public.customer_transactions FOR EACH ROW EXECUTE FUNCTION public.guard_staff_writes();
CREATE TRIGGER staff_guard_expenses BEFORE INSERT OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.guard_staff_writes();
CREATE TRIGGER staff_guard_cash BEFORE INSERT OR UPDATE ON public.shift_cash_movements FOR EACH ROW EXECUTE FUNCTION public.guard_staff_writes();
CREATE TRIGGER staff_guard_deliveries BEFORE INSERT OR UPDATE ON public.fuel_deliveries FOR EACH ROW EXECUTE FUNCTION public.guard_staff_writes();

-- ===== Owner-only: prices and station settings =====
DROP POLICY IF EXISTS "managers add prices" ON public.fuel_prices;
CREATE POLICY "owners add prices" ON public.fuel_prices FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.has_station_role(station_id, auth.uid(), ARRAY['owner']::public.station_role[]));
DROP POLICY IF EXISTS "owners/managers update station" ON public.stations;
CREATE POLICY "owners update station" ON public.stations FOR UPDATE TO authenticated
  USING (public.has_station_role(id, auth.uid(), ARRAY['owner']::public.station_role[]))
  WITH CHECK (public.has_station_role(id, auth.uid(), ARRAY['owner']::public.station_role[]));

-- ===== Staff management (owner only) =====
CREATE OR REPLACE FUNCTION public.station_staff(_station_id uuid)
RETURNS TABLE(member_id uuid, user_id uuid, full_name text, email text, role public.station_role, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_station_role(_station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT m.id, m.user_id, p.full_name, u.email::text, m.role, m.created_at
    FROM public.station_members m LEFT JOIN public.profiles p ON p.id = m.user_id LEFT JOIN auth.users u ON u.id = m.user_id
    WHERE m.station_id = _station_id ORDER BY m.created_at;
END $$;

CREATE OR REPLACE FUNCTION public.add_station_member(_station_id uuid, _email text, _role public.station_role) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid; _id uuid;
BEGIN
  IF NOT public.has_station_role(_station_id, auth.uid(), ARRAY['owner']::public.station_role[]) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(trim(_email)) LIMIT 1;
  IF _uid IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;
  IF EXISTS (SELECT 1 FROM public.station_members WHERE user_id = _uid) THEN RAISE EXCEPTION 'already_member'; END IF;
  INSERT INTO public.station_members(station_id, user_id, role) VALUES (_station_id, _uid, _role) RETURNING id INTO _id;
  PERFORM public._audit(_station_id, 'member_added', 'member', _uid, NULL, jsonb_build_object('email', lower(trim(_email)), 'role', _role));
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.set_member_role(_member_id uuid, _role public.station_role) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _m public.station_members;
BEGIN
  SELECT * INTO _m FROM public.station_members WHERE id = _member_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_station_role(_m.station_id, auth.uid(), ARRAY['owner']::public.station_role[]) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _m.role = 'owner' AND _role <> 'owner' AND (SELECT count(*) FROM public.station_members WHERE station_id = _m.station_id AND role = 'owner') <= 1 THEN
    RAISE EXCEPTION 'last_owner';
  END IF;
  UPDATE public.station_members SET role = _role WHERE id = _member_id;
  PERFORM public._audit(_m.station_id, 'role_changed', 'member', _m.user_id, NULL, jsonb_build_object('from', _m.role, 'to', _role));
END $$;

CREATE OR REPLACE FUNCTION public.remove_station_member(_member_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _m public.station_members;
BEGIN
  SELECT * INTO _m FROM public.station_members WHERE id = _member_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_station_role(_m.station_id, auth.uid(), ARRAY['owner']::public.station_role[]) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _m.role = 'owner' AND (SELECT count(*) FROM public.station_members WHERE station_id = _m.station_id AND role = 'owner') <= 1 THEN
    RAISE EXCEPTION 'last_owner';
  END IF;
  DELETE FROM public.station_members WHERE id = _member_id;
  PERFORM public._audit(_m.station_id, 'member_removed', 'member', _m.user_id, NULL, jsonb_build_object('role', _m.role));
END $$;

REVOKE EXECUTE ON FUNCTION public.station_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_station_member(uuid, text, public.station_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_member_role(uuid, public.station_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.remove_station_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.station_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_station_member(uuid, text, public.station_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, public.station_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_station_member(uuid) TO authenticated;
GRANT DELETE ON public.station_members TO service_role;