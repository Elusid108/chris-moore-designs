// Resolves store configuration. Public Storefront values live in
// content/settings.json (written by the CMS); GitHub Actions variables or a
// local .env override them so a token can be rotated without a commit.
import settings from '../../content/settings.json';

export type Settings = typeof settings;
export const SETTINGS: Settings = settings;

const env = import.meta.env as Record<string, string | undefined>;
export const SHOPIFY_DOMAIN: string = env.PUBLIC_SHOPIFY_DOMAIN || settings.shopify.domain || '';
export const SHOPIFY_TOKEN: string = env.PUBLIC_SHOPIFY_STOREFRONT_TOKEN || settings.shopify.storefrontToken || '';
export const SHOPIFY_API_VERSION: string = env.PUBLIC_SHOPIFY_API_VERSION || settings.shopify.apiVersion || '2026-07';
export const shopifyConfigured = Boolean(SHOPIFY_DOMAIN && SHOPIFY_TOKEN);
