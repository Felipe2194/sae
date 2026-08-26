-- Se discontinúa el rol "coordinador": de acá en más solo existen "miembro"
-- y "administrador". No se achica el enum rol_usuario (dropear un valor
-- requiere recrear el tipo, lo que arrastra a mi_rol() —que lo devuelve— y a
-- cada política RLS que lo usa en toda la app; demasiado riesgo para cero
-- beneficio funcional). En cambio:
--   1. Se reasignan a 'miembro' los usuarios que hoy son 'coordinador'.
--   2. Un check constraint bloquea a nivel de base que alguien vuelva a
--      quedar con ese valor (la UI ya no lo ofrece, esto es la garantía dura).
-- Las políticas RLS que todavía comparan contra 'coordinador' (por ejemplo
-- mi_rol() in ('coordinador', 'administrador')) quedan con esa rama muerta:
-- inofensivo, nunca se va a volver a cumplir.

update usuario set rol = 'miembro' where rol = 'coordinador';

alter table usuario add constraint usuario_rol_sin_coordinador check (rol <> 'coordinador');
