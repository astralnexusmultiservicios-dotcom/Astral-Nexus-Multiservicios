# Cambio de la tienda anterior a v2

## Estado conocido

El repositorio original tiene un solo HTML y no contiene las reglas desplegadas, las funciones de servidor ni una exportación de Firestore. No se accedió a producción. Los nombres definitivos de sus colecciones y el contenido real de cuentas, inventario, códigos y transacciones deben obtenerse desde tu consola.

Por esa razón **no hay un importador automático de saldos**: inventar rutas o convertir importes sin conciliarlos podría duplicar dinero o perder historial. La aplicación nueva usa colecciones `nx_*` y no lee ni cambia las antiguas.

## Procedimiento de corte

1. Completar las pruebas de staging descritas en DESPLIEGUE.md.
2. Guardar la versión publicada actual, la configuración de sus dominios, las reglas vigentes y un respaldo consistente de Firestore. Conservar los usuarios de Authentication y sus UID.
3. Preparar un inventario de datos: usuarios, saldo, puntos, deuda, productos, inventario, códigos no vendidos, pedidos abiertos, referencias bancarias y obligaciones de referidos/recompensas.
4. Definir la conversión: saldo NIO → centavos enteros; puntos nuevos → unidades enteras. **Los puntos decimales del sistema anterior necesitan una política explícita de conversión.** No redondearlos en silencio.
5. Preparar y revisar el script de migración con los nombres de colecciones y muestras anonimizadas reales. Debe ser idempotente, producir un informe previo, rechazar duplicados y no sobrescribir cuentas existentes.
6. Poner en mantenimiento la tienda anterior y cerrar el ingreso de operaciones nuevas. Exportar nuevamente los cambios pendientes.
7. Importar usuarios manteniendo sus UID en `nx_users`; conservar historial anterior como archivo de solo lectura. Registrar un asiento de apertura por saldo/puntos/deuda y una referencia al lote de migración.
8. Separar catálogo público (`nx_products`) de códigos privados (`nx_stock`, `nx_codeFingerprints`). No publicar costos internos ni códigos dentro de productos.
9. Conciliar por usuario y en total: saldo, puntos, deuda, inventario y pedidos. Dos revisiones independientes son recomendables para datos monetarios. No activar si hay diferencias sin explicar.
10. Provisionar administración con el script de roles; no copiar `isAdmin` ni contraseñas desde perfiles antiguos.
11. Desplegar funciones v2, reglas restrictivas y web nueva durante la misma ventana de mantenimiento. Las reglas propuestas bloquean las colecciones antiguas.
12. Hacer pruebas controladas en producción, revisar logs y desactivar mantenimiento. Conservar respaldo y bitácora del corte.

## Reversión

Antes de aceptar operaciones nuevas, puede restaurarse el despliegue y las reglas anteriores usando los respaldos, después de revisar que sean seguros. **No restaurar reglas abiertas para resolver un fallo.**

Después de que v2 acepte operaciones, no debe restaurarse una copia antigua de los saldos. Primero detener operaciones, exportar el libro nuevo y conciliar todos los movimientos posteriores al corte. De lo contrario se puede devolver dinero ya gastado o borrar compras reales.

## Qué necesito para automatizar esta etapa en otra revisión

Un esquema de colecciones, las reglas actuales, el código de Functions y muestras **anonimizadas** de un perfil, un producto y un pedido. No compartir contraseñas, claves privadas, códigos canjeables ni datos personales de clientes. También sirven archivos de exportación preparados localmente para ejecutar el importador en tu equipo, sin publicarlos en GitHub.
