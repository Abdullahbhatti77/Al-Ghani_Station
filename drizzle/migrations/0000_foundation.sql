CREATE TYPE public.station_role AS ENUM ('owner','manager','staff');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  preferred_language text NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en','ur')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  city text NOT NULL CHECK (char_length(city) BETWEEN 2 AND 80),
  contact_phone text NOT NULL CHECK (char_length(contact_phone) BETWEEN 7 AND 20),
  preferred_language text NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en','ur')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.stations TO authenticated;
GRANT ALL ON public.stations TO service_role;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.station_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.station_role NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (station_id, user_id)
);
GRANT SELECT ON public.station_members TO authenticated;
GRANT ALL ON public.station_members TO service_role;
ALTER TABLE public.station_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_station_member(_station_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.station_members WHERE station_id = _station_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.has_station_role(_station_id uuid, _user_id uuid, _roles public.station_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.station_members WHERE station_id = _station_id AND user_id = _user_id AND role = ANY(_roles))
$$;

CREATE POLICY "members read station" ON public.stations FOR SELECT TO authenticated
  USING (public.is_station_member(id, auth.uid()));
CREATE POLICY "owners/managers update station" ON public.stations FOR UPDATE TO authenticated
  USING (public.has_station_role(id, auth.uid(), ARRAY['owner','manager']::public.station_role[]))
  WITH CHECK (public.has_station_role(id, auth.uid(), ARRAY['owner','manager']::public.station_role[]));

CREATE POLICY "members read memberships" ON public.station_members FOR SELECT TO authenticated
  USING (public.is_station_member(station_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER stations_touch BEFORE UPDATE ON public.stations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name) VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.create_station_with_owner(_name text, _city text, _phone text, _language text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _sid uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.station_members WHERE user_id = _uid) THEN RAISE EXCEPTION 'already_member'; END IF;
  IF _language NOT IN ('en','ur') THEN _language := 'en'; END IF;
  INSERT INTO public.stations (name, city, contact_phone, preferred_language, created_by)
  VALUES (trim(_name), trim(_city), trim(_phone), _language, _uid) RETURNING id INTO _sid;
  INSERT INTO public.station_members (station_id, user_id, role) VALUES (_sid, _uid, 'owner');
  UPDATE public.profiles SET preferred_language = _language WHERE id = _uid;
  RETURN _sid;
END $$;
REVOKE ALL ON FUNCTION public.create_station_with_owner(text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_station_with_owner(text,text,text,text) TO authenticated;