const express = require('express');
const bodyParser = require('body-parser');
const pg = require('pg');
const cors = require('cors');
const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');
const { chromium } = require('playwright');
const stringSimilarity = require('string-similarity');
const app = express();
app.use(bodyParser.json());
app.use(cors());


const pool = new pg.Pool({
  host: 'localhost',
  database: 'SmartCart',
  port: 5432,
  user: 'postgres',
  password: 'marti123',
});

// Verificar la conexión a la base de datos
pool.connect((err, _client, done) => {
  if (err) {
    console.error('Error al conectar a la base de datos', err);
  } else {
    console.log('Conexión exitosa a la base de datos');
    done();
  }
});

// Configurar nodemailer
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: 'm.meyorin@usal.edu.ar',
    pass: 'shpmmf14082002',
  },
});


// Ruta para registrar usuarios
app.post('/register', (req, res) => {
  const { email, username, password } = req.body;
  console.log('Solicitud de registro recibida:', req.body);

  pool.query('SELECT * FROM usuarios WHERE mail = $1 OR nombre = $2', [email, username], (error, results) => {
    if (error) {
      console.error('Error al verificar usuario:', error);
      return res.status(500).json({ success: false, message: 'Error al verificar usuario.' });
    }

    if (results.rows.length > 0) {
      console.log('Usuario ya registrado:', results.rows);
      return res.status(400).json({ success: false, message: 'User already registered.' });
    } else {
      pool.query('INSERT INTO usuarios (nombre, mail, contraseña) VALUES ($1, $2, $3)', [username, email, password], (error, results) => {
        if (error) {
          console.error('Error al registrar usuario:', error);
          return res.status(500).json({ success: false, message: 'Error al registrar usuario.' });
        }
        console.log('Usuario registrado exitosamente');
        res.status(201).json({ success: true, message: 'User registered successfully.' });
      });
    }
  });
});

// Ruta para iniciar sesión
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  console.log('Intento de inicio de sesión con nombre de usuario/correo:', username, 'y contraseña:', password);

  pool.query('SELECT nombre, mail FROM usuarios WHERE (nombre = $1 OR mail = $1) AND contraseña = $2', [username, password], (err, results) => {
    if (err) {
      console.error('Error de la base de datos:', err);
      res.status(500).json({ userExists: false, error: 'Database error' });
    } else {
      if (results.rows.length > 0) {
        res.json({ userExists: true, username: results.rows[0].nombre, mail: results.rows[0].mail });
      } else {
        res.json({ userExists: false });
      }
    }
  });
});

// Ruta para actualizar la contraseña
app.post('/update-password', (req, res) => {
  const { username, newPassword } = req.body;
  console.log('Solicitud de actualización de contraseña para:', username);

  // Validar la nueva contraseña
  const specialCharacters = /[!@#$%^&*(),.?":{}|<>]/;
  if (newPassword.length < 9) {
    return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 9 caracteres.' });
  }
  if (!specialCharacters.test(newPassword)) {
    return res.status(400).json({ success: false, message: 'La nueva contraseña debe contener al menos un carácter especial.' });
  }

  pool.query('SELECT contraseña FROM usuarios WHERE nombre = $1', [username], (error, results) => {
    if (error) {
      console.error('Error al verificar la contraseña actual:', error);
      return res.status(500).json({ success: false, message: 'Error al verificar la contraseña actual.' });
    }

    if (results.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    const currentPassword = results.rows[0].contraseña;
    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: 'La nueva contraseña no puede ser igual a la contraseña actual.' });
    }

    pool.query('UPDATE usuarios SET contraseña = $1 WHERE nombre = $2', [newPassword, username], (updateError, updateResults) => {
      if (updateError) {
        console.error('Error al actualizar la contraseña:', updateError);
        return res.status(500).json({ success: false, message: 'Error al actualizar la contraseña.' });
      }

      if (updateResults.rowCount > 0) {
        console.log('Contraseña actualizada exitosamente para:', username);
        res.json({ success: true, message: 'Contraseña actualizada exitosamente.' });
      } else {
        console.log('Usuario no encontrado:', username);
        res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
      }
    });
  });
});

// Ruta para enviar correo de recuperación de contraseña
app.post('/send-email', (req, res) => {
  const { email } = req.body;
  console.log('Solicitud de envío de correo de recuperación para:', email);

  const mailOptions = {
    from: 'm.meyorin@usal.edu.ar',
    to: email,
    subject: 'Recuperación de contraseña',
    text: 'Haga clic en el siguiente enlace para restablecer su contraseña: http://localhost:8080/nueva-contraseña',
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error al enviar el correo:', error);
      return res.status(500).json({ success: false, message: 'Error al enviar el correo.' });
    }
    console.log('Correo enviado:', info.response);
    res.json({ success: true, message: 'Correo enviado exitosamente.' });
  });
});

// Ruta para obtener la información del usuario
app.post('/get-user-info', (req, res) => {
  const { username } = req.body;
  console.log('Solicitud de información del usuario para:', username);

  pool.query('SELECT nombre, mail FROM usuarios WHERE nombre = $1', [username], (error, results) => {
    if (error) {
      console.error('Error al obtener información del usuario:', error);
      return res.status(500).json({ success: false, message: 'Error al obtener información del usuario.' });
    }

    if (results.rows.length > 0) {
      res.json({ success: true, userInfo: results.rows[0] });
    } else {
      res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }
  });
});

// Ruta para verificar la contraseña
app.post('/check-password', (req, res) => {
  const { username, password } = req.body;
  console.log('Verificando contraseña para:', username);

  pool.query('SELECT contraseña FROM usuarios WHERE nombre = $1', [username], (err, results) => {
    if (err) {
      console.error('Error al verificar contraseña:', err);
      return res.status(500).json({ correct: false });
    }

    if (results.rows.length > 0 && results.rows[0].contraseña === password) {
      res.json({ correct: true });
    } else {
      res.json({ correct: false });
    }
  });
});

// Ruta para verificar si el nuevo nombre de usuario ya existe
app.post('/check-username', (req, res) => {
  const { username } = req.body;
  console.log('Verificando existencia del nuevo nombre de usuario:', username);

  pool.query('SELECT 1 FROM usuarios WHERE nombre = $1', [username], (err, results) => {
    if (err) {
      console.error('Error al verificar nombre de usuario:', err);
      return res.status(500).json({ exists: false });
    }

    res.json({ exists: results.rows.length > 0 });
  });
});

// Ruta para actualizar el nombre de usuario
app.post('/update-username', (req, res) => {
  const { oldUsername, newUsername } = req.body;
  console.log('Actualizando nombre de usuario de:', oldUsername, 'a:', newUsername);

  pool.query('UPDATE usuarios SET nombre = $1 WHERE nombre = $2', [newUsername, oldUsername], (err, results) => {
    if (err) {
      console.error('Error al actualizar nombre de usuario:', err);
      return res.status(500).json({ success: false });
    }

    if (results.rowCount > 0) {
      console.log('Nombre de usuario actualizado exitosamente');
      res.json({ success: true });
    } else {
      console.log('Nombre de usuario no encontrado');
      res.status(404).json({ success: false });
    }
  });
});

// Ruta para eliminar la cuenta de usuario
app.post('/delete-account', (req, res) => {
  const { username, password } = req.body;
  console.log('Solicitud de eliminación de cuenta para:', username);

  // Verificar que el usuario y la contraseña sean correctos
  pool.query('SELECT contraseña FROM usuarios WHERE nombre = $1', [username], (err, results) => {
    if (err) {
      console.error('Error al verificar contraseña:', err);
      return res.status(500).json({ success: false, message: 'Error al verificar la contraseña.' });
    }

    if (results.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    const currentPassword = results.rows[0].contraseña;
    if (currentPassword !== password) {
      return res.status(400).json({ success: false, message: 'Contraseña incorrecta.' });
    }

    // Eliminar el usuario de la base de datos
    pool.query('DELETE FROM usuarios WHERE nombre = $1', [username], (deleteErr, deleteResults) => {
      if (deleteErr) {
        console.error('Error al eliminar la cuenta:', deleteErr);
        return res.status(500).json({ success: false, message: 'Error al eliminar la cuenta.' });
      }

      console.log('Cuenta eliminada exitosamente para:', username);
      res.json({ success: true, message: 'Cuenta eliminada exitosamente.' });
    });
  });
});
//Ruta para buscar en dia
app.get('/buscar_productoDia', async (req, res) => {
  const nombre = req.query.nombre;
  
  if (!nombre) {
      return res.status(400).json({ success: false, message: 'Se requiere un nombre de producto.' });
  }

  try {
      const productos = await buscarProductoDia(nombre);
      return res.json(productos);
  } catch (error) {
      console.error('Error al buscar el producto:', error);
      return res.status(500).json({ success: false, message: 'Error al buscar el producto.' });
  }
});
async function buscarProductoDia(nombre) {
  const productosEncontrados = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = `https://diaonline.supermercadosdia.com.ar/${encodeURIComponent(nombre)}?_q=${encodeURIComponent(nombre)}&map=ft`;

  try {
    console.log(`Navegando a: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle' });

    // Intentar diferentes selectores
    const selectors = [
      '.vtex-search-result-3-x-galleryItem',
      '.vtex-product-summary-2-x-container',
      '.vtex-product-summary-2-x-element'
    ];

    let productos = [];
    for (const selector of selectors) {
      try {
        console.log(`Intentando con el selector: ${selector}`);
        await page.waitForSelector(selector, { timeout: 10000 });
        productos = await page.$$(selector);
        if (productos.length > 0) {
          console.log(`Selector exitoso: ${selector}`);
          break;
        }
      } catch (error) {
        console.log(`Timeout con el selector: ${selector}`);
      }
    }

    if (productos.length === 0) {
      console.log("No se encontraron productos con ningún selector.");
      return productosEncontrados;
    }

    // Scroll para cargar más productos
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2 segundos
    }

    for (const producto of productos) {
      const nombreElem = await producto.$('.vtex-product-summary-2-x-productBrand') ||
                         await producto.$('.vtex-product-summary-2-x-productName');
      const precioElem = await producto.$('.vtex-product-price-1-x-sellingPriceValue') ||
                         await producto.$('.vtex-product-price-1-x-currencyInteger');
      const imagenElem = await producto.$('img');
      const paginaElem = await producto.$('a.vtex-product-summary-2-x-clearLink.vtex-product-summary-2-x-clearLink--shelf.h-100.flex.flex-column');

      if (nombreElem && precioElem && imagenElem && paginaElem) {
        const nombreTexto = await nombreElem.innerText();
        const precioTexto = await precioElem.innerText();
        const imagenSrc = await imagenElem.getAttribute('src');
        const pagina = 'https://diaonline.supermercadosdia.com.ar/' + await paginaElem.getAttribute('href');

        // Limpiar el precio y convertir a número
        const precioNumero = parseFloat(precioTexto.replace(/[^0-9]/g, '').replace(',', '.')) / 100 || 0;

        productosEncontrados.push({
          nombre: nombreTexto.trim(),
          precio: precioNumero,
          imagen: imagenSrc,
          supermercado: 'Día',
          pagina: pagina
        });
      }
    }

    console.log(`Número de productos encontrados: ${productosEncontrados.length}`);

  } catch (error) {
    console.error(`Error al extraer los productos: ${error}`);
  } finally {
    await browser.close();
  }

  return productosEncontrados;
}


// Ruta para buscar productos en Disco
app.get('/buscar_productoDisco', async (req, res) => {
  const nombre = req.query.nombre;

  if (!nombre) {
    return res.status(400).json({ success: false, message: 'El nombre del producto es requerido.' });
  }

  try {
    const productos = await buscarProductoDisco(nombre);
    res.json(productos);
  } catch (error) {
    console.error('Error al buscar productos:', error);
    res.status(500).json({ success: false, message: 'Error al buscar productos.' });
  }
});

// Función para buscar productos en Disco
async function buscarProductoDisco(nombre) {
  const productosEncontrados = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = `https://www.disco.com.ar/${encodeURIComponent(nombre)}?_q=${encodeURIComponent(nombre)}&map=ft`;

  try {
    console.log('Navegando a:', url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('Página cargada, esperando productos...');

    // Esperar explícitamente que aparezcan los productos en pantalla, incluso si tardan más de lo normal
    await page.waitForSelector('.vtex-search-result-3-x-galleryItem', { timeout: 60000 });
    console.log('Selector de productos encontrado');

    // Hacer scroll hasta el final de la página para asegurarse de que todos los productos se carguen
    let lastHeight = await page.evaluate(() => document.body.scrollHeight);
    while (true) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(3000);  // Aumentamos el tiempo de espera para asegurarnos que el contenido cargue
      let newHeight = await page.evaluate(() => document.body.scrollHeight);
      if (newHeight === lastHeight) break;
      lastHeight = newHeight;
    }

    // Verificar si el contenido se encuentra dentro de un iframe (en caso de que haya iframes)
    const frames = await page.frames();
    console.log(`Se encontraron ${frames.length} marcos en la página`);

    // Extraer los productos
    const productos = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.vtex-search-result-3-x-galleryItem'));
      return items.map(item => {
        const nombreElem = item.querySelector('.vtex-product-summary-2-x-productBrand');
        const precioElem = item.querySelector('#priceContainer');
        const imagenElem = item.querySelector('img.vtex-product-summary-2-x-image');
        const paginaElem = item.querySelector('a.vtex-product-summary-2-x-clearLink');

        if (nombreElem && precioElem && paginaElem) {
          const nombre = nombreElem.innerText.trim();
          let precioTexto = precioElem.innerText.trim();
          const imagen = imagenElem ? imagenElem.src : 'No se encontró imagen';
          const pagina = paginaElem.href;

          // Limpiar el precio y convertir a número
          precioTexto = precioTexto.replace(/[^0-9.,]/g, ''); 
          const [enteros, decimales] = precioTexto.split(',');
          const precioLimpio = (enteros.replace('.', '') + (decimales ? '.' + decimales : '')).replace(',', '.');
          const precioNumero = parseFloat(precioLimpio);

          return {
            nombre,
            precio: isNaN(precioNumero) ? 0 : precioNumero,
            imagen,
            pagina,
            super: 'Disco'
          };
        }
        return null;
      }).filter(item => item !== null);
    });

    console.log(`Se encontraron ${productos.length} productos`);
    productosEncontrados.push(...productos);

  } catch (error) {
    console.error('Error al extraer los productos:', error);
  } finally {
    await browser.close();
  }

  return productosEncontrados;
}




// Ruta para buscar productos en Coto
app.get('/buscar_productoCoto', async (req, res) => {
  const nombre = req.query.nombre;
  try {
    const productos = await buscarProductoCoto(nombre);
    res.json(productos);
  } catch (error) {
    console.error('Error al buscar productos:', error);
    res.status(500).json({ success: false, message: 'Error al buscar productos.' });
  }
});

async function buscarProductoCoto(nombre) {
  const productosEncontrados = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = `https://www.cotodigital3.com.ar/sitios/cdigi/browse?_dyncharset=utf-8&Dy=1&Ntt=${encodeURIComponent(nombre)}&Nty=1&Ntk=&siteScope=ok&_D%3AsiteScope=+&atg_store_searchInput=${encodeURIComponent(nombre)}&idSucursal=200&_D%3AidSucursal=+&search=Ir&_D%3Asearch=+&_DARGS=%2Fsitios%2Fcartridges%2FSearchBox%2FSearchBox.jsp`;

  try {
    console.log('Navegando a:', url);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    console.log('Página cargada');

    await page.waitForSelector('ul#products', { timeout: 30000 });
    console.log('Selector ul#products encontrado');

    const productos = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('ul#products li'));
      return items.map(item => {
        const nombreElem = item.querySelector('span.span_productName');
        const precioElem = item.querySelector('span.atg_store_newPrice');
        const imagenElem = item.querySelector('span.atg_store_productImage img');
        const paginaElem = item.querySelector("div.product_info_container a");

        if (nombreElem && precioElem) {
          const nombreTexto = nombreElem.innerText;
          let precioTexto = precioElem.innerText;
          const imagenSrc = imagenElem ? imagenElem.src : '';
          const paginaSrc = paginaElem ? paginaElem.href : '';

          // Limpiar el precio y convertir a número
          precioTexto = precioTexto.replace(/[^0-9.,]/g, '');
          const [entero, decimal] = precioTexto.split(',');
          const precioLimpio = (entero.replace('.', '') + (decimal ? '.' + decimal : '')).replace(',', '.');
          const precioNumero = parseFloat(precioLimpio);

          return {
            nombre: nombreTexto.trim(),
            precio: isNaN(precioNumero) ? 0 : precioNumero,
            imagen: imagenSrc,
            pagina: paginaSrc,
            super: 'Coto'
          };
        }
        return null;
      }).filter(item => item !== null);
    });

    console.log(`Se encontraron ${productos.length} productos`);
    productosEncontrados.push(...productos);

  } catch (error) {
    console.error('Error al extraer los productos:', error);
  } finally {
    await browser.close();
  }

  return productosEncontrados;
}
// Ruta para agregar una lista de compras
app.post('/add-to-shopping-list', async (req, res) => {
  const { items, totalPrice, username } = req.body;
  
  console.log('Items recibidos:', items);  // <-- Aquí puedes ver qué datos están llegando

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const listResult = await client.query(
        'INSERT INTO listas (nombre, mail_id, fechaLista) VALUES ($1, $2, NOW()) RETURNING id',
        [`Lista de ${username}`, username]
      );
      const listaId = listResult.rows[0].id;

      for (const item of items) {
        const { nombre, precio, cantidad, precioTotal, imagen, supermercado, pagina } = item;

        console.log('Procesando item:', { nombre, supermercado, pagina });  // <-- Verificar que el enlace no sea ''

        let categoria;
        try {
          categoria = await buscarCategoria(supermercado, pagina);
        } catch (error) {
          console.error('Error al buscar categoría:', error);
          categoria = 'Categoría desconocida';
        }

        let productResult = await client.query(
          'SELECT id FROM productos WHERE descripcion = $1',
          [nombre]
        );

        let productoId;
        if (productResult.rows.length === 0) {
          productResult = await client.query(
            'INSERT INTO productos (descripcion, precio, imagen, super, pagina, categoria) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [nombre, precio, imagen, supermercado, pagina, categoria]
          );
          productoId = productResult.rows[0].id;
        } else {
          productoId = productResult.rows[0].id;
          await client.query(
            'UPDATE productos SET precio = $1, imagen = $2, super = $3, pagina = $4, categoria = $5 WHERE id = $6',
            [precio, imagen, supermercado, pagina, categoria, productoId]
          );
        }

        await client.query(
          'INSERT INTO lista_productos (lista_id, producto_id, cantidad, preciototal) VALUES ($1, $2, $3, $4)',
          [listaId, productoId, cantidad, precioTotal]
        );
      }

      await client.query('COMMIT');
      res.json({ success: true, message: 'Lista de compras creada con éxito' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error en la transacción:', error);
      res.status(500).json({ success: false, message: 'Error al crear la lista de compras: ' + error.message });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al conectar con la base de datos:', error);
    res.status(500).json({ success: false, message: 'Error al conectar con la base de datos: ' + error.message });
  }
});

app.post('/get-shopping-list', async (req, res) => {
  const { mail } = req.body;
  console.log('Fetching shopping list for user:', mail);

  try {
    const client = await pool.connect();
    try {
      // First, get the most recent list for the user
      const listResult = await client.query(
        'SELECT id FROM listas WHERE mail_id = $1 ORDER BY fechaLista DESC',
        [mail]
      );

      if (listResult.rows.length === 0) {
        return res.json({ success: true, shoppingList: [] });
      }

      const listaId = listResult.rows[0].id;

      // Now, get all products in this list
      const productsResult = await client.query(
        `SELECT p.descripcion, p.precio, p.imagen, lp.cantidad, lp.preciototal
         FROM lista_productos lp
         JOIN productos p ON lp.producto_id = p.id
         WHERE lp.lista_id = $1`,
        [listaId]
      );

      const shoppingList = productsResult.rows.map(row => ({
        descripcion: row.descripcion,
        precio: parseFloat(row.precio),
        imagen: row.imagen,
        cantidad: parseInt(row.cantidad),
        precioTotal: parseFloat(row.preciototal)
      }));

      res.json({ success: true, shoppingList });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching shopping list:', error);
    res.status(500).json({ success: false, message: 'Error fetching shopping list.' });
  }
});
app.post('/get-shopping-history', async (req, res) => {
  const { mail, filterDate } = req.body;
  console.log('Fetching shopping history for user:', mail, 'with filter:', filterDate);

  try {
    const client = await pool.connect();
    try {
      let query = `
        SELECT l.id, l.fechaLista, 
               json_agg(json_build_object(
                 'descripcion', p.descripcion, 
                 'precio', p.precio, 
                 'imagen', p.imagen, 
                 'cantidad', lp.cantidad, 
                 'precioTotal', lp.preciototal
               )) as productos,
               SUM(lp.preciototal) as totalLista
        FROM listas l
        JOIN lista_productos lp ON l.id = lp.lista_id
        JOIN productos p ON lp.producto_id = p.id
        WHERE l.mail_id = $1
      `;

      const queryParams = [mail];

      if (filterDate) {
        if (filterDate.type === 'specific') {
          query += ' AND DATE(l.fechaLista) = $2';
          queryParams.push(filterDate.value);
        } else if (filterDate.type === 'month') {
          query += ' AND TO_CHAR(l.fechaLista, \'YYYY-MM\') = $2';
          queryParams.push(filterDate.value);
        } else if (filterDate.type === 'year') {
          query += ' AND EXTRACT(YEAR FROM l.fechaLista) = $2';
          queryParams.push(parseInt(filterDate.value, 10));
        }
      }

      query += ' GROUP BY l.id, l.fechaLista ORDER BY l.fechaLista DESC';

      const result = await client.query(query, queryParams);
      res.json({ success: true, shoppingHistory: result.rows });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching shopping history:', error);
    res.status(500).json({ success: false, message: 'Error fetching shopping history.' });
  }
});
// Ruta para agregar un producto a la tabla de productos prioritarios
app.post('/add-to-priority', async (req, res) => {
  const { usuarioEmail, descripcion, imagen, precio } = req.body;

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Primero, verificamos si el producto ya existe en la base de datos
      let query = `SELECT id FROM productos WHERE descripcion = $1`;
      let result = await client.query(query, [descripcion]);

      let productId;
      
      if (result.rows.length === 0) {
        // Si el producto no existe, lo agregamos
        query = `
          INSERT INTO productos (descripcion, imagen, precio)
          VALUES ($1, $2, $3)
          RETURNING id
        `;
        result = await client.query(query, [descripcion, imagen, precio]);
        productId = result.rows[0].id;
      } else {
        // Si el producto ya existe, usamos el ID existente
        productId = result.rows[0].id;
      }

      // Ahora agregamos el producto a la tabla de productos prioritarios
      query = `
        INSERT INTO productos_prioritarios (producto_id, usuario_email) 
        VALUES ($1, $2)
        ON CONFLICT (producto_id, usuario_email) DO NOTHING
      `;
      await client.query(query, [productId, usuarioEmail]);

      await client.query('COMMIT');

      res.status(200).json({ message: 'Producto agregado a productos prioritarios' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al agregar el producto prioritario:', error);
    res.status(500).json({ message: 'Error al agregar el producto prioritario' });
  }
});
app.post('/get-priority-products', async (req, res) => {
  const { usuarioEmail } = req.body;

  try {
    const client = await pool.connect();
    try {
      const query = `
        SELECT p.id, p.descripcion, p.imagen, p.precio
        FROM productos p
        JOIN productos_prioritarios pp ON p.id = pp.producto_id
        WHERE pp.usuario_email = $1
      `;
      const result = await client.query(query, [usuarioEmail]);
      res.json({ products: result.rows });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al obtener productos prioritarios:', error);
    res.status(500).json({ message: 'Error al obtener productos prioritarios' });
  }
});

// Nueva ruta para eliminar un producto prioritario
app.post('/remove-priority-product', async (req, res) => {
  const { productId, usuarioEmail } = req.body;

  try {
    const client = await pool.connect();
    try {
      const query = `
        DELETE FROM productos_prioritarios
        WHERE producto_id = $1 AND usuario_email = $2
      `;
      await client.query(query, [productId, usuarioEmail]);
      res.json({ message: 'Producto eliminado de la lista de prioritarios' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al eliminar el producto prioritario:', error);
    res.status(500).json({ message: 'Error al eliminar el producto prioritario' });
  }
});

// Ruta para activar una alerta de producto
app.post('/activate-product-alert', async (req, res) => {
  const { id_producto, usuario_mail } = req.body;
  
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verificar si ya existe una alerta para este producto y usuario
      const checkQuery = `
        SELECT * FROM productosAlerta 
        WHERE id_producto = $1 AND usuario_mail = $2
      `;
      const checkResult = await client.query(checkQuery, [id_producto, usuario_mail]);

      if (checkResult.rows.length > 0) {
        // Ya existe una alerta para este producto y usuario
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Ya existe una alerta para este producto' });
      }

      // Insertar la nueva alerta
      const insertQuery = `
        INSERT INTO productosAlerta (id_producto, usuario_mail)
        VALUES ($1, $2)
      `;
      await client.query(insertQuery, [id_producto, usuario_mail]);

      await client.query('COMMIT');
      res.status(200).json({ message: 'Alerta activada con éxito' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al activar la alerta del producto:', error);
    res.status(500).json({ message: 'Error al activar la alerta del producto' });
  }
});

//Ruta para obtener un producto por su id
app.post('/get-product-id', async (req, res) => {
  const { nombre, precio, imagen } = req.body;

  try {
    const client = await pool.connect();
    try {
      // Primero, intentamos encontrar el producto existente
      let query = `SELECT id FROM productos WHERE descripcion = $1`;
      let result = await client.query(query, [nombre]);

      if (result.rows.length === 0) {
        // Si el producto no existe, lo creamos
        query = `
          INSERT INTO productos (descripcion, precio, imagen)
          VALUES ($1, $2, $3)
          RETURNING id
        `;
        result = await client.query(query, [nombre, precio, imagen]);
      }

      res.json({ id: result.rows[0].id });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al obtener/crear el ID del producto:', error);
    res.status(500).json({ message: 'Error al obtener/crear el ID del producto' });
  }
});

// Ruta para obtener productos con alertas
app.post('/get-alert-products', async (req, res) => {
  const { usuarioEmail } = req.body;

  try {
    const client = await pool.connect();
    try {
      const query = `
        SELECT p.id, p.descripcion, p.imagen, p.precio
        FROM productosAlerta pA
        INNER JOIN productos p ON pA.id_producto = p.id
        WHERE pA.usuario_mail = $1
      `;
      const result = await client.query(query, [usuarioEmail]);
      res.json({ success: true, products: result.rows });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al obtener productos con alertas:', error);
    res.status(500).json({ success: false, message: 'Error al obtener productos con alertas' });
  }
});

// Ruta para eliminar una alerta de producto
app.post('/remove-product-alert', async (req, res) => {
  const { productId, usuarioEmail } = req.body;

  try {
    const client = await pool.connect();
    try {
      const query = `
        DELETE FROM productosAlerta
        WHERE id_producto = $1 AND usuario_mail = $2
      `;
      await client.query(query, [productId, usuarioEmail]);
      res.json({ success: true, message: 'Alerta de producto eliminada' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al eliminar la alerta del producto:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar la alerta del producto' });
  }
});

app.post('/toggle-supermarket-alert', async (req, res) => {
  const { imagen_supermercado, usuario_mail } = req.body;

  try {
    const client = await pool.connect();
    try {
      // Verificar si ya existe una alerta para este supermercado y usuario
      const checkQuery = `
        SELECT * FROM supermercadosAlerta 
        WHERE imagen_supermercado = $1 AND usuario_mail = $2
      `;
      const checkResult = await client.query(checkQuery, [imagen_supermercado, usuario_mail]);

      let isActive = false;

      if (checkResult.rows.length > 0) {
        // Si existe, eliminar la alerta
        const deleteQuery = `
          DELETE FROM supermercadosAlerta
          WHERE imagen_supermercado = $1 AND usuario_mail = $2
        `;
        await client.query(deleteQuery, [imagen_supermercado, usuario_mail]);
      } else {
        // Si no existe, crear la alerta
        const insertQuery = `
          INSERT INTO supermercadosAlerta (imagen_supermercado, usuario_mail)
          VALUES ($1, $2)
        `;
        await client.query(insertQuery, [imagen_supermercado, usuario_mail]);
        isActive = true;
      }

      res.json({ success: true, isActive: isActive });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al alternar la alerta del supermercado:', error);
    res.status(500).json({ success: false, message: 'Error al alternar la alerta del supermercado' });
  }
});
//Buscar la categoria de un producto:

app.get('/buscar_categoria', async (req, res) => {
  const { supermercado, link } = req.query; // Obtenemos los datos del query
  try {
    const categoria = await buscarCategoria(supermercado, link);
    res.json({ categoria });
  } catch (error) {
    console.error('Error al buscar la categoría:', error);
    res.status(500).json({ success: false, message: 'Error al buscar la categoría.' });
  }
});
async function buscarCategoria(nombre, link) {
  const browser = await chromium.launch({ headless: true }); // Cambia a true para modo headless
  const page = await browser.newPage();

  // Navega a la URL
  await page.goto(link, { timeout: 60000 }); // Timeout de 60 segundos para cargar la página

  // Espera a que el contenido esté disponible (con timeout de 60 segundos)
  await page.waitForLoadState('networkidle', { timeout: 60000 });

  // Asegurarse de que la página esté completamente cargada (agregar un pequeño retraso)
  await page.waitForTimeout(3000);

  let categoria = null;

  if (nombre === 'Coto') {
      // Selecciona el div que contiene los enlaces, con timeout de 30 segundos
      const breadcrumbDiv = await page.$('div.row #atg_store_breadcrumbs', { timeout: 30000 });
      if (breadcrumbDiv) {
          // Encuentra todos los enlaces dentro del div
          const enlaces = await breadcrumbDiv.$$('a', { timeout: 30000 });
          // Verifica que haya al menos 4 enlaces
          if (enlaces.length >= 4) {
              const cuartoEnlace = enlaces[3];
              categoria = await cuartoEnlace.$eval('p', node => node.innerText.trim(), { timeout: 30000 });
          } else {
              console.log("No hay suficientes enlaces en el breadcrumb.");
          }
      } else {
          console.log("No se encontró el div de breadcrumbs.");
      }
  } else if (nombre === 'Disco') {
      // Lógica para páginas de Disco
      const categoriaLink = await page.$('.vtex-breadcrumb-1-x-link.vtex-breadcrumb-1-x-link--breadcrumb-style.vtex-breadcrumb-1-x-link--breadcrumb-style--2.dib.pv1.link.ph2.c-muted-2.hover-c-link', { timeout: 30000 });
      if (categoriaLink) {
          categoria = await categoriaLink.innerText();
      } else {
          console.log("No se encontró el enlace de categoría.");
      }
  } else {
      // Lógica para otras páginas
      const categoriaLink = await page.$("a.vtex-breadcrumb-1-x-link.vtex-breadcrumb-1-x-link--3.dib.pv1.link.ph2.c-muted-2.hover-c-link", { timeout: 30000 });
      // Verificar si se encontró el enlace y extraer el texto
      if (categoriaLink) {
          categoria = await categoriaLink.innerText(); // Usar 'categoriaLink' en lugar de 'categoria'
          console.log(categoria.trim());
      } else {
          console.log("No se encontró el enlace de la categoría.");
      }
  }

  // Eliminar el símbolo '>' al final si está presente
  if (categoria) {
      categoria = categoria.replace(/>\s*$/, ''); // Elimina '>' y cualquier espacio después de él
  }

  // Cierra el navegador
  await page.close();
  await browser.close();

  return categoria ? categoria.trim() : null; // Retorna la categoría encontrada o null
}


// Add this route to your existing server.js file

app.post('/get-spending-trends', async (req, res) => {
  const { username, filterType } = req.body;
  
  try {
    const client = await pool.connect();
    try {
      let timeFilter;
      switch (filterType) {
        case 'year':
          timeFilter = "l.fechaLista >= DATE_TRUNC('year', CURRENT_DATE)";
          break;
        case 'semester':
          timeFilter = "l.fechaLista >= CURRENT_DATE - INTERVAL '6 months'";
          break;
        case 'month':
          timeFilter = "l.fechaLista >= DATE_TRUNC('month', CURRENT_DATE)";
          break;
        default:
          timeFilter = "1=1"; // No filter
      }

      const query = `
        SELECT P.categoria, SUM(lP.preciototal) as total_gasto
        FROM lista_productos lP 
        INNER JOIN listas L ON lP.lista_id = L.id 
        INNER JOIN productos P ON lP.producto_id = P.id
        WHERE L.mail_id = $1 
        AND ${timeFilter}
        GROUP BY P.categoria
        ORDER BY total_gasto DESC
      `;

      const result = await client.query(query, [username]);

      const spendingData = result.rows.map(row => ({
        name: row.categoria,
        value: parseFloat(row.total_gasto)
      }));

      const totalSpent = spendingData.reduce((sum, item) => sum + item.value, 0);

      // Obtener top categorías
      const topCategories = await client.query(`
        SELECT p.categoria, COUNT(*) as count, MAX(p.imagen) as image
        FROM lista_productos lp
        JOIN productos p ON lp.producto_id = p.id
        JOIN listas l ON lp.lista_id = l.id
        WHERE l.mail_id = $1 AND ${timeFilter}
        GROUP BY p.categoria
        ORDER BY count DESC
        LIMIT 3
      `, [username]);

      // Obtener top productos
      const topProducts = await client.query(`
        SELECT p.descripcion, COUNT(*) as count, p.imagen
        FROM lista_productos lp
        JOIN productos p ON lp.producto_id = p.id
        JOIN listas l ON lp.lista_id = l.id
        WHERE l.mail_id = $1 AND ${timeFilter}
        GROUP BY p.descripcion, p.imagen
        ORDER BY count DESC
        LIMIT 3
      `, [username]);

      res.json({
        success: true,
        spendingData,
        totalSpent,
        topCategories: topCategories.rows.map(row => ({
          name: row.categoria,
          image: row.image
        })),
        topProducts: topProducts.rows.map(row => ({
          name: row.descripcion,
          image: row.imagen
        }))
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error getting spending trends:', error);
    res.status(500).json({ success: false, message: 'Error getting spending trends' });
  }
});
app.get('/recipes', async (req, res) => {
  const { category } = req.query;

  try {
    const client = await pool.connect();
    try {
      const query = `
        SELECT r.idReceta, r.nombreReceta, r.categoria, r.imagen,
               json_agg(json_build_object('idIngrediente', i.idIngrediente, 'nombreIngrediente', i.nombreIngrediente)) as ingredientes
        FROM recetas r
        LEFT JOIN receta_ingrediente ri ON r.idReceta = ri.idReceta
        LEFT JOIN ingredientes i ON ri.idIngrediente = i.idIngrediente
        WHERE r.categoria = $1
        GROUP BY r.idReceta, r.nombreReceta, r.categoria, r.imagen
      `;
      const result = await client.query(query, [category]);
      res.json(result.rows);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching recipes:', error);
    res.status(500).json({ success: false, message: 'Error fetching recipes' });
  }
});
app.post('/recommend-recipe', async (req, res) => {
  const { products } = req.body;  // Productos enviados desde el frontend

  if (!products || products.length < 3) {
      return res.status(400).json({ message: 'Se requieren al menos 3 productos para la recomendación de receta.' });
  }

  try {
      const client = await pool.connect();
      try {
          // Obtener todas las recetas
          const recipesResult = await client.query('SELECT * FROM recetas');
          const recipes = recipesResult.rows;

          let bestMatch = null;
          let bestScore = 0;
          const matchedRecipes = new Set(); // Usamos un Set para evitar duplicados

          for (const recipe of recipes) {
              // Obtener los ingredientes de la receta actual usando la tabla receta_ingrediente para unir con ingredientes
              const ingredientsResult = await client.query(`
                  SELECT i.nombreIngrediente 
                  FROM ingredientes i
                  INNER JOIN receta_ingrediente ri ON i.idIngrediente = ri.idIngrediente
                  WHERE ri.idReceta = $1
              `, [recipe.idReceta]);

              const recipeIngredients = ingredientsResult.rows.map(row => row.nombreIngrediente.toLowerCase());

              // Calcular el puntaje de coincidencia basado en los productos seleccionados
              const score = products.reduce((total, product) => {
                  const productWords = product.toLowerCase().split(' ');
                  const bestIngredientMatch = Math.max(...recipeIngredients.map(ingredient => {
                      const ingredientWords = ingredient.split(' ');
                      return stringSimilarity.findBestMatch(product.toLowerCase(), ingredientWords).bestMatch.rating;
                  }));
                  return total + bestIngredientMatch;
              }, 0);

              // Si la receta actual tiene ingredientes idénticos a una receta anterior, saltar
              const ingredientsKey = recipeIngredients.sort().join(',');
              if (matchedRecipes.has(ingredientsKey)) {
                  continue; // Saltar recetas duplicadas
              }

              // Actualizar la mejor coincidencia si se encontró una receta con un mejor puntaje
              if (score > bestScore) {
                  bestScore = score;
                  bestMatch = recipe;
                  matchedRecipes.add(ingredientsKey); // Marcar esta receta como ya analizada
              }
          }

          // Si se encontró una receta coincidente
          if (bestMatch) {
              const ingredientsResult = await client.query(`
                  SELECT i.nombreIngrediente 
                  FROM ingredientes i
                  INNER JOIN receta_ingrediente ri ON i.idIngrediente = ri.idIngrediente
                  WHERE ri.idReceta = $1
              `, [bestMatch.idReceta]);

              bestMatch.ingredientes = ingredientsResult.rows.map(row => row.nombreIngrediente);
              res.json(bestMatch);
          } else {
              res.status(404).json({ message: 'No se encontró ninguna receta que coincida' });
          }
      } finally {
          client.release();
      }
  } catch (error) {
      console.error('Error recomendando receta:', error);
      res.status(500).json({ message: 'Error recomendando receta' });
  }
});


const port = 8080;
app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});