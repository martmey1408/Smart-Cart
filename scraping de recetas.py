import asyncio
from playwright.async_api import async_playwright

categorias = {
    'Pastas': ['arroces', 'pastas'],
    'Carnes': ['carnes', 'cerdo', 'pollo', 'pescados-y-mariscos'],
    'Veganas': ['veganos'],
    'Vegetarianas': ['vegetarianas'],
    'Dulces': ['tortas-y-budines', 'galletitas', 'tartas-dulces', 'postres', 'helados', 'otros-dulces'],
    'Saladas': ['pizzas-tartas-empanadas', 'guisos', 'entrantes', 'sopas', 'como-hacer-pan-casero', 'ensaladas']
}

# Función asíncrona para navegar por recetas
async def recetas():
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
                            direccion = await link.get_attribute('href')  # Esperar el resultado de get_attribute
                            nombre = direccion.split('/')[-2].replace("-", " ")  # Extraer el nombre de la receta
                            print(f"Nombre de la receta: {nombre}")
                            print(f"Enlace a la receta: {direccion}")
                            
                            imagen_element = await receta.query_selector('img')  # Obtener el elemento img
                            if imagen_element:
                                imagen = await imagen_element.get_attribute('src')  # Esperar el resultado de get_attribute
                                print(f"Imagen de la receta: {imagen}")
                            
                            # Llamar a la función para extraer ingredientes de la receta
                            await ingredientesReceta(direccion)

                except Exception as e:
                    print(f"Error al navegar a {pagina}: {e}")

        await browser.close()

# Función asíncrona para extraer los ingredientes de una receta
async def ingredientesReceta(direccion):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        try:
            # Navegar a la página de la receta
            await page.goto(direccion, timeout=60000, wait_until='domcontentloaded')

            # Seleccionar el encabezado <h3> que contiene "Ingredientes"
            h3_ingredientes = await page.query_selector('h3:text("Ingredientes")')
            
            if h3_ingredientes:
                # Evaluar el DOM para encontrar la lista de ingredientes <ul> después del <h3>
                ingredientes = await page.evaluate('''h3 => {
                    let nextElem = h3.nextElementSibling;
                    let ingredientes = [];
                    
                    // Buscar hasta encontrar una lista de ingredientes <ul>
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

                # Mostrar los ingredientes encontrados
                if ingredientes:
                    print(f"Ingredientes de la receta en {direccion}:")
                    for ingrediente in ingredientes:
                        print(f"- {ingrediente}")
                else:
                    print("No se encontraron ingredientes después del encabezado.")
            else:
                print("No se encontró el encabezado de ingredientes.")
        except Exception as e:
            print(f"Error al navegar a {direccion}: {e}")

        await browser.close()

# Ejecutar las funciones de forma asíncrona
asyncio.run(recetas())
