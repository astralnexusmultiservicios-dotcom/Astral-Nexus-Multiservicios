# Astral Nexus · plataforma v2

Implementación nueva en `platform/`. El `index.html` original permanece intacto. La vista alojada sin variables de Firebase es **una revisión de interfaz**, no una tienda conectada: los formularios no simulan pagos exitosos ni crean saldos.

## Incluido

- Acceso por correo verificado o Google mediante Firebase Authentication.
- Catálogo con categoría/subcategoría, imágenes, inventario y precios separados en córdobas y puntos.
- Cotización calculada por servidor y confirmación del importe; bloqueo si el precio cambia.
- Compras con billetera o puntos, IDs de jugador, códigos digitales privados y recibos imprimibles.
- Depósitos con referencia y revisión administrativa, transferencias con comisión, deuda y abonos.
- Recompensa diaria, regalos, cupones, referidos y sorteos **gratuitos**.
- Administración de productos, códigos, usuarios, depósitos, entregas, devoluciones pendientes, ajustes y ventas externas.
- Bitácora, movimientos de saldo, control de mantenimiento y cuentas bancarias.

Los módulos utilizan `nexusApi` y colecciones `nx_*`. No se conectan a las colecciones antiguas. Córdobas se guardan como centavos enteros; los puntos son unidades enteras.

## Seguridad implementada

Firestore rechaza toda escritura del navegador, incluidos administradores. El servidor valida cada solicitud con esquemas estrictos, cuenta verificada, estado de cuenta, rol de equipo más custom claim, App Check, límites de intentos e identificador de operación. Precios, descuentos, inventario, saldos y comisiones se calculan con datos del servidor dentro de transacciones. Los códigos digitales no forman parte del catálogo público. Auditoría y movimientos se escriben junto a la operación. Los reintentos no cobran dos veces.

No se reutiliza la contraseña administrativa ni la recomendación de abrir Firestore del código antiguo. La versión antigua no queda protegida por añadir esta carpeta: hasta completar el cambio de alojamiento y reglas, seguirá siendo una aplicación independiente.

## Arranque local

Requisitos: Node 22, npm y Java 21 recomendado (las pruebas locales también se ejecutaron con Java 17 usando Firebase CLI 14).

```bash
cd platform
npm ci
npm ci --prefix functions
npm test
npm run test:integration
npm run build
```

`web/.env.example` contiene las variables públicas necesarias. Sin ellas se compila la vista de revisión. Las credenciales administrativas solo se utilizan mediante Application Default Credentials en el equipo del operador; nunca se copian a `web/`, GitHub ni al chat.

## Documentación

- [DESPLIEGUE.md](DESPLIEGUE.md): pasos para la cuenta que administra Firebase.
- [MIGRACION.md](MIGRACION.md): transición y conciliación de datos de la tienda existente.
- [VERIFICACION.md](VERIFICACION.md): pruebas ejecutadas y límites de la validación.

## Límites explícitos

- La vista carga hasta 200 registros por colección y lo advierte en el resumen administrativo. Los totales se refieren a esa ventana, no a la contabilidad histórica completa.
- No se procesa un pago bancario automáticamente. La aprobación exige que administración verifique el ingreso fuera de la aplicación.
- No se integró una pasarela de pagos ni un proveedor real de recargas; los servicios se gestionan como pedidos pendientes y se entregan desde administración.
- No se envían correos de pedidos ni WhatsApp automáticamente; no hay credenciales de un proveedor de notificaciones. Firebase gestiona los correos de acceso/verificación.
- Los sorteos no tienen cobro de entradas. Las rifas pagadas del prototipo no se migran.
- No se importaron clientes, saldos, códigos ni historial de producción. No se configuraron conversiones de divisas; el libro contable usa NIO.
- Los pedidos con códigos ya entregados o pagos externos no se reembolsan automáticamente. Requieren una conciliación documentada. Las devoluciones con recompensas o comisiones ya gastadas también se bloquean para evitar saldos negativos.
- App Check, IAM, facturación, dominios y correo real requieren validación en el proyecto de destino. Ninguna prueba local es garantía de seguridad absoluta.
