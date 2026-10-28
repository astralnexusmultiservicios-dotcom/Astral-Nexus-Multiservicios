# Cómo activar Astral Nexus desde tu cuenta de Firebase

La conexión de ChatGPT no es necesaria para estos pasos. Debes realizarlos en una computadora usando el correo que tiene acceso al proyecto. No envíes contraseñas, archivos de cuenta de servicio ni claves privadas por chat.

## 1. Prepara una prueba separada

En [Firebase Console](https://console.firebase.google.com/), entra con el correo que administra el alojamiento actual. El código anterior apunta a `astral-nexus-af`; confirma en la consola que ese es realmente tu proyecto antes de modificarlo.

Crea primero un proyecto de pruebas, por ejemplo con un ID que incluya `staging`. **No despliegues todavía estas reglas en el proyecto antiguo:** bloquean las colecciones antiguas por diseño y la tienda anterior dejaría de poder operar.

En el proyecto de pruebas:

1. Habilita el plan de facturación requerido por Cloud Functions y configura alertas de presupuesto. Las alertas no son un límite automático de gasto.
2. Crea Firestore en modo producción y elige la ubicación apropiada antes de crearlo.
3. En Authentication, activa Correo/contraseña y Google. Configura el correo de soporte y verifica los dominios autorizados.
4. Registra una aplicación web y copia su configuración pública (`apiKey`, `authDomain`, `projectId`, `appId`).
5. En App Check, registra esa aplicación con **reCAPTCHA Enterprise**, incluye el dominio de Hosting de pruebas y conserva la clave pública del sitio. La función exige App Check; no lo desactives para resolver un error de configuración.

Referencias oficiales: [funciones callable](https://firebase.google.com/docs/functions/callable), [App Check para Functions](https://firebase.google.com/docs/app-check/cloud-functions), [reglas de Firestore](https://firebase.google.com/docs/firestore/security/get-started).

## 2. Obtén el código y las herramientas

Instala Git, Node.js 22 y Java 21 en tu computadora. Descarga la rama preparada:

```bash
git clone --branch codex/secure-platform-v2 https://github.com/astralnexusmultiservicios-dotcom/Astral-Nexus-Multiservicios.git
cd Astral-Nexus-Multiservicios/platform
npm ci
npm ci --prefix functions
npx firebase login --reauth
npx firebase projects:list
```

En el navegador que abre Firebase, elige **el correo que administra Firebase**, aunque sea distinto del correo de GitHub. En los comandos siguientes sustituye `TU_PROYECTO_STAGING` por el ID exacto que aparece en `projects:list`. No uses el nombre visual del proyecto.

## 3. Configura la web

Copia `web/.env.example` a `web/.env.local` y completa:

```dotenv
VITE_FIREBASE_API_KEY=valor_apiKey_de_la_app_web
VITE_FIREBASE_AUTH_DOMAIN=dominio_authDomain_de_la_app_web
VITE_FIREBASE_PROJECT_ID=TU_PROYECTO_STAGING
VITE_FIREBASE_APP_ID=valor_appId_de_la_app_web
VITE_APPCHECK_SITE_KEY=clave_publica_recaptcha_enterprise
VITE_FUNCTIONS_REGION=us-central1
```

Estos son identificadores públicos de la aplicación, no credenciales de administración. No pongas claves de servicio ni claves secretas en ninguna variable `VITE_*`. El archivo local está excluido de Git.

## 4. Ejecuta las pruebas y despliega staging

Desde `platform`:

```bash
npm test
npm run test:integration
npm run build
npx firebase deploy --project TU_PROYECTO_STAGING --only firestore,functions:nexus-v2,hosting
```

El despliegue no utiliza la cuenta conectada a ChatGPT: utiliza tu sesión local de Firebase. La consola/CLI mostrará la URL real de Hosting. Abre esa URL, registra tu correo administrador y verifica el mensaje recibido. Todavía no tendrá permisos administrativos.

Si falla por permisos, revisa el proyecto y el rol de tu cuenta en Google Cloud/Firebase. **No cambies las reglas a acceso público.** Si falla App Check, revisa proveedor, clave pública, dominio registrado y métricas de App Check.

## 5. Activa tu rol administrador

En Authentication copia el **UID** de tu usuario verificado. No uses el correo en lugar del UID.

El script de aprovisionamiento usa Google Application Default Credentials (ADC), que son distintas de la sesión de `firebase login`. Instala Google Cloud CLI en tu computadora y autentica la misma cuenta autorizada:

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project TU_PROYECTO_STAGING
```

Tu cuenta debe tener permisos para administrar ese usuario de Authentication y escribir el documento de equipo en Firestore. No descargues una clave JSON si puedes usar ADC.

En macOS/Linux, desde `platform`:

```bash
NEXUS_BOOTSTRAP_PROJECT=TU_PROYECTO_STAGING node functions/scripts/bootstrap-admin.mjs TU_PROYECTO_STAGING TU_UID_VERIFICADO
```

En PowerShell:

```powershell
$env:NEXUS_BOOTSTRAP_PROJECT="TU_PROYECTO_STAGING"
node functions/scripts/bootstrap-admin.mjs TU_PROYECTO_STAGING TU_UID_VERIFICADO
```

Cierra sesión y vuelve a ingresar para renovar el token. Verás Administración. No existe una contraseña administrativa compartida ni una casilla que permita a un cliente hacerse administrador.

## 6. Configura tu tienda

En Administración → Configuración, guarda el IVA aplicable, los puntos por compra, la recompensa diaria, las comisiones y las cuentas de depósitos. Los valores iniciales están desactivados o en cero, y la tienda comienza en mantenimiento. Usa los valores reales de tu negocio; el código no fija impuestos por ti.

En Catálogo, crea categorías/subcategorías mediante los campos del producto, publica productos y confirma ambos precios. Para productos digitales, carga códigos mediante Cargar códigos; nunca los pegues en la descripción pública.

Opcionalmente, para crear **un producto de prueba**, puedes ejecutar el script `functions/scripts/seed-staging.mjs` con `NEXUS_SEED_PROJECT` igual al proyecto. Solo admite IDs que contienen `staging`, no sobrescribe registros existentes y no crea saldos.

## 7. Prueba con dos cuentas

1. Registra un cliente de pruebas y verifica su correo.
2. Desde administración acredita un importe pequeño **ficticio de staging** mediante Ajustar saldo y deja un motivo claro.
3. Desactiva el mantenimiento de staging y compra un producto de prueba. Verifica el descuento, el pedido y el movimiento.
4. Reintenta la misma solicitud con las herramientas de prueba: no debe duplicar el cobro.
5. Confirma una entrega de servicio y revisa el recibo desde el cliente.
6. Prueba un depósito: debe quedar pendiente hasta que administración lo revise.
7. Prueba puntos, cupón, regalo, referido y transferencia con la segunda cuenta.
8. Verifica que un cliente no pueda abrir administración ni consultar documentos del otro.
9. Revisa App Check, registros de Functions, errores de autorización y alertas de presupuesto en la consola.

La vista que alojé en ChatGPT sigue siendo una revisión sin conexión. Tu versión operativa será la URL de Firebase Hosting que obtengas al desplegar con estas variables.

## 8. Pasa a producción solo después de conciliar

Sigue [MIGRACION.md](MIGRACION.md). No ejecutes el mismo comando contra `astral-nexus-af` sin preparar el cambio de datos, reglas, dominios y alojamiento. Si prefieres comenzar con cuentas nuevas, confirma primero cómo devolverás o trasladarás los saldos existentes.

Una vez validado el corte, los pasos de compilación/despliegue se repiten con la configuración pública y el ID de **producción**. El cambio de entorno exige recompilar: cambiar `.env.local` después de `npm run build` no modifica los archivos ya generados.
