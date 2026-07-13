// Shared types for the live data.gov.tw open-data integration, imported by both
// the server proxy (pages/api/opendata/[id].ts) and the OpenDataPanel client.

export interface LiveDatasetResource {
  format: string;
  downloadUrl: string;
  encoding?: string;
  fields: string[];
}

export interface LiveDataset {
  id: string;
  title: string;
  provider: string;
  updateFrequency: string;
  license: string;
  modifiedDate: string;
  resources: LiveDatasetResource[];
  /** Union of every declared column across resources. */
  schemaFields: string[];
}
