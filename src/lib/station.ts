import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StationRole = "owner" | "manager" | "staff";
export type MyStation = {
  role: StationRole;
  station: {
    id: string;
    name: string;
    city: string;
    contact_phone: string;
    preferred_language: string;
    dip_variance_litres: number | null;
  };
};

export const myStationQuery = queryOptions({
  queryKey: ["my-station"],
  queryFn: async (): Promise<MyStation | null> => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return null;
    const { data, error } = await supabase
      .from("station_members")
      .select("role, station:stations(id, name, city, contact_phone, preferred_language, dip_variance_litres)")
      .eq("user_id", uid)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data || !data.station) return null;
    return data as unknown as MyStation;
  },
});

export const stationMembersQuery = (stationId: string) =>
  queryOptions({
    queryKey: ["station-members", stationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("station_members")
        .select("id, user_id, role, created_at")
        .eq("station_id", stationId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
