import 'dotenv/config';
import { app } from './app.js';
import { checkDatabase } from './db/index.js';
import { migrate } from './db/migrate.js';

const port = Number(process.env.PORT || 3333);

async function start() {
  await checkDatabase();
  await migrate();
  app.listen(port, '0.0.0.0', () => {
    console.log(`Fluxo API disponível na porta ${port}`);
  });
}

start().catch((error) => {
  console.error('Falha ao iniciar a API', error);
  process.exit(1);
});
