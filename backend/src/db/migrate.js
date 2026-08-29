import { withTransaction } from './index.js';
import { schemaStatements } from './schema.js';

export async function migrate() {
  await withTransaction(async (client) => {
    for (const statement of schemaStatements) await client.query(statement);
  });
}
