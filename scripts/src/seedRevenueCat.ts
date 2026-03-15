import { getUncachableRevenueCatClient } from "./revenueCatClient";

import {
  listProjects,
  createProject,
  listApps,
  createApp,
  listAppPublicApiKeys,
  listProducts,
  createProduct,
  listEntitlements,
  createEntitlement,
  attachProductsToEntitlement,
  listOfferings,
  createOffering,
  updateOffering,
  listPackages,
  createPackages,
  attachProductsToPackage,
  type App,
  type Product,
  type Project,
  type Entitlement,
  type Offering,
  type Package,
  type CreateProductData,
} from "replit-revenuecat-v2";

const PROJECT_NAME = "Blaze";

const APP_STORE_APP_NAME = "Blaze iOS";
const APP_STORE_BUNDLE_ID = "com.blaze.crashgame.ios";
const PLAY_STORE_APP_NAME = "Blaze Android";
const PLAY_STORE_PACKAGE_NAME = "com.blaze.crashgame.android";

const ENTITLEMENT_IDENTIFIER = "coins";
const ENTITLEMENT_DISPLAY_NAME = "Coins Access";

const OFFERING_IDENTIFIER = "coin_packs";
const OFFERING_DISPLAY_NAME = "Coin Packs";

const COIN_PACKS = [
  {
    productId: "blaze_coins_100",
    displayName: "100 Coins",
    title: "Starter Pack",
    packageId: "$rc_lifetime",
    packageName: "Starter Pack",
    prices: [
      { amount_micros: 1190000, currency: "USD" },
    ],
  },
  {
    productId: "blaze_coins_500",
    displayName: "500 Coins",
    title: "Popular Pack",
    packageId: "$rc_annual",
    packageName: "Popular Pack",
    prices: [
      { amount_micros: 5990000, currency: "USD" },
    ],
  },
  {
    productId: "blaze_coins_1000",
    displayName: "1100 Coins",
    title: "Value Pack",
    packageId: "$rc_six_month",
    packageName: "Value Pack (+10% Bonus)",
    prices: [
      { amount_micros: 11990000, currency: "USD" },
    ],
  },
  {
    productId: "blaze_coins_5000",
    displayName: "6000 Coins",
    title: "High Roller Pack",
    packageId: "$rc_three_month",
    packageName: "High Roller Pack (+20% Bonus)",
    prices: [
      { amount_micros: 59990000, currency: "USD" },
    ],
  },
];

type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

async function seedRevenueCat() {
  const client = await getUncachableRevenueCatClient();

  let project: Project;
  const { data: existingProjects, error: listProjectsError } = await listProjects({
    client,
    query: { limit: 20 },
  });

  if (listProjectsError) throw new Error("Failed to list projects");

  const existingProject = existingProjects.items?.find((p) => p.name === PROJECT_NAME);

  if (existingProject) {
    console.log("Project already exists:", existingProject.id);
    project = existingProject;
  } else {
    const { data: newProject, error: createProjectError } = await createProject({
      client,
      body: { name: PROJECT_NAME },
    });
    if (createProjectError) throw new Error("Failed to create project");
    console.log("Created project:", newProject.id);
    project = newProject;
  }

  const { data: apps, error: listAppsError } = await listApps({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });

  if (listAppsError || !apps || apps.items.length === 0) {
    throw new Error("No apps found");
  }

  let testStoreApp: App | undefined = apps.items.find((a) => a.type === "test_store");
  let appStoreApp: App | undefined = apps.items.find((a) => a.type === "app_store");
  let playStoreApp: App | undefined = apps.items.find((a) => a.type === "play_store");

  if (!testStoreApp) throw new Error("No test store app found");
  console.log("Test store app found:", testStoreApp.id);

  if (!appStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: {
        name: APP_STORE_APP_NAME,
        type: "app_store",
        app_store: { bundle_id: APP_STORE_BUNDLE_ID },
      },
    });
    if (error) throw new Error("Failed to create App Store app");
    appStoreApp = newApp;
    console.log("Created App Store app:", appStoreApp.id);
  } else {
    console.log("App Store app found:", appStoreApp.id);
  }

  if (!playStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: {
        name: PLAY_STORE_APP_NAME,
        type: "play_store",
        play_store: { package_name: PLAY_STORE_PACKAGE_NAME },
      },
    });
    if (error) throw new Error("Failed to create Play Store app");
    playStoreApp = newApp;
    console.log("Created Play Store app:", playStoreApp.id);
  } else {
    console.log("Play Store app found:", playStoreApp.id);
  }

  const { data: existingProducts, error: listProductsError } = await listProducts({
    client,
    path: { project_id: project.id },
    query: { limit: 100 },
  });

  if (listProductsError) throw new Error("Failed to list products");

  const ensureProduct = async (
    targetApp: App,
    label: string,
    productIdentifier: string,
    displayName: string,
    title: string,
    isTestStore: boolean,
  ): Promise<Product> => {
    const existing = existingProducts.items?.find(
      (p) => p.store_identifier === productIdentifier && p.app_id === targetApp.id
    );
    if (existing) {
      console.log(`${label} product already exists:`, existing.id);
      return existing;
    }
    const body: CreateProductData["body"] = {
      store_identifier: productIdentifier,
      app_id: targetApp.id,
      type: "subscription",
      display_name: displayName,
    };
    if (isTestStore) {
      body.subscription = { duration: "P1M" };
      body.title = title;
    }
    const { data: created, error } = await createProduct({
      client,
      path: { project_id: project.id },
      body,
    });
    if (error) throw new Error(`Failed to create ${label} product: ${JSON.stringify(error)}`);
    console.log(`Created ${label} product:`, created.id);
    return created;
  };

  const packResults: { testProd: Product; appProd: Product; playProd: Product; pack: (typeof COIN_PACKS)[0] }[] = [];

  for (const pack of COIN_PACKS) {
    const testProd = await ensureProduct(testStoreApp, `TestStore-${pack.productId}`, pack.productId, pack.displayName, pack.title, true);
    const appProd = await ensureProduct(appStoreApp, `AppStore-${pack.productId}`, pack.productId, pack.displayName, pack.title, false);
    const playProd = await ensureProduct(playStoreApp, `PlayStore-${pack.productId}`, `${pack.productId}:monthly`, pack.displayName, pack.title, false);

    const { data: priceData, error: priceError } = await client.post<TestStorePricesResponse>({
      url: "/projects/{project_id}/products/{product_id}/test_store_prices",
      path: { project_id: project.id, product_id: testProd.id },
      body: { prices: pack.prices },
    });

    if (priceError) {
      if (typeof priceError === "object" && "type" in priceError && priceError["type"] === "resource_already_exists") {
        console.log(`Prices already exist for ${pack.productId}`);
      } else {
        throw new Error(`Failed to add test store prices for ${pack.productId}`);
      }
    } else {
      console.log(`Added prices for ${pack.productId}:`, JSON.stringify(priceData));
    }

    packResults.push({ testProd, appProd, playProd, pack });
  }

  let entitlement: Entitlement | undefined;
  const { data: existingEntitlements, error: listEntitlementsError } = await listEntitlements({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });

  if (listEntitlementsError) throw new Error("Failed to list entitlements");

  const existingEntitlement = existingEntitlements.items?.find((e) => e.lookup_key === ENTITLEMENT_IDENTIFIER);

  if (existingEntitlement) {
    console.log("Entitlement already exists:", existingEntitlement.id);
    entitlement = existingEntitlement;
  } else {
    const { data: newEntitlement, error } = await createEntitlement({
      client,
      path: { project_id: project.id },
      body: { lookup_key: ENTITLEMENT_IDENTIFIER, display_name: ENTITLEMENT_DISPLAY_NAME },
    });
    if (error) throw new Error("Failed to create entitlement");
    console.log("Created entitlement:", newEntitlement.id);
    entitlement = newEntitlement;
  }

  const allProductIds = packResults.flatMap((r) => [r.testProd.id, r.appProd.id, r.playProd.id]);
  const { error: attachEntitlementError } = await attachProductsToEntitlement({
    client,
    path: { project_id: project.id, entitlement_id: entitlement.id },
    body: { product_ids: allProductIds },
  });

  if (attachEntitlementError) {
    if (attachEntitlementError.type === "unprocessable_entity_error") {
      console.log("Products already attached to entitlement");
    } else {
      throw new Error("Failed to attach products to entitlement");
    }
  } else {
    console.log("Attached all products to entitlement");
  }

  let offering: Offering | undefined;
  const { data: existingOfferings, error: listOfferingsError } = await listOfferings({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });

  if (listOfferingsError) throw new Error("Failed to list offerings");

  const existingOffering = existingOfferings.items?.find((o) => o.lookup_key === OFFERING_IDENTIFIER);

  if (existingOffering) {
    console.log("Offering already exists:", existingOffering.id);
    offering = existingOffering;
  } else {
    const { data: newOffering, error } = await createOffering({
      client,
      path: { project_id: project.id },
      body: { lookup_key: OFFERING_IDENTIFIER, display_name: OFFERING_DISPLAY_NAME },
    });
    if (error) throw new Error("Failed to create offering");
    console.log("Created offering:", newOffering.id);
    offering = newOffering;
  }

  if (!offering.is_current) {
    const { error } = await updateOffering({
      client,
      path: { project_id: project.id, offering_id: offering.id },
      body: { is_current: true },
    });
    if (error) throw new Error("Failed to set offering as current");
    console.log("Set offering as current");
  }

  const { data: existingPackages, error: listPackagesError } = await listPackages({
    client,
    path: { project_id: project.id, offering_id: offering.id },
    query: { limit: 20 },
  });
  if (listPackagesError) throw new Error("Failed to list packages");

  for (const { testProd, appProd, playProd, pack } of packResults) {
    let pkg: Package | undefined;
    const existingPkg = existingPackages.items?.find((p) => p.lookup_key === pack.packageId);

    if (existingPkg) {
      console.log(`Package ${pack.packageId} already exists:`, existingPkg.id);
      pkg = existingPkg;
    } else {
      const { data: newPkg, error } = await createPackages({
        client,
        path: { project_id: project.id, offering_id: offering.id },
        body: { lookup_key: pack.packageId, display_name: pack.packageName },
      });
      if (error) throw new Error(`Failed to create package ${pack.packageId}: ${JSON.stringify(error)}`);
      console.log(`Created package ${pack.packageId}:`, newPkg.id);
      pkg = newPkg;
    }

    const { error: attachPkgError } = await attachProductsToPackage({
      client,
      path: { project_id: project.id, package_id: pkg.id },
      body: {
        products: [
          { product_id: testProd.id, eligibility_criteria: "all" },
          { product_id: appProd.id, eligibility_criteria: "all" },
          { product_id: playProd.id, eligibility_criteria: "all" },
        ],
      },
    });

    if (attachPkgError) {
      if (attachPkgError.type === "unprocessable_entity_error" && attachPkgError.message?.includes("Cannot attach product")) {
        console.log(`Skipping package attach for ${pack.packageId}: already has incompatible product`);
      } else {
        throw new Error(`Failed to attach products to package ${pack.packageId}: ${JSON.stringify(attachPkgError)}`);
      }
    } else {
      console.log(`Attached products to package ${pack.packageId}`);
    }
  }

  const { data: testApiKeys } = await listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: testStoreApp.id } });
  const { data: iosApiKeys } = await listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: appStoreApp.id } });
  const { data: androidApiKeys } = await listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: playStoreApp.id } });

  console.log("\n====================");
  console.log("Blaze RevenueCat setup complete!");
  console.log("REVENUECAT_PROJECT_ID=" + project.id);
  console.log("REVENUECAT_TEST_STORE_APP_ID=" + testStoreApp.id);
  console.log("REVENUECAT_APPLE_APP_STORE_APP_ID=" + appStoreApp.id);
  console.log("REVENUECAT_GOOGLE_PLAY_STORE_APP_ID=" + playStoreApp.id);
  console.log("EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=" + (testApiKeys?.items[0]?.key ?? "N/A"));
  console.log("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=" + (iosApiKeys?.items[0]?.key ?? "N/A"));
  console.log("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=" + (androidApiKeys?.items[0]?.key ?? "N/A"));
  console.log("====================\n");
}

seedRevenueCat().catch(console.error);
