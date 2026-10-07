# Laboratorio 4: Sistema de Delivery P1

Sistema distribuido de entregas a domicilio inspirado en plataformas como Rappi, desarrollado con **Backend en Node.js (Express + TypeScript)** y **Frontend en Next.js**, utilizando **PostgreSQL** mediante el driver nativo **`pg`**.

---

## 🚀 Cómo Ejecutar el Proyecto

### 1. Base de Datos (PostgreSQL)

1. Asegúrate de tener el servicio de PostgreSQL en ejecución en tu equipo (puerto por defecto `5432`).
2. Verifica la base de datos `delivery_db`. Si no existe, puedes crearla mediante `psql` o pgAdmin:
   ```sql
   CREATE DATABASE delivery_db;
   ```
3. Revisa la configuración en [server/.env](file:///C:/Users/softa/Downloads/rappi%20lab/Lab%20rappi/server/.env):
   ```env
   DATABASE_URL=postgresql://postgres:12345@localhost:5432/delivery_db
   PORT=3001
   JWT_SECRET=supersecret123
   ```
   *(Las tablas `users`, `stores`, `products`, `orders` y `order_items` con claves `UUID` se inicializan automáticamente al levantar el servidor backend).*

---

### 2. Cómo Correr el Backend (Servidor Express)

Abre una terminal (PowerShell o CMD) y ejecuta:

```powershell
cd server
npm install
npm run dev
```

El servidor quedará escuchando en:  
🌐 **`http://localhost:3001`**

---

### 3. Cómo Correr el Frontend (Cliente Next.js)

Abre una **segunda** terminal y ejecuta:

```powershell
cd client
npm install
npm run dev
```

La aplicación web cliente estará disponible en:  
🌐 **`http://localhost:3000`**

---

## 👥 Flujo de Prueba y Demostración (Video de Validación)

El sistema soporta 3 roles con redirección automatizada tras el login:

### Paso 1: Tienda (`store`)
1. Ingresa a `http://localhost:3000/register`.
2. Selecciona el rol **Administrador de Tienda (store)** y diligencia el campo obligatorio **Nombre de la Tienda** (ej. *Pizzería Napolitana*).
3. Inicia sesión en `/login` -> Serás redirigido automáticamente a:
   👉 **`/store-admin`**
4. Agrega productos con su nombre y precio en COP (ej. *Pizza Mediana - $25,000*).
5. Edita el nombre de algún producto.
6. Observa que por defecto la tienda está **Cerrada**. Deja la tienda cerrada para la siguiente prueba.

### Paso 2: Cliente Regular (`consumer`)
1. En otra pestaña o navegador (o cerrando sesión), regístrate como **Cliente (consumer)**.
2. Inicia sesión en `/login` -> Serás redirigido automáticamente a:
   👉 **`/client`**
3. **Validación de Tienda Cerrada**:
   - En la lista solo aparecen tiendas abiertas.
   - Si se accede directamente a una tienda cerrada, la pantalla muestra la advertencia y el botón de compra queda **bloqueado/deshabilitado**.
   - En el backend, la capa de servicio (`OrderService`) valida estrictamente y rechaza cualquier intento de compra con código 400.
4. Regresa con la cuenta de tienda a `/store-admin` y presiona **"Abrir Tienda"** (`is_open: true`).
5. En la cuenta de cliente, refresca `/client`: la tienda aparecerá abierta.
6. Selecciona los productos, define cantidades y haz clic en **"Confirmar y Crear Orden"**.
7. Serás redirigido a **`/client/orders`** donde verás la orden en estado `waiting_for_deliver`.

### Paso 3: Domiciliario (`delivery`)
1. Regístrate como **Domiciliario (delivery)**.
2. Inicia sesión en `/login` -> Serás redirigido automáticamente a:
   👉 **`/delivery`**
3. En la sección **"Órdenes Disponibles"**, verás la orden con estado `waiting_for_deliver`.
4. Haz clic en **"Ver Detalle"** o **"Aceptar Orden"**.
   - Si otro repartidor ya la tomó, el sistema mostrará un error en pantalla.
   - Al aceptarla, pasará a tu lista activa con estado **`in_progress`**.
5. Prueba el flujo de **"Soltar / Rechazar"**:
   - Al soltar la orden, regresa a `waiting_for_deliver` y `delivery_id = null`, quedando disponible nuevamente para otros repartidores.
6. Acéptala nuevamente y presiona **"Marcar Entregada"**:
   - La orden pasa a **`delivered`**.
7. En la cuenta del cliente (`/client/orders`) y de la tienda (`/store-admin`), la orden reflejará en tiempo real el estado `delivered`.

---

## 🏛️ Arquitectura y Desacoplamiento a SQL

- **Diagrama de Arquitectura**: Disponible en [`src/docs/architecture.png`](file:///C:/Users/softa/Downloads/rappi%20lab/Lab%20rappi/src/docs/architecture.png) y [`docs/architecture.png`](file:///C:/Users/softa/Downloads/rappi%20lab/Lab%20rappi/docs/architecture.png).
- **Documento Explicativo**: [`src/docs/ARCHITECTURE.md`](file:///C:/Users/softa/Downloads/rappi%20lab/Lab%20rappi/src/docs/ARCHITECTURE.md).
- **Driver `pg` Exclusivo**: Todas las operaciones a la base de datos se ejecutan con sentencias SQL nativas parametrizadas y transacciones `BEGIN / COMMIT / ROLLBACK` mediante `pg.Pool`, cumpliendo la restricción estricta de **cero uso de ORMs**.
- **Capa de Servicios**: Desacopla la lógica de negocio de la infraestructura HTTP y la base de datos, validando reglas críticas como el estado `is_open` y el control de concurrencia en la toma de órdenes.
