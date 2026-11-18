import { config } from 'dotenv';
import { exigirBaseLocal } from './db/exigir-base-local';

config({ path: '.env.local' });

// Los tests de RLS crean y borran organizaciones y usuarios de prueba: no
// deben correr nunca contra producción, que es adonde puede apuntar
// .env.local (ver db/exigir-base-local.ts). En esta máquina:
//   DATABASE_URL=postgresql://postgres:postgres@localhost:5433/sae npm test
exigirBaseLocal('npm test');
