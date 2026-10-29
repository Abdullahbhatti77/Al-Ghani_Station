import { useSuspenseQueries } from "@tanstack/react-query";
import { nozzlesQuery, pricesQuery, productsQuery, setupStatus, suppliersQuery, tanksQuery } from "@/lib/setup";

export const SETUP_STEPS = ["products", "tanks", "nozzles", "prices", "suppliers"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

export function useSetupData(stationId: string) {
  const [products, tanks, nozzles, prices, suppliers] = useSuspenseQueries({
    queries: [productsQuery(stationId), tanksQuery(stationId), nozzlesQuery(stationId), pricesQuery(stationId), suppliersQuery(stationId)],
  });
  const data = { products: products.data, tanks: tanks.data, nozzles: nozzles.data, prices: prices.data, suppliers: suppliers.data };
  return { ...data, status: setupStatus(data) };
}
