-- Superadmin de plataforma: separado de rol_usuario (que es siempre relativo
-- a una organización). Habilita /plataforma, donde se crean organizaciones
-- (secretarías) nuevas y se les asigna su primer administrador. No hay
-- políticas RLS nuevas para esto — las acciones de plataforma corren con la
-- conexión superuser (igual que el alta automática de usuarios por Google en
-- auth.ts), gateadas a mano por es_superadmin en el server action.

alter table usuario add column es_superadmin boolean not null default false;
