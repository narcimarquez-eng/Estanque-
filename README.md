# Estanque-
Prueba estanque 

## Rocas (Blender)

Las rocas del estanque y del riachuelo se modelan con Blender (módulo `bpy`) y se guardan
dentro de `index.html`, entre las marcas `ROCAS:INICIO` y `ROCAS:FIN`:

```bash
pip install bpy numpy
python3 tools/generar_rocas.py index.html
```

Para cambiar la forma de las piedras, edita `TIPOS` en `tools/generar_rocas.py` y vuelve a ejecutarlo.
