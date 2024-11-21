from playwright.sync_api import sync_playwright

def main(link):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)  # Cambia a True para modo headless
        page = browser.new_page()

        # Navega a la URL
        page.goto(link)
        
        # Espera a que el contenido esté disponible
        page.wait_for_load_state('networkidle')

        # Selecciona el enlace de la categoría correctamente (con puntos para clases)
        categoria_link = page.query_selector("a.vtex-breadcrumb-1-x-link.vtex-breadcrumb-1-x-link--3.dib.pv1.link.ph2.c-muted-2.hover-c-link")
        
        # Verifica si el elemento existe antes de intentar extraer el texto
        if categoria_link:
            print(categoria_link.inner_text().strip())
        else:
            print("No se encontró el enlace de la categoría.")
        
        # Cierra el navegador
        browser.close()

if __name__ == "__main__":
    main("https://diaonline.supermercadosdia.com.ar/zanahoria-x-1-kg-90122/p")


