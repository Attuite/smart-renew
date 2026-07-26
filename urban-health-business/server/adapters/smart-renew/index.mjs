import { LegacyCapabilityRegistry } from './capabilities.mjs';
import { FieldAdapter } from './field-adapter.mjs';
import { LegacyMigrationAdapter } from './legacy-migration-adapter.mjs';
import { ProjectDataAdapter } from './project-data-adapter.mjs';
import { ReportSnapshotAdapter } from './report-snapshot-adapter.mjs';

export function createSmartRenewAdapters(client) {
  return Object.freeze({
    capabilities: new LegacyCapabilityRegistry(),
    field: new FieldAdapter(client),
    projectData: new ProjectDataAdapter(client),
    legacyMigration: new LegacyMigrationAdapter(client),
    reportSnapshots: new ReportSnapshotAdapter(client)
  });
}
