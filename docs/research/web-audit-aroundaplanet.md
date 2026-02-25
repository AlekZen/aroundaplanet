# Auditoría Web — aroundaplanet.odoo.com

> Fecha: 24 febrero 2026
> Auditor: Claude/NEXUS (Knowledge Curator)
> Propósito: Documentar navegación, contenido e imágenes del sitio actual para migración a nueva plataforma

---

## 1. Información General del Sitio

| Campo | Valor |
|---|---|
| **URL** | https://aroundaplanet.odoo.com |
| **Título** | Aroundaplanet \| Camina con Nosotros |
| **Plataforma** | Odoo Website + eCommerce (Odoo 18 Enterprise) |
| **Teléfono** | +52 392-922-6479 |
| **Email** | aroundaplanet123@gmail.com |
| **Dirección** | Álvaro Obregón 182 C, Ocotlán, Jalisco, México |
| **Slogan** | "Camina con Nosotros" |
| **Fundado** | 1 abril 2017 (8 años en 2025) |
| **CEO** | Noel Sahagún Cervantes |
| **YouTube** | youtube.com/@Aroundaplanet |
| **Aniversario** | "Aniversario no. 8 AroundaPlanet" (carousel principal) |

### Redes Sociales (footer global)
- Facebook: `/website/social/facebook`
- TikTok: `/website/social/tiktok` + `tiktok.com/@aroundaplanet_oficial`
- YouTube: `youtube.com/@Aroundaplanet`
- Pinterest: `pinterest.com/aroundaplanet/`
- Video embebido en footer: "Aniversario 8 AroundaPlanet" (YouTube playlist)

---

## 2. Mapa de Navegación Completo

```
Inicio (/)
├── Tienda (/shop) — 36 productos, 2 páginas
├── Eventos (/event) — VACÍO "Todavía no hay eventos programados"
├── Servicios (/our-services) — Vuelos, Traslados, Hoteles
├── Empresa (dropdown)
│   ├── Noticias (/blog/noticias-2) — VACÍO "Todavía no hay publicaciones"
│   └── Historias Aroundaplanet (/blog/historias-aroundaplanet-3) — VACÍO
├── Sobre nosotros (/about-us) — Historia empresa + bio Noel
├── Help (/helpdesk/atencion-al-cliente-1) — Formulario tickets
└── Contáctanos (dropdown)
    ├── Formulario contacto (/contactus)
    └── Agentes (/agentes) — ~70+ agentes, 3 sucursales

Blog adicional: /blog/viaje-1 (también vacío)
Footer links: Inicio, Productos, Política de privacidad (/privacy), Ayuda
```

### Hallazgos de Navegación
- **"Servicios" tiene contenido mal editado** — texto "Our values" en inglés, "aHOTELES" como typo
- **3 blogs creados pero todos vacíos** — Viaje, Noticias, Historias
- **Eventos vacío** — módulo instalado pero sin uso
- **Popup newsletter** aparece en homepage después de 5 segundos (modal)

---

## 3. Páginas Detalladas

### 3.1 Homepage (/)

**Carrusel principal**: 10 slides con fotos de viajes grupales
- Slide activo: "Aniversario no. 8 AroundaPlanet" — Gracias por viajar con nosotros desde el primero de abril de 2017

**Sección Riviera Maya** (destacada):
- Del 21 al 25 septiembre 2026
- 5 días, 4 noches
- Hotel: OCCIDENTAL AT XCARET DESTINATION
- Plan TODO INCLUIDO (no incluye traslados)
- Vuelo: GDL 11:41 AM → 03:10 PM TQO / TQO 03:45 PM → 05:28 PM GDL
- Aparta con $2,500 p/p, liquida hasta 07 agosto 2026
- Precio: $14,490 MXN

**Sección Mundial 2026**:
- "Aroundaplanet te lleva al Mundial 2026!"
- Link a: /shop/mundial-2026-1586

**Destinos Internacionales destacados** (cards):
- Colombia, Chiapas, Ruta Maya, Perú, Cuba

**Grid de destinos** (imágenes con links a tienda):
- Turquía y Dubái, Medio Oriente, Europa Sin Tours, Vuelta al Mundo, Tailandia, Europa Inolvidable, Turquía Winter Nov 2025, Turquía Winter Ene 2026

**Aventuras 2026**:
- Tokyo, Beijing & Seúl 2026 (con descripción completa)
- Perú 2026 (con descripción completa)

**Grandes Sorpresas 2026**:
- Chiapas Oct 2025, Chepe Dic 2025, Puerto Vallarta

**CTA final**: "¡EXPLORA, SUEÑA, DESCUBRE! — Contáctanos y haz realidad tus viajes soñados."

### 3.2 Tienda (/shop)

**36 productos** en 2 páginas. Sidebar con filtros:

**Etiquetas disponibles**:
- TOUR INTERNACIONAL
- TOUR NACIONAL
- EUROPA
- PERU 2025
- ARGENTINA Y BRASIL 2025
- TURQUIA Y DUBAI 2025
- EUROPA Y LONDRES 2025
- TURQUIA WINTER 2026

**Catálogo completo con precios (MXN)**:

| # | Producto | Precio | Tipo |
|---|---|---|---|
| 1 | Perú Diciembre 2025 | $37,500 | Internacional |
| 2 | Argentina y Brasil Agosto 2025 | $69,500 | Internacional |
| 3 | Turquía y Dubái 2025 | $69,500 | Internacional |
| 4 | Europa Septiembre 2025 | $79,800 | Internacional |
| 5 | Europa y Londres 2025 | $65,000 | Internacional |
| 6 | Vuelta al Mundo 2025 | $120,000 | Internacional |
| 7 | Medio Oriente 2025 | $79,200 | Internacional |
| 8 | Argentina y Brasil Noviembre 2025 | $69,500 | Internacional |
| 9 | Turquía Winter Enero 2026 | $44,900 | Internacional |
| 10 | Las Vegas Octubre 2025 | $17,500 | Internacional |
| 11 | Europa Inolvidable | $52,500 | Internacional |
| 12 | Nueva York Diciembre 2025 | $25,000 | Internacional |
| 13 | Japón, China & Corea 2026 | $88,900 | Internacional |
| 14 | Colombia Octubre 2025 | $27,600 | Internacional |
| 15 | Colombia Noviembre 2025 | $27,600 | Internacional |
| 16 | Turquía Winter Noviembre 2025 | $44,900 | Internacional |
| 17 | Cancún Grupal 2025 | $12,900 | Nacional |
| 18 | Puerto Vallarta Primera Fecha | $7,999 | Nacional |
| 19 | Puerto Vallarta Segunda Fecha | $8,749 | Nacional |
| 20 | Chiapas Octubre 2025 | $9,900 | Nacional |
| 21 | Chiapas Diciembre 2025 | $9,900 | Nacional |
| 22 | Guayabitos Express | $899 | Nacional |
| 23 | México Puebla y Tlaxcala | $3,799 | Nacional |
| 24 | Tailandia | $49,900 | Internacional |
| 25 | Asia 2026 | $88,500 | Internacional |
| 26 | Perú Abril 2026 | $37,500 | Internacional |
| 27 | México Tradicional | $2,860 | Nacional |
| 28 | Chepe Diciembre 2025 | $17,500 | Nacional |
| 29 | Chepe Enero 2026 | $17,500 | Nacional |
| 30 | Querétaro Sorprendente | $2,200 | Nacional |
| 31 | Mundial 2026 | $7,500 | Especial |
| 32 | Tour Shopping USA | $13,900 | Internacional |
| 33 | Europa Sin Tours | $65,000 | Internacional |
| 34 | Vuelos GDL-Madrid | $19,000 | Vuelos |
| 35 | Guayabitos Enero 2026 | $6,999 | Nacional |
| 36 | Riviera Maya Sep 2026 | ~$14,490 | Nacional (homepage) |

**Rango de precios**: $899 (Guayabitos Express) → $120,000 (Vuelta al Mundo)
**Promedio estimado**: ~$38,000 MXN

### 3.3 Servicios (/our-services)

3 servicios principales:
1. **VUELOS** — "Reserva con nosotros tus vuelos nacionales e internacionales a los mejores precios de la zona"
2. **TRASLADOS** — "Permítenos encargarnos de tus traslados hotel-aeropuerto para que tú solo te preocupes de disfrutar tu viaje"
3. **HOTELES** — "Realiza tus reservaciones para tus vacaciones en nuestra amplia gama de hoteles nacionales e internacionales"

**Nota**: Página tiene errores de edición — texto "Our values" en inglés sin editar, "aHOTELES" como typo.

### 3.4 Sobre Nosotros (/about-us)

**Sección 1 — Historia**:
> "Desde sus comienzos como un viajero solitario, con el deseo de compartir sus experiencias de explorar el mundo, han pasado 8 años de historias y aventuras. Lo que comenzó como un sueño personal se ha transformado en una empresa que ahora lleva a numerosas personas a emocionantes viajes organizados."

**Sección 2 — Propuesta de valor**:
> "Viajes Inolvidables: Creando Recuerdos para Toda la Vida"
> "En nuestra agencia de viajes, nos dedicamos a diseñar experiencias que van más allá de simples destinos turísticos."

**Sección 3 — CTA**:
> "TENEMOS EL VIAJE PERFECTO PARA TI. VEN Y CAMINA CON NOSOTROS."

**Bio CEO**:
- **NOEL SAHAGÚN, CEO** — "Noel es el fundador y director, además también impulsa a la empresa. Le encanta participar activamente en los viajes y seguido lo encontrarás acompañándote como guía en los tours grupales."

### 3.5 Agentes (/agentes)

**3 Sucursales**:
1. **AroundaPlanet Jalisco** (sede principal)
2. **AroundaPlanet Zacatecas** (Facebook: profile.php?id=100063455292198)
3. **AroundaPlanet CDMX** (Facebook: AroundaPlanetCDMX)

**Mejores agentes de junio 2025**: Isaac Martínez, Gustav Carranza, Ricardo Vázquez, Katia Romero

**Lista completa de agentes oficiales** (~70+ agentes):
Agustín Villaruel, Aida Macías, Alan Santos, Alejandra Márquez, Angelica De Los Santos, Arath Martínez, Jocelyn Patiño, Karen Hernández, Karina Zenil, Josué Vela, Juan Padilla, Katia Romero, Lorena Gutiérrez, Mariana Padilla, Karen Robledo, Karina Herrera, Karla Córdova, Kassandra Vargas, Kenia López, Liliana Cervantes, Luis Sánchez, Nayeli Torres, Omar Sánchez, Patricia García, Laura Grajeda, María Sánchez, Mario Sahagún, Miriam Hernández, **Noel Sahagún**, Paloma Godínez, Patricia Salcedo, Ricardo Vázquez, Nahum Santillán, Rubisela Mata, Omar Mariscal, Patricia Estrada, Regina Rivas, Rigoberto López, Samara Medina, Sandra Martínez, Saraí Ramírez, Selene González, Sergio Torres, Edith Orozco, Elizabeth Aguilar, Elvira Rojas, Emmanuel Ayala, Christian García, Christian Pérez, Yasael Salazar, Zaira Uribe, Arlenn Cárdenas, Azucena Olivares, Azucena Valdivia, Bricio Jaimes, Briseida Magallón, Daniela Rubio, Dayra Díaz, Edgar Méndez, Elizabeth Estrada, Erenia Jaramillo, Estephanie Hernández, Evelyn Castillo, Gustavo Carranza, Héctor Ambrosio, Isabel Sánchez, Isaías Godínez, Israel Ruiz, Itzel Preciado, Itzu Luna, Cristo González, Claudia Pérez, Cindy Cachua, Jesús Sánchez, Arturo Román, Mariela Sanabria, Fabian Plancarte, Kenia Denisse, Miguel Ángel, Carlos Gutiérrez, Christian Leiferman, Alicia Avalos, Estela Fabiola, Zayde Carmona, Jorge Gabriel, Ivonne Melanie, Luis Fernando, Perla Jazmín, Verónica Jaqueline, Víctor Aceves, Montes Fabiola, Isaac Martínez, Nadia Vázquez

Cada agente tiene perfil individual en: `/partners/{nombre-completo-slug}-{id}`

### 3.6 Help (/helpdesk/atencion-al-cliente-1)

Formulario de tickets con campos:
- Nombre (requerido)
- Email (requerido)
- Asunto (requerido)
- Descripción
- Archivo adjunto
- Botón: "Enviar ticket"

### 3.7 Contáctanos (/contactus)

Formulario de contacto con campos:
- Nombre (requerido)
- Teléfono
- Email (requerido)
- Asunto (requerido)
- Pregunta (requerida)
- Botón: "Enviar"

Datos de contacto visibles:
- AROUNDAPLANET
- Álvaro Obregón 182 C, Ocotlán, Jalisco, México
- Tel: 3929226479
- Email: aroundaplanet123@gmail.com

### 3.8 Política de Privacidad (/privacy)
- No auditada en esta sesión (enlace en footer)

---

## 4. Elementos Globales (presentes en TODAS las páginas)

### Header
- Logo AroundaPlanet (esquina central/superior)
- Teléfono: 392-922-6479 (enlace tel:)
- Botón "Contáctenos" (esquina superior derecha, verde/turquesa)
- Menú: Inicio, Tienda, Eventos, Servicios, Empresa (dropdown), Sobre nosotros, Help, Contáctanos (dropdown)

### Footer
- Redes sociales (Facebook, TikTok x2, YouTube, Pinterest)
- "Contáctenos en cualquier momento"
- Email: aroundaplanet123@gmail.com
- Video YouTube embebido (Aniversario 8)
- Teléfono: +52 392-922-6479
- Links: Inicio, Productos, Política de privacidad, Ayuda
- "Con la tecnología de Odoo - El #1 Comercio electrónico de código abierto"

### Popup (newsletter)
- Modal aparece después de 5 segundos en homepage
- Formulario de suscripción a newsletter

---

## 5. Paleta de Colores y Diseño Actual

| Elemento | Color |
|---|---|
| **Header/Footer bg** | Teal/turquesa oscuro (~#008B8B o similar) |
| **Botón CTA principal** | Turquesa/teal |
| **Texto body** | Gris oscuro |
| **Background** | Blanco |
| **Links** | Turquesa |
| **Cards/badges** | Turquesa sobre blanco |

**Tipografía**: Fonts default de Odoo (no personalizados)
**Estilo general**: Template estándar de Odoo Website, personalización mínima

---

## 6. Inventario de Assets Descargados

### Logo
| Archivo | Tamaño | Ruta |
|---|---|---|
| logo-aroundaplanet.webp | 15K | assets/logos/ |

### Imágenes Homepage (~39 archivos, 6.3 MB)
| Categoría | Archivos | Rango |
|---|---|---|
| Carousel (10 slides) | carousel-01 a 10.webp | 140K-505K |
| Hero/Promo | hero-group-photo-01/02, promo-vertical-01, promo-square-01 | 109K-136K |
| WhatsApp promos | whatsapp-promo-01, whatsapp-trip-01 a 04 | 87K-179K |
| Mundial/Riviera | mundial-2026, riviera-maya | ~130K c/u |
| Flyers Fanny | flyer-fanny-01/02 | ~150K c/u |
| Destinos internacionales | dest-intl-01 a 10 | 98K-221K |
| Grandes Sorpresas | sorpresas-chiapas/chepe/vallarta | 45K-101K |
| Backgrounds | bg-group-original, bg-europa, design-sin-titulo | 15K-377K |

### Imágenes Sobre Nosotros (~5 archivos, 683K)
| Archivo | Tamaño | Descripción |
|---|---|---|
| about-avioneta.svg | 341K | Foto grupo con avioneta |
| about-chiapas.svg | 73K | Cascada Chiapas |
| noel-sahagun-ceo.webp | 6.6K | Foto Noel CEO |
| about-parallax-bg.webp | 168K | Background parallax |
| about-group-photo.webp | 95K | Foto grupal original |

### Screenshots
| Archivo | Página |
|---|---|
| homepage-full.png | Homepage completa |
| shop-page1.png | Tienda página 1 |
| about-us.png | Sobre nosotros |
| agentes.png | Página de agentes |

**Total descargado**: ~7 MB en 45+ archivos

---

## 7. Hallazgos y Recomendaciones para la Nueva Plataforma

### Páginas Públicas Necesarias (mínimo)
1. **Homepage** — Carousel, destinos destacados, CTAs, mundial 2026
2. **Catálogo de viajes** — 36+ productos con filtros (tipo, destino, precio, fecha)
3. **Detalle de viaje** — Itinerario, precios, fotos, reserva (cada producto tiene página individual en Odoo)
4. **Sobre nosotros** — Historia, equipo, bio Noel
5. **Servicios** — Vuelos, traslados, hoteles
6. **Agentes** — Directorio con ~70+ agentes, perfiles individuales, ranking mensual
7. **Contacto** — Formulario + datos
8. **Help/Soporte** — Sistema de tickets
9. **Blog** — 3 categorías: Viaje, Noticias, Historias (actualmente vacío)
10. **Política de privacidad**

### Problemas del Sitio Actual
- Servicios con texto sin editar en inglés ("Our values")
- Blogs creados pero sin contenido (3 blogs vacíos)
- Eventos instalado pero sin uso
- Agentes con fotos genéricas/avatares (muchos sin foto real)
- Inconsistencia en nombres del menú (Help en inglés)
- Links incorrectos en homepage: cards de destinos apuntan a productos equivocados
  - Card "Colombia" → link a Argentina y Brasil
  - Card "Chiapas" → link a Colombia
  - Card "Ruta Maya" → link a Las Vegas
  - Card "Perú" → link a Colombia
  - Card "Cuba" → link a Nueva York
- Popup newsletter puede ser intrusivo

### Datos para Migrar
- **36 productos** con slugs existentes (importante para SEO)
- **~70+ perfiles de agentes** con IDs en Odoo
- **Contenido "Sobre nosotros"** (texto + fotos)
- **Logo e imágenes** (ya descargadas)
- **Datos de contacto** (teléfono, email, dirección)
- **Redes sociales** (URLs)

### Oportunidades en Nueva Plataforma
- Corregir TODOS los links rotos de la homepage
- Agregar contenido real al blog (histórias de viajes, tips)
- Crear sistema de eventos funcional
- Directorio de agentes con búsqueda, filtros por zona, rating
- Galería de fotos por destino (actualmente todo en carousel genérico)
- Integración WhatsApp directa (es el canal principal de ventas)
- Plan de pagos visible y calculable por viaje
- Testimoniales/reviews de viajeros

---

## 8. Estructura de Archivos Descargados

```
execution/web-audit/
├── web-audit-aroundaplanet.md    ← ESTE DOCUMENTO
├── screenshots/
│   ├── homepage-full.png
│   ├── shop-page1.png
│   ├── about-us.png
│   ├── agentes.png
│   └── homepage-popup-snapshot.md
└── assets/
    ├── logos/
    │   └── logo-aroundaplanet.webp
    └── images/
        ├── carousel-01 a 10.webp      (10 slides)
        ├── hero-group-photo-01/02.webp
        ├── promo-vertical-01.webp
        ├── promo-square-01.webp
        ├── whatsapp-promo-01.webp
        ├── whatsapp-trip-01 a 04.webp
        ├── mundial-2026.webp
        ├── riviera-maya.webp
        ├── flyer-fanny-01/02.webp
        ├── dest-intl-01 a 10.webp
        ├── sorpresas-chiapas/chepe/vallarta.webp
        ├── bg-group-original.webp
        ├── bg-europa.webp
        ├── design-sin-titulo.webp
        ├── about-avioneta.svg
        ├── about-chiapas.svg
        ├── about-group-photo.webp
        ├── about-parallax-bg.webp
        └── noel-sahagun-ceo.webp
```
