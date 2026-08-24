// Tipos TypeScript del modelo de datos. Mantenidos a mano (sin generador Supabase).
// Cada tabla tiene tres variantes: Row (lectura), Insert (creación), Update (modificación parcial).

// === Enums ===================================================================

export type RolUsuario = 'miembro' | 'coordinador' | 'administrador';
export type EstadoUsuario = 'pendiente' | 'activo' | 'inactivo';
export type EstadoTarea = 'por_hacer' | 'en_progreso' | 'hecha';
export type PrioridadTarea = 'baja' | 'media' | 'alta';
export type TipoAdjunto = 'archivo' | 'enlace';

// === organizacion ============================================================

export interface OrganizacionRow {
  id: string;
  nombre: string;
  slug: string;
  logo_url: string | null;
  zona_horaria: string;
  color_principal: string | null;
  fondo_tipo: 'gradiente' | 'imagen' | null;
  fondo_valor: string | null;
  creada_en: string;
}

export interface OrganizacionInsert {
  id?: string;
  nombre: string;
  slug: string;
  logo_url?: string | null;
  zona_horaria?: string;
  color_principal?: string | null;
  fondo_tipo?: 'gradiente' | 'imagen' | null;
  fondo_valor?: string | null;
}

export type OrganizacionUpdate = Partial<OrganizacionInsert>;

// === usuario =================================================================

export interface UsuarioRow {
  id: string;
  organizacion_id: string;
  nombre: string;
  email: string;
  password_hash: string;
  avatar_url: string | null;
  rol: RolUsuario;
  estado: EstadoUsuario;
  creada_en: string;
  playlist_url: string | null;
  avatar_color: string | null;
  ultimo_login: string | null;
  es_cuenta_generica: boolean;
}

export interface UsuarioInsert {
  id?: string;
  organizacion_id: string;
  nombre: string;
  email: string;
  password_hash: string;
  avatar_url?: string | null;
  rol?: RolUsuario;
  estado?: EstadoUsuario;
  playlist_url?: string | null;
  avatar_color?: string | null;
  es_cuenta_generica?: boolean;
}

export type UsuarioUpdate = Partial<Omit<UsuarioInsert, 'organizacion_id'>>;

// === area ====================================================================

export interface AreaRow {
  id: string;
  organizacion_id: string;
  nombre: string;
  color: string;
  descripcion: string | null;
  responsable_id: string | null;
  activa: boolean;
  creada_en: string;
  archivada_en: string | null;
}

export interface AreaInsert {
  id?: string;
  organizacion_id: string;
  nombre: string;
  color: string;
  descripcion?: string | null;
  responsable_id?: string | null;
  activa?: boolean;
}

export type AreaUpdate = Partial<Omit<AreaInsert, 'organizacion_id'>>;

// === tarea ===================================================================

export interface TareaRow {
  id: string;
  organizacion_id: string;
  area_id: string;
  titulo: string;
  descripcion: string | null;
  responsable_id: string | null;
  estado: EstadoTarea;
  prioridad: PrioridadTarea;
  fecha_vencimiento: string | null;
  recurrencia: unknown | null;
  google_event_id: string | null;
  creada_por: string;
  creada_en: string;
  completada_en: string | null;
  orden: number;
  archivada: boolean;
  archivada_en: string | null;
  duracion_estimada_hs: number | null;
  duracion_real_hs: number | null;
}

export interface TareaInsert {
  id?: string;
  organizacion_id: string;
  area_id: string;
  titulo: string;
  descripcion?: string | null;
  responsable_id?: string | null;
  estado?: EstadoTarea;
  prioridad?: PrioridadTarea;
  fecha_vencimiento?: string | null;
  recurrencia?: unknown | null;
  google_event_id?: string | null;
  creada_por: string;
  completada_en?: string | null;
  orden?: number;
  archivada?: boolean;
  duracion_estimada_hs?: number | null;
  duracion_real_hs?: number | null;
}

export type TareaUpdate = Partial<Omit<TareaInsert, 'organizacion_id' | 'creada_por'>>;

// === comentario ==============================================================

export interface ComentarioRow {
  id: string;
  tarea_id: string;
  autor_id: string;
  contenido: string;
  creado_en: string;
}

export interface ComentarioInsert {
  id?: string;
  tarea_id: string;
  autor_id: string;
  contenido: string;
}

export type ComentarioUpdate = Pick<ComentarioInsert, 'contenido'>;

// === adjunto =================================================================

export interface AdjuntoRow {
  id: string;
  tarea_id: string;
  nombre: string;
  tipo: TipoAdjunto;
  url: string;
  subido_por: string;
  creado_en: string;
}

export interface AdjuntoInsert {
  id?: string;
  tarea_id: string;
  nombre: string;
  tipo: TipoAdjunto;
  url: string;
  subido_por: string;
}

export type AdjuntoUpdate = Pick<AdjuntoInsert, 'nombre' | 'url'>;

// === acceso_rapido ===========================================================

export interface AccesoRapidoRow {
  id: string;
  organizacion_id: string;
  area_id: string | null;
  etiqueta: string;
  url: string;
  icono: string | null;
  orden: number;
}

export interface AccesoRapidoInsert {
  id?: string;
  organizacion_id: string;
  area_id?: string | null;
  etiqueta: string;
  url: string;
  icono?: string | null;
  orden?: number;
}

export type AccesoRapidoUpdate = Partial<Omit<AccesoRapidoInsert, 'organizacion_id'>>;

// === turno ===================================================================

export interface TurnoRow {
  id: string;
  organizacion_id: string;
  usuario_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  vigente_desde: string;
  vigente_hasta: string | null;
}

export interface TurnoInsert {
  id?: string;
  organizacion_id: string;
  usuario_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  vigente_desde?: string;
  vigente_hasta?: string | null;
}

export type TurnoUpdate = Partial<
  Pick<TurnoInsert, 'hora_inicio' | 'hora_fin' | 'vigente_desde' | 'vigente_hasta'>
>;

// === bitacora_diaria =========================================================

export interface BitacoraDiariaRow {
  id: string;
  organizacion_id: string;
  usuario_id: string;
  fecha: string;
  hecho: string | null;
  pendiente: string | null;
  observaciones: string | null;
  creada_en: string;
}

export interface BitacoraDiariaInsert {
  id?: string;
  organizacion_id: string;
  usuario_id: string;
  fecha?: string;
  hecho?: string | null;
  pendiente?: string | null;
  observaciones?: string | null;
}

export type BitacoraDiariaUpdate = Partial<
  Pick<BitacoraDiariaInsert, 'hecho' | 'pendiente' | 'observaciones'>
>;
