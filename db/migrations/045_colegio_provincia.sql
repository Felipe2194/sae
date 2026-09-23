-- Reemplaza "Zona / Región" en el alta de visitas: lo que el equipo necesita
-- distinguir rápido es si el colegio es de Córdoba (cercano, sin costos de
-- traslado/viáticos) o del resto del país, así que ahora se pide provincia,
-- de una lista fija, en vez de un campo de texto libre. La columna zona no se
-- borra -- sigue en el directorio de colegios (colegios-cliente.tsx) para no
-- perder lo ya cargado -- pero deja de pedirse al crear una visita.

alter table colegio add column provincia text;

alter table colegio add constraint colegio_provincia_valida check (
  provincia is null or provincia = any(array[
    'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut',
    'Ciudad Autónoma de Buenos Aires', 'Córdoba', 'Corrientes', 'Entre Ríos',
    'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
    'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz',
    'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
  ])
);
