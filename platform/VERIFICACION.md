# Verificación de la versión v2

## Ejecutado el 28 de octubre de 2026

- Compilación de la web Vite: correcta.
- 12 pruebas unitarias: cálculos enteros, impuesto/descuento, precios manipulados, cantidades inválidas, inventario agregado, IDs, saldo insuficiente, desbordamiento, transiciones y fecha de Nicaragua.
- 8 pruebas de reglas en Firestore Emulator: aislamiento de cuentas, rechazo de escrituras de cliente, rechazo de autoasignación de rol, doble verificación de administrador y protección de códigos/regalos.
- 13 pruebas de integración con transacciones reales en Firestore Emulator: compras simultáneas y reintentos, colisión de identificadores, intentos de administración, cambio de precio, recompensa duplicada, aprobación duplicada, último stock, suspensión, transferencia con comisión, regalo duplicado, reembolso único, límite de intentos y código digital repetido.
- Auditoría de dependencias de ejecución (`npm audit --omit=dev`) de web y servidor: 0 vulnerabilidades reportadas al finalizar la revisión de dependencias. El resultado es puntual y no certifica ausencia de fallos.

Las pruebas de integración llaman al manejador de servidor contra el emulador. No prueban la infraestructura externa de Authentication, App Check, Google Cloud IAM, correo, dominios ni facturación. La función publicada exige App Check; esa verificación debe probarse después de desplegar en staging.

El navegador sin configuración muestra únicamente la vista de revisión. Los saldos vacíos no son cuentas reales, las referencias del catálogo no se importan al backend y no se ejecutan cobros de muestra.

## Controles pendientes de la cuenta de Firebase

- Prueba de extremo a extremo con Authentication y App Check reales.
- Roles e IAM del proyecto, cuotas, alertas, monitoreo y recuperación.
- Configuración y revisión de dominios/CSP en el alojamiento real.
- Revisión de datos de producción, estrategia de migración y conciliación.
- Prueba del negocio para entrega de recargas, verificación de depósitos y atención de reembolsos.

No se ha accedido ni modificado `astral-nexus-af`. El HTML anterior sigue en la raíz del repositorio y conserva su comportamiento hasta que su alojamiento sea reemplazado deliberadamente.
