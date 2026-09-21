-- Invitación para que un usuario ya existente (alta hecha por un admin con
-- un email placeholder, ej. @sae.test) cargue su propio email real y elija
-- su contraseña por primera vez. Se guarda el hash del token (sha256), no el
-- token crudo — igual que password_hash, para que una fuga de la base no
-- deje ningún link activo utilizable. No hace falta bcrypt acá: el token no
-- lo elige una persona, tiene 256 bits de entropía generados con
-- crypto.randomBytes (ver lib/invitaciones.ts).

alter table usuario
  add column token_invitacion_hash text unique,
  add column token_invitacion_expira timestamptz;
