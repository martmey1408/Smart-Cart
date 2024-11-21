import asyncio
from playwright.async_api import async_playwright
import psycopg2
from psycopg2 import sql

# Definición de categorías
categorias = {
    'Pastas': ['arroces', 'pastas'],
    'Carnes': ['carnes', 'cerdo', 'pollo', 'pescados-mariscos'],
    'Veganas': ['veganos'],
    'Vegetarianas': ['vegetarianas'],
    'Dulces': ['tortas-budines', 'galletitas', 'tartas-dulces', 'postres', 'recetas-de-helados', 'otros-dulces'],
    'Saladas': ['tartas-pizzas-empanadas', 'guisos', 'entrantes', 'sopas', 'como-hacer-pan-casero', 'ensaladas']
}
#como-hacer-pan-casero fallo
#Correr devuelta tartas-pizzas-empanadas
#Se rompen la mayoria de las recetas de helados (VER POR QUE)---> Escribirlo como recetas-de-helados
# Conectar a la base de datos
def conectar_db():
    try:
        connection = psycopg2.connect(
            user="postgres",
            password="marti123",
            host="localhost",
            port="5432",
            database="SmartCart"
        )
        return connection
    except (Exception, psycopg2.Error) as error:
        print("Error al conectarse a la base de datos", error)
        return None

# Función asíncrona para navegar por recetas
async def recetas(connection):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        for categoria, subcategorias in categorias.items():
            print(f"Categoría: {categoria}")  
            for subcategoria in subcategorias:
                if categoria == 'Dulces':
                    pagina = "https://www.paulinacocina.net/recetas/dulces-y-postres/" + subcategoria
                else:
                    pagina = "https://www.paulinacocina.net/recetas/" + subcategoria

                print(f"Navegando a: {pagina}")

                try:
                    await page.goto(pagina, timeout=60000, wait_until='domcontentloaded')
                    
                    # Extraer todas las recetas de la página
                    recetas = await page.query_selector_all('article.post')

                    for receta in recetas:
                        # Extraer el enlace a la receta
                        link = await receta.query_selector('a')
                        if link:
                            direccion = await link.get_attribute('href')
                            nombre = direccion.split('/')[-2].replace("-", " ")
                            print(f"Nombre de la receta: {nombre}")
                            print(f"Enlace a la receta: {direccion}")
                            
                            imagen_element = await receta.query_selector('img')
                            imagen = ""
                            if imagen_element:
                                imagen = await imagen_element.get_attribute('src')
                                print(f"Imagen de la receta: {imagen}")

                            # Llamar a la función para extraer ingredientes de la receta
                            ingredientes = await ingredientesReceta(direccion)

                            # Guardar la receta y los ingredientes en la base de datos
                            guardar_receta(connection, nombre, categoria, imagen, ingredientes)

                except Exception as e:
                    print(f"Error al navegar a {pagina}: {e}")

        await browser.close()

# Función asíncrona para extraer los ingredientes de una receta
async def ingredientesReceta(direccion):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        try:
            await page.goto(direccion, timeout=60000, wait_until='domcontentloaded')

            h3_ingredientes = await page.query_selector('h3:text("Ingredientes para una porción")')
            
            if h3_ingredientes:
                ingredientes = await page.evaluate('''h3 => {
                    let nextElem = h3.nextElementSibling;
                    let ingredientes = [];
                    
                    while (nextElem) {
                        if (nextElem.tagName === 'UL') {
                            let items = nextElem.querySelectorAll('li');
                            items.forEach(item => ingredientes.push(item.innerText.trim()));
                            break;
                        }
                        nextElem = nextElem.nextElementSibling;
                    }
                    return ingredientes;
                }''', h3_ingredientes)

                if ingredientes:
                    return ingredientes
                else:
                    print("No se encontraron ingredientes después del encabezado.")
            else:
                print("No se encontró el encabezado de ingredientes.")
        except Exception as e:
            print(f"Error al navegar a {direccion}: {e}")

        await browser.close()

# Guardar la receta y los ingredientes en la base de datos
def guardar_receta(connection, nombre, categoria, imagen, ingredientes):
    try:
        cursor = connection.cursor()

        # Insertar receta con la imagen
        insert_receta = sql.SQL("""
            INSERT INTO recetas (nombreReceta, categoria, imagen) 
            VALUES (%s, %s, %s) 
            RETURNING idReceta;
        """)
        cursor.execute(insert_receta, (nombre, categoria, imagen))
        receta_id = cursor.fetchone()[0]  # Obtener el ID de la receta insertada

        # Insertar ingredientes y crear relaciones
        insert_ingrediente = sql.SQL("""
            INSERT INTO ingredientes (nombreIngrediente) 
            VALUES (%s) 
            ON CONFLICT (nombreIngrediente) DO NOTHING 
            RETURNING idIngrediente;
        """)
        insert_relacion = sql.SQL("""
            INSERT INTO receta_ingrediente (idReceta, idIngrediente) 
            VALUES (%s, %s);
        """)

        for ingrediente in ingredientes:
            cursor.execute(insert_ingrediente, (ingrediente,))
            if cursor.rowcount > 0:  # Si se insertó un nuevo ingrediente
                id_ingrediente = cursor.fetchone()[0]
                cursor.execute(insert_relacion, (receta_id, id_ingrediente))
            else:  # Si el ingrediente ya existía
                cursor.execute("SELECT idIngrediente FROM ingredientes WHERE nombreIngrediente = %s;", (ingrediente,))
                id_ingrediente = cursor.fetchone()[0]
                cursor.execute(insert_relacion, (receta_id, id_ingrediente))

        connection.commit()  # Confirmar la transacción
        print(f"Receta '{nombre}' guardada en la base de datos con ID {receta_id}.")

    except Exception as e:
        print(f"Error al guardar la receta {nombre}: {e}")
    finally:
        cursor.close()

# Ejecutar las funciones de forma asíncrona
if __name__ == "__main__":
    connection = conectar_db()
    if connection:
        asyncio.run(recetas(connection))
        connection.close()  # Cerrar la conexión a la base de datos al final


