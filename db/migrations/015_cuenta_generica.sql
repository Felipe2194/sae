-- Cuenta compartida de oficina: en las computadoras de la facultad se loguea
-- una sola vez con esta cuenta y después cada quien elige su perfil desde
-- /cambiar-perfil sin volver a poner contraseña (ver auth.ts, provider
-- "quick-switch"). No suma política de RLS nueva: usuario_select ya alcanza
-- para listar los perfiles de la organización en el selector.

alter table usuario add column es_cuenta_generica boolean not null default false;
