# Bolsa de Donación / Préstamo de Medicamentos (MVP)

Sitio estático (Netlify) + Netlify Functions + Google Sheets (Apps Script) como base de datos.

## Qué hace
- Publicar ofertas (donación/préstamo) desde Excel (carga semanal).
- Ver ofertas en una tabla con filtros.
- Marcar una oferta como **Reservado** (para trazabilidad/estadísticas).
- Ver estadísticas básicas.

> Importante: Es un sistema de **avisos**. La logística/legal (actas, cadena de frío, controlados, etc.) se gestiona por los canales institucionales habituales.

---

## 1) Crear Google Sheet y Apps Script

1. Crea un Google Sheet.
2. Extensiones -> Apps Script.
3. Pega `apps_script/Code.gs` en el editor.
4. En Apps Script -> Project Settings -> Script Properties:
   - `API_TOKEN` = (un token largo/aleatorio)
5. Deploy -> New deployment -> Web app:
   - Execute as: **Me**
   - Who has access: Anyone / Anyone in your org (según política)
6. Copia la URL del Web App (APPS_SCRIPT_URL).

---

## 2) Subir el sitio a Netlify

1. Sube este repo a GitHub (o arrastra carpeta en Netlify).
2. Netlify -> Site settings -> Environment variables:
   - `APPS_SCRIPT_URL` = URL Web App
   - `API_TOKEN` = el mismo token
   - `SITE_KEY` = clave para publicar y reservar (la compartes con referentes)

---

## 3) Uso

### Ver
- Tab “Ver ofertas” -> botón “Actualizar”.

### Publicar
- Tab “Publicar / Actualizar”
- Ingresa SITE_KEY
- Sube el Excel con columnas:

Obligatorias:
- Medicamento, Presentacion, Lote, Vencimiento, Cantidad, Establecimiento, ContactoEmail

Opcionales:
- Tipo (Normal/Refrigerado/Controlado)
- Observaciones

### Reservar
- En la tabla “Ver ofertas”, botón “Reservar” (requiere SITE_KEY)

---

## 4) Plantilla Excel
Incluye una plantilla sugerida en: `Plantilla_Donaciones_Prestamos.xlsx`

---

## Notas de operación (recomendadas)
- Carga semanal (ej. lunes).
- Cada carga **reemplaza** las ofertas “Disponible” anteriores del mismo establecimiento (evita duplicados).
- En reserva, se registra `reservadoPor` y fecha.
