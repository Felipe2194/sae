// Pruebas de las utilidades puras de lib/ (no tocan la base).

import { describe, expect, it } from 'vitest';
import { ErrorDeUsuario, esErrorDeUsuario, mensajeDeError } from '@/lib/errores';
import { urlSegura } from '@/lib/utils';
import { generarPasswordTemporal } from '@/lib/passwords';
import { generarTokenInvitacion, hashToken } from '@/lib/invitaciones';
import { generarCodigoPublico } from '@/lib/viajes/codigo';
import {
  CAMPOS_FORMULARIO_DEFAULT,
  normalizarCamposFormulario,
} from '@/lib/viajes/campos-formulario';

describe('errores para la persona', () => {
  it('ErrorDeUsuario lleva el mensaje en el digest y mensajeDeError lo recupera', () => {
    const err = new ErrorDeUsuario('Solo el responsable puede editar.');
    expect(esErrorDeUsuario(err)).toBe(true);
    expect(mensajeDeError(err, 'respaldo')).toBe('Solo el responsable puede editar.');
  });

  it('sobrevive a perder el mensaje, como pasa al cruzar del servidor al navegador en producción', () => {
    const original = new ErrorDeUsuario('La tarea no existe.');
    // En producción llega un Error genérico que solo conserva `digest`.
    const recibido = Object.assign(new Error('An error occurred in the Server Components render.'), {
      digest: original.digest,
    });
    expect(mensajeDeError(recibido, 'respaldo')).toBe('La tarea no existe.');
  });

  it('cualquier otro error muestra el texto de respaldo, nunca su mensaje interno', () => {
    expect(mensajeDeError(new Error('relation "usuario" does not exist'), 'No se pudo guardar.')).toBe(
      'No se pudo guardar.',
    );
    expect(mensajeDeError(Object.assign(new Error('x'), { digest: '123456' }), 'respaldo')).toBe('respaldo');
    expect(mensajeDeError(null, 'respaldo')).toBe('respaldo');
    expect(mensajeDeError('texto suelto', 'respaldo')).toBe('respaldo');
  });
});

describe('urlSegura', () => {
  it('acepta http y https', () => {
    expect(urlSegura('https://drive.google.com/file/d/1')).toBe('https://drive.google.com/file/d/1');
    expect(urlSegura('http://ejemplo.com')).toBe('http://ejemplo.com/');
  });

  it('rechaza esquemas que ejecutan código o no son web', () => {
    expect(urlSegura('javascript:alert(1)')).toBeNull();
    expect(urlSegura('JAVASCRIPT:alert(1)')).toBeNull();
    expect(urlSegura('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(urlSegura('file:///etc/passwd')).toBeNull();
  });

  it('rechaza lo que no es una URL', () => {
    expect(urlSegura('no es una url')).toBeNull();
    expect(urlSegura('')).toBeNull();
  });
});

describe('generadores', () => {
  it('la contraseña temporal respeta el largo y evita caracteres ambiguos', () => {
    for (let i = 0; i < 50; i++) {
      const p = generarPasswordTemporal();
      expect(p).toHaveLength(10);
      expect(p).not.toMatch(/[0O1lI]/);
    }
    expect(generarPasswordTemporal(16)).toHaveLength(16);
  });

  it('el token de invitación se guarda hasheado y el hash es reproducible', () => {
    const { token, hash } = generarTokenInvitacion();
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(hash).toBe(hashToken(token));
    expect(hash).not.toContain(token);
    expect(generarTokenInvitacion().token).not.toBe(token);
  });

  it('el código público de un viaje usa solo el alfabeto sin ambiguos', () => {
    for (let i = 0; i < 50; i++) {
      expect(generarCodigoPublico()).toMatch(/^[2-9A-HJ-NP-Z]{8}$/);
    }
  });
});

describe('campos del formulario de inscripción', () => {
  it('sin configuración, todo queda requerido', () => {
    expect(normalizarCamposFormulario(null)).toEqual(CAMPOS_FORMULARIO_DEFAULT);
    expect(normalizarCamposFormulario(undefined)).toEqual(CAMPOS_FORMULARIO_DEFAULT);
  });

  it('una configuración parcial se completa con el default', () => {
    const campos = normalizarCamposFormulario({ legajo: 'oculto', telefono: 'opcional' });
    expect(campos.legajo).toBe('oculto');
    expect(campos.telefono).toBe('opcional');
    expect(campos.email).toBe('requerido');
  });
});
