import sys
import json
from playwright.sync_api import sync_playwright

def buscar_producto_dia(nombre):
    productos_encontrados = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)  # Habilita modo headless para mayor velocidad
        page = browser.new_page()
        url = f'https://diaonline.supermercadosdia.com.ar/{nombre}?_q={nombre}&map=ft'

        try:
            print(f'Navegando a: {url}')
            page.goto(url, wait_until='domcontentloaded', timeout=10000)

            # Intentar cargar los productos usando el selector
            selector = '.vtex-product-summary-2-x-container'
            try:
                page.wait_for_selector(selector, timeout=5000)
            except Exception as e:
                print(f"Selector no encontrado: {selector}, error: {e}")
                return productos_encontrados

            # Realizar un scroll para cargar más productos de manera eficiente
            last_height = page.evaluate('document.body.scrollHeight')
            while True:
                page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
                page.wait_for_timeout(1500)
                new_height = page.evaluate('document.body.scrollHeight')
                if new_height == last_height:  # Detener scroll cuando no haya más productos para cargar
                    break
                last_height = new_height

            # Extraer productos de la página
            productos = page.query_selector_all(selector)
            print(f"Productos encontrados: {len(productos)}")

            for producto in productos:
                try:
                    nombre_elem = producto.query_selector('.vtex-product-summary-2-x-productBrand') or \
                                  producto.query_selector('.vtex-product-summary-2-x-productName')
                    precio_elem = producto.query_selector('.vtex-product-price-1-x-sellingPriceValue') or \
                                  producto.query_selector('.vtex-product-price-1-x-currencyInteger')
                    imagen_elem = producto.query_selector('img')
                    pagina_elem = producto.query_selector(
                        'a.vtex-product-summary-2-x-clearLink.vtex-product-summary-2-x-clearLink--shelf.h-100.flex.flex-column'
                    )

                    if nombre_elem and precio_elem and imagen_elem and pagina_elem:
                        nombre_texto = nombre_elem.inner_text().strip()
                        precio_texto = ''.join(filter(str.isdigit, precio_elem.inner_text().replace(',', '.')))
                        precio_numero = float(precio_texto) / 100 if precio_texto else 0
                        imagen_src = imagen_elem.get_attribute('src')
                        pagina_href = pagina_elem.get_attribute('href')
                        pagina_url = f'https://diaonline.supermercadosdia.com.ar{pagina_href}'

                        productos_encontrados.append({
                            'nombre': nombre_texto,
                            'precio': precio_numero,
                            'imagen': imagen_src,
                            'supermercado': 'Día',
                            'pagina': pagina_url,
                        })
                except Exception as e:
                    print(f"Error al procesar producto: {e}")

            print(f'Total de productos encontrados: {len(productos_encontrados)}')

        except Exception as e:
            print(f'Error durante la extracción: {e}')
        finally:
            browser.close()

    return productos_encontrados


if __name__ == "__main__":
    nombre = 'zanahoria'
    resultados = buscar_producto_dia(nombre)
    print(json.dumps(resultados, indent=2))
