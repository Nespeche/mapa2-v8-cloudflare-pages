import { APP_VERSION_NAME } from './appVersion';
import { BUSINESS_CONTRACT_VERSION, BUSINESS_EXPECTED_COUNTS, BUSINESS_EXPECTED_PERIOD, KPI_SEMANTICS } from './businessContracts';
import { CLOUDFLARE_PAGES_LIMITS, GEO_CONTRACT_VERSION, GEO_EXPECTED_COUNTS, GEO_LOADING_CONTRACT, TERRITORIAL_MODEL } from './geoContracts';

export const DATA_CONTRACTS = {
  phase: APP_VERSION_NAME,
  territorialModel: TERRITORIAL_MODEL,
  business: {
    version: BUSINESS_CONTRACT_VERSION,
    expectedCounts: BUSINESS_EXPECTED_COUNTS,
    expectedPeriod: BUSINESS_EXPECTED_PERIOD,
    kpiSemantics: KPI_SEMANTICS,
  },
  geo: {
    version: GEO_CONTRACT_VERSION,
    expectedCounts: GEO_EXPECTED_COUNTS,
    loadingContract: GEO_LOADING_CONTRACT,
    cloudflarePagesLimits: CLOUDFLARE_PAGES_LIMITS,
  },
} as const;
