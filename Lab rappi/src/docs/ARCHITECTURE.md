# Arquitectura del Sistema - Laboratorio 4: Delivery App

Este documento presenta la explicación técnica, sustentación de las interfaces y el desacoplamiento preparado para la persistencia en base de datos PostgreSQL mediante el driver nativo `pg`, dando cumplimiento estricto a las especificaciones del Laboratorio 4.

---

## 1. Diagrama de Arquitectura

El diagrama general del sistema se encuentra disponible en la ruta:
- `src/docs/architecture.png`
- `docs/architecture.png`

```
+-----------------------------------------------------------------------------------+
|                            CAPA DE PRESENTACIÓN (CLIENTE)                         |
|                             Next.js 16 + React Context                            |
|                                                                                   |
|  [AuthContext] -> Manejo de Sesión (Token JWT + Datos de Usuario)                 |
|  [Pantalla 1]  -> /client         (Listado de Tiendas Abiertas)                   |
|  [Pantalla 2]  -> /client/stores  (Menú, Cantidades, Bloqueo si is_open: false)   |
|  [Pantalla 3]  -> /client/orders  (Consulta de Órdenes y Estados en Tiempo Real)  |
|  [Admin Store] -> /store-admin    (Toggle is_open, CRUD de Productos, Ver Órdenes)|
|  [Delivery]    -> /delivery       (Órdenes Disponibles, Aceptar, Soltar, Entregar)|
+------------------------------------------+----------------------------------------+
                                           | HTTP Requests (REST JSON + JWT Bearer)
                                           v
+-----------------------------------------------------------------------------------+
|                               API GATEWAY & SEGURIDAD                             |
|                                Express + TypeScript                               |
|                                                                                   |
|  • Router Centralizado: /api                                                      |
|  • Middleware authMiddleware: Control estricto de acceso basado en roles          |
|    - 'consumer'  -> Endpoints de cliente                                          |
|    - 'store'     -> Endpoints de administración de tienda                         |
|    - 'delivery'  -> Endpoints de repartidor/domiciliario                          |
+------------------------------------------+----------------------------------------+
                                           v
+-----------------------------------------------------------------------------------+
|                               CAPA DE CONTROLADORES                               |
|                                                                                   |
|  • AuthController: Registro y Login                                               |
|  • StoreController: Tiendas abiertas, toggle de estado, productos                |
|  • OrderController: Creación y consulta de pedidos                                |
|  • DeliveryController: Asignación, entrega y liberación de órdenes                |
+------------------------------------------+----------------------------------------+
                                           v
+-----------------------------------------------------------------------------------+
|                        CAPA DE SERVICIOS (LÓGICA DE NEGOCIO)                      |
|                                                                                   |
|  • AuthService: Validación y creación atómica de tienda en rol 'store'            |
|  • StoreService: Filtrado y alternancia de estado de apertura                     |
|  • OrderService (VALIDACIÓN CRÍTICA):                                             |
|    - Valida que la tienda esté abierta (is_open: true) antes de crear la orden.  |
|    - Control de concurrencia: Evita que dos repartidores tomen la misma orden.    |
|    - Máquina de estados: waiting_for_deliver <-> in_progress -> delivered         |
+------------------------------------------+----------------------------------------+
                                           v
+-----------------------------------------------------------------------------------+
|                         CAPA DE ACCESO A DATOS (DRIVER pg)                        |
|                                                                                   |
|  • Conexión mediante Pool de la librería nativa 'pg'                              |
|  • Consultas SQL parametrizadas ($1, $2) para evitar SQL Injection                |
|  • Manejo explícito de transacciones ACID: BEGIN, COMMIT y ROLLBACK               |
|  • Cumplimiento estricto: Cero uso de ORMs (Prisma, TypeORM, Sequelize, etc.)     |
+------------------------------------------+----------------------------------------+
                                           v
+-----------------------------------------------------------------------------------+
|                                BASE DE DATOS RELACIONAL                           |
|                               PostgreSQL (delivery_db)                            |
|                                                                                   |
|  • users       (id UUID PK, name, email, password, role)                          |
|  • stores      (id UUID PK, name, is_open, user_owner_id UUID FK)                 |
|  • products    (id UUID PK, name, price INTEGER, store_id UUID FK)                |
|  • orders      (id UUID PK, client_id UUID FK, delivery_id UUID FK, status, ...)  |
|  • order_items (id UUID PK, order_id UUID FK, product_id UUID FK, quantity)       |
+-----------------------------------------------------------------------------------+
```

---

## 2. Desacoplamiento y Sustento de Interfaces

El sistema implementa una **Arquitectura en Capas Limpia (Clean Layered Architecture)**:

1. **Desacoplamiento entre Presentación y Negocio**:
   El cliente Next.js desconoce los detalles de la base de datos relacional. Consume un contrato de API REST con tipos e interfaces TypeScript tipadas (`User`, `Store`, `Product`, `Order`, `OrderItem`).

2. **Capa de Controladores vs Capa de Servicios**:
   Los controladores se limitan a recibir el request HTTP, extraer parámetros y enviar respuestas con códigos HTTP semánticos (200, 201, 400, 401, 403, 404, 500). Toda regla de negocio reside exclusivamente en la **Capa de Servicios**:
   - **Regla de Tienda Cerrada**: Si un cliente intenta enviar una orden a una tienda con `is_open: false`, la capa `OrderService` rechaza la transacción con un error, garantizando integridad sin importar si la petición provino de la interfaz web o de herramientas externas como Postman.
   - **Regla de Concurrencia de Domiciliarios**: `OrderService.acceptOrder` implementa transacciones atómicas con bloqueo de fila (`SELECT ... FOR UPDATE`), asegurando que si dos domiciliarios intentan aceptar la misma orden simultáneamente, solo uno lo consiga y el otro reciba el error correspondiente en pantalla.

3. **Capa de Acceso a Datos Puramente SQL con `pg`**:
   No se utiliza ningún ORM (Prisma, TypeORM, Hibernate, etc.). Todas las consultas son SQL nativo mediante el driver `pg`:
   - Claves primarias y foráneas de tipo `UUID` generadas nativamente con `gen_random_uuid()`.
   - Agrupamiento JSON eficiente en PostgreSQL (`json_agg`, `json_build_object`) para retornar la orden junto con sus items asociados en una única consulta optimizada.
