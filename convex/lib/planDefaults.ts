import type { PlanId } from "./plans";
import {
  FEATURE_KEYS,
  type FeatureKey,
  type FeaturePricing,
  type FeatureValue,
  type PlanConfigData,
  type PlanSettings,
} from "./planFeatures";

/**
 * The SEED of the plan configuration (CLAUDE.md "Billing"). The live
 * values are in the `planConfig` table, edited on the admin "Plans &
 * features" page; this file only fills a fresh deployment, a feature added
 * later, and "Reset to defaults". Never read it to check a shop.
 */

const PLANS: Record<PlanId, PlanSettings> = {
  free: { name: { en: "Free", fr: "Gratuit" }, monthlyMinor: 0, yearlyMinor: null, trialMonths: 0, visible: true },
  pro: { name: { en: "Pro", fr: "Pro" }, monthlyMinor: 29900, yearlyMinor: 299000, trialMonths: 2, visible: true },
  business: {
    name: { en: "Business", fr: "Business" },
    monthlyMinor: 100000,
    yearlyMinor: null,
    trialMonths: 0,
    visible: true,
  },
  enterprise: {
    name: { en: "Enterprise", fr: "Entreprise" },
    monthlyMinor: null,
    yearlyMinor: null,
    trialMonths: 0,
    visible: true,
  },
};

type Seed = { values: [FeatureValue, FeatureValue, FeatureValue, FeatureValue]; pricing: FeaturePricing };

const ALL: Seed["values"] = [true, true, true, true];
const PRO: Seed["values"] = [false, true, true, true];
const BUSINESS: Seed["values"] = [false, false, true, true];
const ENTERPRISE: Seed["values"] = [false, false, false, true];

/** A row shown in the table and on cards with the same text. */
const both = (order: number, en: string, fr: string, extra: Partial<FeaturePricing> = {}): FeaturePricing => ({
  show: true,
  showOnCard: true,
  order,
  label: { en, fr },
  cardLabel: { en, fr },
  ...extra,
});
/** A row shown in the comparison table only. */
const tableOnly = (order: number, en: string, fr: string): FeaturePricing => ({
  ...both(order, en, fr),
  showOnCard: false,
});

const FEATURES: Record<FeatureKey, Seed> = {
  salesPromotions: {
    values: PRO,
    pricing: both(10, "Run sales and special offers on your shop", "Lancez des promotions et offres spéciales sur votre boutique", {
      hint: {
        en: "Event banners you can schedule and share, % off, and Sale badges",
        fr: "Bannières d'événement à programmer et partager, réductions en % et badges Promo",
      },
    }),
  },
  products: {
    values: [10, 50, null, null],
    pricing: {
      ...both(20, "Products", "Produits"),
      cardLabel: { en: "Up to {count} products", fr: "Jusqu'à {count} produits" },
      unlimitedLabel: { en: "Unlimited products", fr: "Produits illimités" },
    },
  },
  photosPerProduct: {
    values: [3, 6, 6, 6],
    pricing: {
      ...both(30, "Photos per product", "Photos par produit"),
      cardLabel: { en: "Up to {count} photos per product", fr: "Jusqu'à {count} photos par produit" },
    },
  },
  shopLink: { values: ALL, pricing: both(40, "Your Vano link", "Votre lien Vano") },
  whatsappOrders: { values: ALL, pricing: both(50, "WhatsApp orders", "Commandes sur WhatsApp") },
  allLooks: {
    values: PRO,
    pricing: {
      ...both(60, "All shop looks", "Tous les styles de boutique"),
      cardLabel: {
        en: "All shop looks, colors, profile photo styles, and banner",
        fr: "Tous les styles, couleurs, styles de photo de profil et bannière",
      },
      offLabel: { en: "1 basic shop look", fr: "1 style de boutique de base" },
    },
  },
  categoriesSizesColors: { values: PRO, pricing: both(70, "Categories, sizes, and colors", "Catégories, tailles et couleurs") },
  shopStats: {
    values: PRO,
    pricing: both(
      80,
      "Shop stats (views, WhatsApp clicks, best-viewed products)",
      "Statistiques (vues, clics WhatsApp, produits les plus vus)",
    ),
  },
  prioritySupport: { values: PRO, pricing: both(90, "Priority support", "Assistance prioritaire") },
  discountCodes: { values: BUSINESS, pricing: both(100, "Discount codes for customers", "Codes de réduction pour vos clients") },
  teamRoles: { values: BUSINESS, pricing: both(110, "Team accounts with roles", "Comptes d'équipe avec rôles") },
  orderTracking: {
    values: BUSINESS,
    pricing: both(120, "Order tracking (new, confirmed, delivered)", "Suivi des commandes (nouvelle, confirmée, livrée)"),
  },
  salesReports: {
    values: BUSINESS,
    pricing: both(130, "Sales tracking and monthly reports", "Suivi des ventes et rapports mensuels"),
  },
  multiShop: {
    values: ENTERPRISE,
    pricing: {
      ...both(140, "Several shops or branches", "Plusieurs boutiques ou succursales"),
      cardLabel: { en: "Several shops or branches in one account", fr: "Plusieurs boutiques ou succursales dans un compte" },
    },
  },
  personalizedSetup: {
    values: ENTERPRISE,
    pricing: both(150, "Personalized setup and onboarding", "Mise en place et accompagnement personnalisés"),
  },
  dedicatedSupport: { values: ENTERPRISE, pricing: both(160, "A dedicated contact person", "Un interlocuteur dédié") },
  customIntegrations: {
    values: ENTERPRISE,
    pricing: both(170, "Custom integrations (payments, delivery)", "Intégrations sur mesure (paiement, livraison)"),
  },
  serviceGuarantees: { values: ENTERPRISE, pricing: both(180, "Service guarantees", "Garanties de service") },
  colorsLogoBanner: { values: PRO, pricing: tableOnly(200, "Colors, logo, and banner", "Couleurs, logo et bannière") },
  featuredSections: {
    values: PRO,
    pricing: tableOnly(
      210,
      "Shop sections (sale, new arrivals, featured, back in stock, categories), their order and product layouts",
      "Sections de la boutique (promos, nouveautés, coups de cœur, retour en stock, catégories), leur ordre et la mise en page des produits",
    ),
  },
  announcementBar: {
    values: PRO,
    pricing: tableOnly(215, "Promo bar under your shop header", "Bandeau promo sous l'en-tête de votre boutique"),
  },
  customDomain: { values: BUSINESS, pricing: tableOnly(220, "Custom domain", "Nom de domaine personnalisé") },
  customBranding: { values: ENTERPRISE, pricing: tableOnly(230, "Custom branding", "Image de marque sur mesure") },
  qrShareImages: {
    values: PRO,
    pricing: tableOnly(
      240,
      "Shop QR code and share images for WhatsApp status and Instagram",
      "QR code de la boutique et images à partager en statut WhatsApp et sur Instagram",
    ),
  },
  stockLabels: { values: PRO, pricing: tableOnly(250, "Low-stock and Sold out labels", "Étiquettes Stock faible et Épuisé") },
  stockManagement: {
    values: BUSINESS,
    pricing: tableOnly(260, "Stock management with low-stock alerts", "Gestion du stock avec alertes de stock faible"),
  },
  customerList: {
    values: BUSINESS,
    pricing: tableOnly(270, "Customer list with order history", "Liste de clients avec historique des commandes"),
  },
  advancedStats: {
    values: BUSINESS,
    pricing: tableOnly(
      280,
      "Advanced stats (sales trends, best sellers, visitor sources)",
      "Statistiques avancées (tendances, meilleures ventes, sources des visiteurs)",
    ),
  },
  bulkUpload: {
    values: BUSINESS,
    pricing: tableOnly(290, "Bulk product upload from a spreadsheet", "Import de produits en masse depuis un tableur"),
  },
  teamMembers: {
    values: [0, 0, 5, 20],
    pricing: { ...tableOnly(300, "Team members", "Membres d'équipe"), show: false },
  },
};

export const DEFAULT_PLAN_CONFIG: PlanConfigData = {
  plans: PLANS,
  features: Object.fromEntries(
    FEATURE_KEYS.map((key) => {
      const [free, pro, business, enterprise] = FEATURES[key].values;
      return [key, { values: { free, pro, business, enterprise }, pricing: FEATURES[key].pricing }];
    }),
  ) as PlanConfigData["features"],
};
