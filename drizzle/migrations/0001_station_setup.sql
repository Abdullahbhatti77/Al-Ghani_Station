CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 80),
  code text NOT NULL CHECK (char_length(trim(code)) BETWEEN 1 AND 12),
  unit text NOT NULL DEFAULT 'litre' CHECK (unit IN ('litre','kg','piece')),
  is_fuel boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (station_id, code),
  UNIQUE (id, station_id)
);
GRANT SELECT, INSERT, UPDATE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read products" ON public.products FOR SELECT TO authenticated USING (public.is_station_member(station_id, auth.uid()));
CREATE POLICY "managers insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.has_station_role(station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]));
CREATE POLICY "managers update products" ON public.products FOR UPDATE TO authenticated USING (public.has_station_role(station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[])) WITH CHECK (public.has_station_role(station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]));
CREATE TRIGGER products_touch BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.tanks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 60),
  capacity_litres numeric(12,2) NOT NULL CHECK (capacity_litres > 0),
  opening_stock_litres numeric(12,2) NOT NULL DEFAULT 0,
  low_stock_litres numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (product_id, station_id) REFERENCES public.products(id, station_id),
  CHECK (opening_stock_litres >= 0 AND opening_stock_litres <= capacity_litres),
  CHECK (low_stock_litres >= 0 AND low_stock_litres <= capacity_litres),
  UNIQUE (station_id, name),
  UNIQUE (id, station_id)
);
GRANT SELECT, INSERT, UPDATE ON public.tanks TO authenticated;
GRANT ALL ON public.tanks TO service_role;
ALTER TABLE public.tanks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read tanks" ON public.tanks FOR SELECT TO authenticated USING (public.is_station_member(station_id, auth.uid()));
CREATE POLICY "managers insert tanks" ON public.tanks FOR INSERT TO authenticated WITH CHECK (public.has_station_role(station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]));
CREATE POLICY "managers update tanks" ON public.tanks FOR UPDATE TO authenticated USING (public.has_station_role(station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[])) WITH CHECK (public.has_station_role(station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]));
CREATE TRIGGER tanks_touch BEFORE UPDATE ON public.tanks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Stock and product on a tank can only change through the correction RPC.
CREATE OR REPLACE FUNCTION public.guard_tank_update() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.opening_stock_litres IS DISTINCT FROM OLD.opening_stock_litres
     AND coalesce(current_setting('pumphisab.stock_correction', true), '') <> 'on' THEN
    RAISE EXCEPTION 'stock_change_requires_correction';
  END IF;
  IF NEW.product_id IS DISTINCT FROM OLD.product_id
     AND EXISTS (SELECT 1 FROM public.nozzles WHERE tank_id = OLD.id) THEN
    RAISE EXCEPTION 'tank_has_nozzles';
  END IF;
  IF NEW.station_id IS DISTINCT FROM OLD.station_id THEN RAISE EXCEPTION 'station_immutable'; END IF;
  RETURN NEW;
END $$;

CREATE TABLE public.tank_stock_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  tank_id uuid NOT NULL,
  old_litres numeric(12,2) NOT NULL,
  new_litres numeric(12,2) NOT NULL,
  reason text NOT NULL CHECK (char_length(trim(reason)) BETWEEN 3 AND 300),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tank_id, station_id) REFERENCES public.tanks(id, station_id)
);
GRANT SELECT ON public.tank_stock_corrections TO authenticated;
GRANT ALL ON public.tank_stock_corrections TO service_role;
ALTER TABLE public.tank_stock_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read corrections" ON public.tank_stock_corrections FOR SELECT TO authenticated USING (public.is_station_member(station_id, auth.uid()));

CREATE TABLE public.nozzles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  number integer NOT NULL CHECK (number > 0 AND number < 1000),
  display_name text NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 1 AND 60),
  product_id uuid NOT NULL,
  tank_id uuid NOT NULL,
  meter_reading numeric(14,2) NOT NULL DEFAULT 0 CHECK (meter_reading >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (product_id, station_id) REFERENCES public.products(id, station_id),
  FOREIGN KEY (tank_id, station_id) REFERENCES public.tanks(id, station_id),
  UNIQUE (station_id, number)
);
GRANT SELECT, INSERT, UPDATE ON public.nozzles TO authenticated;
GRANT ALL ON public.nozzles TO service_role;
ALTER TABLE public.nozzles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read nozzles" ON public.nozzles FOR SELECT TO authenticated USING (public.is_station_member(station_id, auth.uid()));
CREATE POLICY "managers insert nozzles" ON public.nozzles FOR INSERT TO authenticated WITH CHECK (public.has_station_role(station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]));
CREATE POLICY "managers update nozzles" ON public.nozzles FOR UPDATE TO authenticated USING (public.has_station_role(station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[])) WITH CHECK (public.has_station_role(station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]));
CREATE TRIGGER nozzles_touch BEFORE UPDATE ON public.nozzles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER tanks_guard BEFORE UPDATE ON public.tanks FOR EACH ROW EXECUTE FUNCTION public.guard_tank_update();

CREATE OR REPLACE FUNCTION public.check_nozzle_tank() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tanks t WHERE t.id = NEW.tank_id AND t.station_id = NEW.station_id AND t.product_id = NEW.product_id) THEN
    RAISE EXCEPTION 'nozzle_tank_product_mismatch';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER nozzles_check_tank BEFORE INSERT OR UPDATE ON public.nozzles FOR EACH ROW EXECUTE FUNCTION public.check_nozzle_tank();

CREATE TABLE public.fuel_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  price_per_litre numeric(10,2) NOT NULL CHECK (price_per_litre > 0 AND price_per_litre < 100000),
  effective_at timestamptz NOT NULL,
  note text CHECK (note IS NULL OR char_length(note) <= 200),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (product_id, station_id) REFERENCES public.products(id, station_id)
);
CREATE INDEX fuel_prices_lookup ON public.fuel_prices (station_id, product_id, effective_at DESC);
GRANT SELECT, INSERT ON public.fuel_prices TO authenticated;
GRANT ALL ON public.fuel_prices TO service_role;
ALTER TABLE public.fuel_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read prices" ON public.fuel_prices FOR SELECT TO authenticated USING (public.is_station_member(station_id, auth.uid()));
CREATE POLICY "managers add prices" ON public.fuel_prices FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND public.has_station_role(station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]));

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  business_name text NOT NULL CHECK (char_length(trim(business_name)) BETWEEN 2 AND 120),
  contact_person text CHECK (contact_person IS NULL OR char_length(contact_person) <= 100),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 20),
  address text CHECK (address IS NULL OR char_length(address) <= 300),
  opening_payable numeric(14,2) NOT NULL DEFAULT 0 CHECK (opening_payable >= 0),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 1000),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (public.is_station_member(station_id, auth.uid()));
CREATE POLICY "managers insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.has_station_role(station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]));
CREATE POLICY "managers update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (public.has_station_role(station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[])) WITH CHECK (public.has_station_role(station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]));
CREATE TRIGGER suppliers_touch BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.correct_tank_stock(_tank_id uuid, _new_litres numeric, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t public.tanks%ROWTYPE;
BEGIN
  SELECT * INTO _t FROM public.tanks WHERE id = _tank_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT public.has_station_role(_t.station_id, auth.uid(), ARRAY['owner','manager']::public.station_role[]) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _new_litres < 0 OR _new_litres > _t.capacity_litres THEN RAISE EXCEPTION 'stock_out_of_range'; END IF;
  IF _reason IS NULL OR char_length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;
  INSERT INTO public.tank_stock_corrections (station_id, tank_id, old_litres, new_litres, reason, created_by)
  VALUES (_t.station_id, _t.id, _t.opening_stock_litres, _new_litres, trim(_reason), auth.uid());
  PERFORM set_config('pumphisab.stock_correction', 'on', true);
  UPDATE public.tanks SET opening_stock_litres = _new_litres WHERE id = _t.id;
  PERFORM set_config('pumphisab.stock_correction', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.correct_tank_stock(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.correct_tank_stock(uuid, numeric, text) TO authenticated;