export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      acceso_rapido: {
        Row: {
          area_id: string | null;
          etiqueta: string;
          icono: string | null;
          id: string;
          orden: number;
          organizacion_id: string;
          url: string;
        };
        Insert: {
          area_id?: string | null;
          etiqueta: string;
          icono?: string | null;
          id?: string;
          orden?: number;
          organizacion_id: string;
          url: string;
        };
        Update: {
          area_id?: string | null;
          etiqueta?: string;
          icono?: string | null;
          id?: string;
          orden?: number;
          organizacion_id?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "acceso_rapido_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "area";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "acceso_rapido_organizacion_id_fkey";
            columns: ["organizacion_id"];
            isOneToOne: false;
            referencedRelation: "organizacion";
            referencedColumns: ["id"];
          },
        ];
      };
      adjunto: {
        Row: {
          creado_en: string;
          id: string;
          nombre: string;
          subido_por: string;
          tarea_id: string;
          tipo: Database["public"]["Enums"]["tipo_adjunto"];
          url: string;
        };
        Insert: {
          creado_en?: string;
          id?: string;
          nombre: string;
          subido_por: string;
          tarea_id: string;
          tipo: Database["public"]["Enums"]["tipo_adjunto"];
          url: string;
        };
        Update: {
          creado_en?: string;
          id?: string;
          nombre?: string;
          subido_por?: string;
          tarea_id?: string;
          tipo?: Database["public"]["Enums"]["tipo_adjunto"];
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "adjunto_subido_por_fkey";
            columns: ["subido_por"];
            isOneToOne: false;
            referencedRelation: "usuario";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "adjunto_tarea_id_fkey";
            columns: ["tarea_id"];
            isOneToOne: false;
            referencedRelation: "tarea";
            referencedColumns: ["id"];
          },
        ];
      };
      area: {
        Row: {
          activa: boolean;
          color: string;
          creada_en: string;
          descripcion: string | null;
          id: string;
          nombre: string;
          organizacion_id: string;
          responsable_id: string | null;
        };
        Insert: {
          activa?: boolean;
          color: string;
          creada_en?: string;
          descripcion?: string | null;
          id?: string;
          nombre: string;
          organizacion_id: string;
          responsable_id?: string | null;
        };
        Update: {
          activa?: boolean;
          color?: string;
          creada_en?: string;
          descripcion?: string | null;
          id?: string;
          nombre?: string;
          organizacion_id?: string;
          responsable_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "area_organizacion_id_fkey";
            columns: ["organizacion_id"];
            isOneToOne: false;
            referencedRelation: "organizacion";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "area_responsable_id_fkey";
            columns: ["responsable_id"];
            isOneToOne: false;
            referencedRelation: "usuario";
            referencedColumns: ["id"];
          },
        ];
      };
      bitacora_diaria: {
        Row: {
          creada_en: string;
          fecha: string;
          hecho: string | null;
          id: string;
          observaciones: string | null;
          organizacion_id: string;
          pendiente: string | null;
          usuario_id: string;
        };
        Insert: {
          creada_en?: string;
          fecha?: string;
          hecho?: string | null;
          id?: string;
          observaciones?: string | null;
          organizacion_id: string;
          pendiente?: string | null;
          usuario_id: string;
        };
        Update: {
          creada_en?: string;
          fecha?: string;
          hecho?: string | null;
          id?: string;
          observaciones?: string | null;
          organizacion_id?: string;
          pendiente?: string | null;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bitacora_diaria_organizacion_id_fkey";
            columns: ["organizacion_id"];
            isOneToOne: false;
            referencedRelation: "organizacion";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bitacora_diaria_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "usuario";
            referencedColumns: ["id"];
          },
        ];
      };
      comentario: {
        Row: {
          autor_id: string;
          contenido: string;
          creado_en: string;
          id: string;
          tarea_id: string;
        };
        Insert: {
          autor_id: string;
          contenido: string;
          creado_en?: string;
          id?: string;
          tarea_id: string;
        };
        Update: {
          autor_id?: string;
          contenido?: string;
          creado_en?: string;
          id?: string;
          tarea_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comentario_autor_id_fkey";
            columns: ["autor_id"];
            isOneToOne: false;
            referencedRelation: "usuario";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comentario_tarea_id_fkey";
            columns: ["tarea_id"];
            isOneToOne: false;
            referencedRelation: "tarea";
            referencedColumns: ["id"];
          },
        ];
      };
      organizacion: {
        Row: {
          creada_en: string;
          id: string;
          logo_url: string | null;
          nombre: string;
          slug: string;
          zona_horaria: string;
        };
        Insert: {
          creada_en?: string;
          id?: string;
          logo_url?: string | null;
          nombre: string;
          slug: string;
          zona_horaria?: string;
        };
        Update: {
          creada_en?: string;
          id?: string;
          logo_url?: string | null;
          nombre?: string;
          slug?: string;
          zona_horaria?: string;
        };
        Relationships: [];
      };
      tarea: {
        Row: {
          area_id: string;
          completada_en: string | null;
          creada_en: string;
          creada_por: string;
          descripcion: string | null;
          estado: Database["public"]["Enums"]["estado_tarea"];
          fecha_vencimiento: string | null;
          google_event_id: string | null;
          id: string;
          orden: number;
          organizacion_id: string;
          prioridad: Database["public"]["Enums"]["prioridad_tarea"];
          recurrencia: Json | null;
          responsable_id: string | null;
          titulo: string;
        };
        Insert: {
          area_id: string;
          completada_en?: string | null;
          creada_en?: string;
          creada_por: string;
          descripcion?: string | null;
          estado?: Database["public"]["Enums"]["estado_tarea"];
          fecha_vencimiento?: string | null;
          google_event_id?: string | null;
          id?: string;
          orden?: number;
          organizacion_id: string;
          prioridad?: Database["public"]["Enums"]["prioridad_tarea"];
          recurrencia?: Json | null;
          responsable_id?: string | null;
          titulo: string;
        };
        Update: {
          area_id?: string;
          completada_en?: string | null;
          creada_en?: string;
          creada_por?: string;
          descripcion?: string | null;
          estado?: Database["public"]["Enums"]["estado_tarea"];
          fecha_vencimiento?: string | null;
          google_event_id?: string | null;
          id?: string;
          orden?: number;
          organizacion_id?: string;
          prioridad?: Database["public"]["Enums"]["prioridad_tarea"];
          recurrencia?: Json | null;
          responsable_id?: string | null;
          titulo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tarea_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "area";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tarea_creada_por_fkey";
            columns: ["creada_por"];
            isOneToOne: false;
            referencedRelation: "usuario";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tarea_organizacion_id_fkey";
            columns: ["organizacion_id"];
            isOneToOne: false;
            referencedRelation: "organizacion";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tarea_responsable_id_fkey";
            columns: ["responsable_id"];
            isOneToOne: false;
            referencedRelation: "usuario";
            referencedColumns: ["id"];
          },
        ];
      };
      turno: {
        Row: {
          dia_semana: number;
          hora_fin: string;
          hora_inicio: string;
          id: string;
          organizacion_id: string;
          usuario_id: string;
          vigente_desde: string;
          vigente_hasta: string | null;
        };
        Insert: {
          dia_semana: number;
          hora_fin: string;
          hora_inicio: string;
          id?: string;
          organizacion_id: string;
          usuario_id: string;
          vigente_desde?: string;
          vigente_hasta?: string | null;
        };
        Update: {
          dia_semana?: number;
          hora_fin?: string;
          hora_inicio?: string;
          id?: string;
          organizacion_id?: string;
          usuario_id?: string;
          vigente_desde?: string;
          vigente_hasta?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "turno_organizacion_id_fkey";
            columns: ["organizacion_id"];
            isOneToOne: false;
            referencedRelation: "organizacion";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "turno_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "usuario";
            referencedColumns: ["id"];
          },
        ];
      };
      usuario: {
        Row: {
          avatar_url: string | null;
          creada_en: string;
          email: string;
          estado: Database["public"]["Enums"]["estado_usuario"];
          id: string;
          nombre: string;
          organizacion_id: string;
          rol: Database["public"]["Enums"]["rol_usuario"];
        };
        Insert: {
          avatar_url?: string | null;
          creada_en?: string;
          email: string;
          estado?: Database["public"]["Enums"]["estado_usuario"];
          id: string;
          nombre: string;
          organizacion_id: string;
          rol?: Database["public"]["Enums"]["rol_usuario"];
        };
        Update: {
          avatar_url?: string | null;
          creada_en?: string;
          email?: string;
          estado?: Database["public"]["Enums"]["estado_usuario"];
          id?: string;
          nombre?: string;
          organizacion_id?: string;
          rol?: Database["public"]["Enums"]["rol_usuario"];
        };
        Relationships: [
          {
            foreignKeyName: "usuario_organizacion_id_fkey";
            columns: ["organizacion_id"];
            isOneToOne: false;
            referencedRelation: "organizacion";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      estado_tarea: "por_hacer" | "en_progreso" | "hecha";
      estado_usuario: "pendiente" | "activo" | "inactivo";
      prioridad_tarea: "baja" | "media" | "alta";
      rol_usuario: "miembro" | "coordinador" | "administrador";
      tipo_adjunto: "archivo" | "enlace";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      estado_tarea: ["por_hacer", "en_progreso", "hecha"],
      estado_usuario: ["pendiente", "activo", "inactivo"],
      prioridad_tarea: ["baja", "media", "alta"],
      rol_usuario: ["miembro", "coordinador", "administrador"],
      tipo_adjunto: ["archivo", "enlace"],
    },
  },
} as const;
