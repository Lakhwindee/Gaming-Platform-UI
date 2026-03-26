import { getUncachableRevenueCatClient } from "@replit/revenuecat-sdk";

async function main() {
  const rc = getUncachableRevenueCatClient();
  const projectId = process.env.REVENUECAT_PROJECT_ID!;
  const testAppId = process.env.REVENUECAT_TEST_STORE_APP_ID!;

  // List products
  const prods = await rc.listProducts({ project_id: projectId, limit: 20 }) as any;
  console.log("Products:", JSON.stringify(prods?.items?.map((p: any) => ({ id: p.id, displayName: p.display_name })), null, 2));
  
  // List offerings
  const offs = await rc.listOfferings({ project_id: projectId }) as any;
  console.log("Offerings:", JSON.stringify(offs?.items?.map((o: any) => ({ id: o.id, displayName: o.display_name })), null, 2));

  // List entitlements
  const ents = await rc.listEntitlements({ project_id: projectId }) as any;
  console.log("Entitlements:", JSON.stringify(ents?.items?.map((e: any) => ({ id: e.id, displayName: e.display_name })), null, 2));
}

main().catch(e => console.error("Error:", e.message, e));
