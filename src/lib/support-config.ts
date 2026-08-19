export type SupportLinks = {
  bmcUrl?: string;
  kofiUrl?: string;
  label: string;
};

const DEFAULT_SUPPORT_LABEL = "Keep the receipts honest";

function readEnvironmentValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function getSupportLinks(): SupportLinks {
  return {
    bmcUrl: readEnvironmentValue(process.env.NEXT_PUBLIC_BMC_URL),
    kofiUrl: readEnvironmentValue(process.env.NEXT_PUBLIC_KOFI_URL),
    label: readEnvironmentValue(process.env.NEXT_PUBLIC_SUPPORT_LABEL) ?? DEFAULT_SUPPORT_LABEL,
  };
}

export function isSupportConfigured(links: SupportLinks) {
  return Boolean(links.bmcUrl || links.kofiUrl);
}
