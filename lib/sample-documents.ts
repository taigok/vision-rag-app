export interface SampleDocument {
  id: string;
  name: string;
  description: string;
  basePath: string; // S3での基本パス (samples/document-id/)
  totalPages: number;
  imageCount: number;
}

export const SAMPLE_DOCUMENTS: SampleDocument[] = [
  {
    id: 'daiwa-securities-plan',
    name: '大和証券中期経営計画',
    description: '経営戦略、業績目標、事業計画、組織体制などの中期経営方針',
    basePath: 'samples/daiwa-securities-plan',
    totalPages: 71,
    imageCount: 71
  }
];