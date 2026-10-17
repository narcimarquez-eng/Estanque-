"""Modela las rocas del estanque con Blender (módulo bpy) y las incrusta en index.html.

Uso (desde la raíz del repo):
    pip install bpy numpy
    python3 tools/generar_rocas.py index.html

El script reemplaza el bloque entre las marcas ROCAS:INICIO y ROCAS:FIN de index.html.
Cada roca es una icosfera deformada con la textura de ruido "Clouds" de Blender y
guardada como geometría indexada en base64, así que el HTML sigue funcionando abierto
directamente desde el disco, sin cargar ningún archivo extra.
"""
import base64
import sys

import bpy  # debe importarse antes de bmesh: es el que registra el módulo
import bmesh
import numpy as np
from mathutils import Vector

MARCA_INICIO = '/* ROCAS:INICIO (generado por tools/generar_rocas.py, no editar a mano) */'
MARCA_FIN = '/* ROCAS:FIN */'

# Mismo orden que rockMats en index.html: canto, musgo, caliza, granito.
TIPOS = [
    dict(semilla=(1.0, 2.0, 3.0), forma=(1.0, 1.0, 1.0), ruido=0.30, escala_ruido=1.6, musgo=0.0),
    dict(semilla=(4.0, 5.0, 6.0), forma=(1.0, 0.95, 1.0), ruido=0.28, escala_ruido=1.4, musgo=0.8),
    dict(semilla=(7.0, 8.0, 9.0), forma=(1.1, 0.90, 0.9), ruido=0.42, escala_ruido=2.2, musgo=0.0),
    dict(semilla=(10.0, 11.0, 12.0), forma=(1.0, 0.95, 1.0), ruido=0.35, escala_ruido=1.9, musgo=0.0),
]
VARIANTES = 2
SUBDIVISIONES = 3  # 162 vértices por roca: la misma resolución que la antigua IcosahedronGeometry(1, 2)


def textura_ruido(escala):
    tex = bpy.data.textures.new('ruido', type='CLOUDS')
    tex.noise_scale = escala
    tex.noise_depth = 4
    return tex


def modelar_roca(tipo, rng):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=SUBDIVISIONES, radius=1.0)
    obj = bpy.context.active_object
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bpy.data.objects.remove(obj, do_unlink=True)

    tex = textura_ruido(tipo['escala_ruido'])
    desplazamiento = Vector(tuple(rng.uniform(-50, 50, 3)))  # cada variante ve otra parte del ruido
    for v in bm.verts:
        p = Vector(v.co)
        n = tex.evaluate(p * tipo['escala_ruido'] + desplazamiento)[0]  # 0..1
        p *= 1.0 + tipo['ruido'] * (n - 0.5) * 2.0
        v.co = Vector((p.x * tipo['forma'][0], p.y * tipo['forma'][1], p.z * tipo['forma'][2]))
    bm.verts.index_update()
    bm.faces.index_update()

    posiciones = np.array([v.co for v in bm.verts], dtype='<f4')
    caras = np.array([[v.index for v in f.verts] for f in bm.faces], dtype='<u2')
    # Color: tinte del tipo más una variación de ruido; el musgo cubre las caras que miran arriba
    colores = []
    for v in bm.verts:
        n2 = tex.evaluate(v.co * tipo['escala_ruido'] * 1.7 + desplazamiento)[0]
        c = np.array(tipo['color']) * (0.85 + 0.3 * n2)
        if tipo['musgo'] > 0 and v.co.normalized().z > 0.35 and n2 > 0.45:
            c = c * (1 - tipo['musgo']) + np.array((0.33, 0.42, 0.18)) * tipo['musgo']
        colores.append(np.clip(c * 255, 0, 255))
    colores = np.array(colores, dtype='<u1')
    bm.free()
    bpy.data.textures.remove(tex)
    return posiciones, caras, colores


def codificar(arreglo):
    return base64.b64encode(arreglo.tobytes()).decode('ascii')


def bloque_js(rocas):
    lineas = [MARCA_INICIO, '// rocas[tipo][variante] = { p: vértices Float32, i: triángulos Uint16, c: colores RGB Uint8 }',
              'const ROCAS_BLENDER = [']
    for tipo_rocas in rocas:
        lineas.append('  [')
        for p, i, c, nombre in tipo_rocas:
            lineas.append(f"    {{ n: '{nombre}', p: '{codificar(p)}', i: '{codificar(i)}', c: '{codificar(c)}' }},")
        lineas.append('  ],')
    lineas += [']', MARCA_FIN]
    return '\n'.join(lineas)


def main(ruta_html):
    rng = np.random.default_rng(20260417)
    bpy.ops.wm.read_factory_settings(use_empty=True)

    nombres = ['canto', 'musgo', 'caliza', 'granito']
    colores_base = [(0.45, 0.42, 0.36), (0.34, 0.40, 0.25), (0.68, 0.66, 0.58), (0.36, 0.34, 0.33)]
    rocas = []
    for k, tipo in enumerate(TIPOS):
        tipo = dict(tipo, color=colores_base[k])
        fila = []
        for v in range(VARIANTES):
            p, i, c = modelar_roca(tipo, rng)
            fila.append((p, i, c, f'{nombres[k]}-{v + 1}'))
        rocas.append(fila)

    with open(ruta_html, encoding='utf-8') as f:
        html = f.read()
    inicio = html.index(MARCA_INICIO)
    fin = html.index(MARCA_FIN) + len(MARCA_FIN)
    html = html[:inicio] + bloque_js(rocas) + html[fin:]
    with open(ruta_html, 'w', encoding='utf-8') as f:
        f.write(html)
    total = sum(len(p) for fila in rocas for p, _, _, _ in fila)
    print(f'{len(rocas) * VARIANTES} rocas escritas en {ruta_html} ({total} vértices en total)')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'index.html')
