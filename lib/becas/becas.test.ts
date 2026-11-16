// Pruebas de la lógica pura del módulo Becas (no tocan la base).

import { describe, expect, it } from 'vitest';
import {
  armarFilas,
  clasificarFilas,
  detectarColumnas,
  detectarFilaEncabezados,
  interpretarCondicion,
  normalizarDni,
  sanearFilas,
  separarApellidoNombre,
  textoCelda,
} from '@/lib/becas/importacion';
import { detectarConflictos } from '@/lib/becas/conflictos';
import type { Asignacion } from '@/lib/becas/tipos';

describe('normalizarDni', () => {
  it('acepta el DNI como número, con puntos o con ".0" de Excel', () => {
    expect(normalizarDni(43929086)).toBe('43929086');
    expect(normalizarDni('43.929.086')).toBe('43929086');
    expect(normalizarDni('43929086.0')).toBe('43929086');
    expect(normalizarDni(' 4392 9086 ')).toBe('43929086');
  });

  it('saca el DNI de adentro de un CUIL', () => {
    expect(normalizarDni('20-45090375-3')).toBe('45090375');
    expect(normalizarDni(27445495706)).toBe('44549570');
  });

  it('descarta lo que no es un DNI', () => {
    expect(normalizarDni(null)).toBeNull();
    expect(normalizarDni('')).toBeNull();
    expect(normalizarDni('DNI')).toBeNull();
    expect(normalizarDni('Legajo 14973')).toBeNull();
    expect(normalizarDni(24)).toBeNull(); // subtotal de módulos
    expect(normalizarDni(14973)).toBeNull(); // un legajo
  });
});

describe('textoCelda', () => {
  it('no deja números con decimales ni notación científica', () => {
    expect(textoCelda(16965)).toBe('16965');
    expect(textoCelda(3534787209)).toBe('3534787209');
    expect(textoCelda('  Ing.   Química ')).toBe('Ing. Química');
    expect(textoCelda('   ')).toBeNull();
  });
});

describe('detectarColumnas', () => {
  it('reconoce el listado nacional de Manuel Belgrano', () => {
    const m = detectarColumnas([
      'Unidad Académica', 'Título', 'Apellido', 'Nombre', 'DNI', 'E-mail', 'Nro Móvil',
      'G. Prioritario', 'Categoria', 'Legajo',
    ]);
    expect(m.carrera).toBe(1);
    expect(m.apellido).toBe(2);
    expect(m.nombre).toBe(3);
    expect(m.dni).toBe(4);
    expect(m.email).toBe(5);
    expect(m.telefono).toBe(6);
    expect(m.condicion).toBe(8);
    expect(m.legajo).toBe(9);
    expect(m.apellido_nombre).toBeNull();
  });

  it('reconoce la planilla de Investigación y Servicio', () => {
    const m = detectarColumnas([null, 'ÁREA', 'MÓDULO', 'TIPO', 'TUTOR', 'APELLIDO', 'NOMBRES', 'LEG.', 'D.N.I. Nº']);
    expect(m.area).toBe(1);
    expect(m.modulos).toBe(2);
    expect(m.tutor).toBe(4);
    expect(m.apellido).toBe(5);
    expect(m.nombre).toBe(6);
    expect(m.legajo).toBe(7);
    expect(m.dni).toBe(8);
  });

  it('prefiere "Apellido y Nombre" como una sola columna', () => {
    const m = detectarColumnas(['Marca temporal', 'Dirección de correo electrónico', 'Apellido y Nombre', 'DNI']);
    expect(m.apellido_nombre).toBe(2);
    expect(m.apellido).toBeNull();
    expect(m.email).toBe(1);
  });
});

describe('detectarFilaEncabezados', () => {
  it('saltea los títulos de arriba', () => {
    const hoja = [
      [null, null, 'INFORME - SEPTIEMBRE'],
      [null, 'DECANATO'],
      [null, 'ÁREA', 'MÓDULO', 'TIPO', 'TUTOR', 'APELLIDO', 'NOMBRES', 'LEG.', 'D.N.I.'],
      [null, 'CICOM', 2, 'S', 'Ing. X', 'Ferraro', 'Franco', 14973, 44472781],
    ];
    expect(detectarFilaEncabezados(hoja)).toBe(2);
  });
});

describe('separarApellidoNombre e interpretarCondicion', () => {
  it('separa solo cuando hay coma', () => {
    expect(separarApellidoNombre('Abregú Palma, Iván')).toEqual({ apellido: 'Abregú Palma', nombre: 'Iván' });
    expect(separarApellidoNombre('Vasconi Suárez Anabella')).toEqual({
      apellido: 'Vasconi Suárez Anabella',
      nombre: '',
    });
  });

  it('lee la condición y el rechazo de la misma columna', () => {
    expect(interpretarCondicion('RENOVANTE')).toEqual({ condicion: 'Renovante', estado: 'activa' });
    expect(interpretarCondicion('NUEVO POSTULANTE')).toEqual({ condicion: 'Nuevo', estado: 'activa' });
    expect(interpretarCondicion('nuevos_inscriptos')).toEqual({ condicion: 'Nuevo', estado: 'activa' });
    expect(interpretarCondicion('RECHAZADO')).toEqual({ condicion: null, estado: 'rechazada' });
    expect(interpretarCondicion(null)).toEqual({ condicion: null, estado: 'activa' });
  });
});

describe('armarFilas', () => {
  const hoja = [
    [null, 'DECANATO'],
    [null, 'ÁREA', 'MÓDULO', 'TIPO', 'TUTOR', 'APELLIDO', 'NOMBRES', 'LEG.', 'D.N.I.'],
    [null, 'CICOM', 2, 'S', 'Ing. Mussetta', 'Ferraro', 'Franco Valentin', 14973, 44472781],
    [null, 'CICOM', 2, 'S', 'Ing. Mussetta', 'Lelli', 'Matías', 14985, 44204416],
    [null, null, 24], // subtotal
    [],
    [null, 'INGENIERÍA EN SISTEMAS DE INFORMACIÓN'], // título de bloque
    [null, 'ÁREA', 'MÓDULO', 'TIPO', 'TUTOR', 'APELLIDO', 'NOMBRES', 'LEG.', 'D.N.I. Nº'],
    [null, 'Desarrollo', 2, null, 'Ing. Cassani', 'Medina', 'Lisandro', 15669, 46455011],
    [null, 'Desarrollo', 2, null, 'Ing. Cassani', 'Ferraro', 'Franco Valentin', 14973, 44472781], // repetido
  ];

  it('se queda con las filas que tienen DNI y descarta títulos, subtotales y repetidos', () => {
    const fila = detectarFilaEncabezados(hoja);
    const r = armarFilas(hoja, fila, detectarColumnas(hoja[fila]));
    expect(r.filas.map((f) => f.dni)).toEqual(['44472781', '44204416', '46455011']);
    expect(r.descartadas).toBe(3);
    expect(r.repetidas).toBe(1);
    expect(r.filas[0]).toMatchObject({
      fila: 3,
      apellido: 'Ferraro',
      nombre: 'Franco Valentin',
      legajo: '14973',
      area: 'CICOM',
      tutor: 'Ing. Mussetta',
      modulos: 2,
      estado: 'activa',
    });
  });
});

describe('sanearFilas', () => {
  it('descarta basura y normaliza lo que manda el navegador', () => {
    const filas = sanearFilas([
      { fila: 2, dni: '43.929.086', apellido: '  Perez ', nombre: 'Ludmila', email: 'A@B.com', estado: 'cualquiera', modulos: 2.5 },
      { dni: 'abc', apellido: 'X' },
      { dni: '43929086', apellido: 'Repetido' },
      'no soy un objeto',
      null,
    ]);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      dni: '43929086',
      apellido: 'Perez',
      email: 'a@b.com',
      estado: 'activa',
      modulos: null,
    });
    expect(sanearFilas('nada')).toEqual([]);
  });
});

describe('clasificarFilas', () => {
  it('distingue nuevos, existentes, los que ya la tienen y los conflictos', () => {
    const base = {
      nombre: '', legajo: null, carrera: null, email: null, telefono: null, condicion: null,
      area: null, departamento: null, tutor: null, modulos: null,
    };
    const filas = [
      { ...base, fila: 2, dni: '1000001', apellido: 'Nuevo', estado: 'activa' as const },
      { ...base, fila: 3, dni: '1000002', apellido: 'Existente', estado: 'activa' as const },
      { ...base, fila: 4, dni: '1000003', apellido: 'YaTiene', estado: 'activa' as const },
      { ...base, fila: 5, dni: '1000004', apellido: 'Choca', estado: 'activa' as const },
      { ...base, fila: 6, dni: '1000005', apellido: 'Rechazado', estado: 'rechazada' as const },
    ];
    const r = clasificarFilas(
      filas,
      new Set(['1000002', '1000003', '1000004', '1000005']),
      new Set(['1000003']),
      new Map([
        ['1000004', ['Manuel Belgrano']],
        ['1000005', ['Manuel Belgrano']],
      ]),
    );
    expect(r.map((f) => f.situacion)).toEqual(['nuevo', 'existente', 'ya_tiene', 'conflicto', 'existente']);
    expect(r[3].choca_con).toEqual(['Manuel Belgrano']);
  });
});

describe('detectarConflictos', () => {
  const asignacion = (id: string, estudiante: string, programa: string, extra: Partial<Asignacion> = {}): Asignacion => ({
    id,
    estudiante_id: estudiante,
    programa_id: programa,
    anio: 2025,
    condicion: null,
    estado: 'activa',
    area_id: null,
    modulos: null,
    observaciones: null,
    ...extra,
  });
  const pares = [{ programa_a: 'iys', programa_b: 'mb' }];

  it('marca dos becas activas incompatibles del mismo estudiante y año', () => {
    const c = detectarConflictos(
      [asignacion('a1', 'e1', 'mb'), asignacion('a2', 'e1', 'iys'), asignacion('a3', 'e2', 'mb')],
      pares,
    );
    expect(c).toHaveLength(1);
    expect(c[0].estudiante_id).toBe('e1');
    expect([c[0].a.id, c[0].b.id]).toEqual(['a1', 'a2']);
  });

  it('no cuenta bajas, rechazadas, otros años ni programas compatibles', () => {
    expect(
      detectarConflictos(
        [
          asignacion('a1', 'e1', 'mb'),
          asignacion('a2', 'e1', 'iys', { estado: 'baja' }),
          asignacion('a3', 'e2', 'mb'),
          asignacion('a4', 'e2', 'iys', { estado: 'rechazada' }),
          asignacion('a5', 'e3', 'mb'),
          asignacion('a6', 'e3', 'iys', { anio: 2024 }),
          asignacion('a7', 'e4', 'mb'),
          asignacion('a8', 'e4', 'base'),
        ],
        pares,
      ),
    ).toEqual([]);
  });
});
