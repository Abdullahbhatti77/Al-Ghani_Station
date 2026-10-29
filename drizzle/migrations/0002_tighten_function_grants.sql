REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_station_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_station_role(uuid, uuid, public.station_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_station_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_station_role(uuid, uuid, public.station_role[]) TO authenticated;