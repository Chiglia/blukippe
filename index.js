const express = require('express');
var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);
var encoder = express.urlencoded({ extended: true });
const mysql = require('mysql2');
var createError = require('http-errors');
require('dotenv').config();
const port = process.env.ENV_PORT;
const app = express();
var path = require('path');
var flush = require('connect-flash');
var bcrypt = require('bcrypt');
const fs = require('fs');
const fileUpload = require('express-fileupload');
app.use(fileUpload());
const sharp = require("sharp");

app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(flush());

const mysqlConfig = {
  host: process.env.ENV_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQL_TCP_PORT
}

let db = mysql.createConnection(mysqlConfig);

db.connect((err) => {
  if (err) {
    console.error('Errore durante la connessione al database:', err);
    return;
  }
  console.log("Connected to the database...")
  creaLoginuser();
  creanotizie();
  creaattivita();
});

global.sessionStore = new MySQLStore({
  expiration: 34560000,
  createDatabaseTable: true,
  schema: {
    tableName: process.env.ENV_TABLE,
    columnNames: {
      session_id: process.env.ENV_SESSION,
      expires: process.env.ENV_EXPIRES,
      data: process.env.ENV_DATA
    }
  }
}, db);

const biscotto = session({
  key: process.env.ENV_KEY,
  secret: process.env.ENV_SECRET,
  store: sessionStore,
  cookie: { maxAge: 34560000 },
  resave: false,
  saveUninitialized: false,
});

app.use(biscotto);

app.get('/', function (req, res) {
  db.query("select descrizione,titolo,immagine from notizie order by id desc", async function (error, scheda) {
    console.log(scheda);
    const notizie = JSON.parse(JSON.stringify(scheda));
    res.render('index', { notizie: notizie });
  });
});

app.get('/Chi_Siamo', function (req, res) {
  res.render('Chi_Siamo');
});

app.get('/Contatti', function (req, res) {
  res.render('Contatti');
});

app.get('/login', function (req, res, next) {
  res.render('login', { "message": req.flash('message') });
});

app.post("/login", encoder, function (req, res) {
  var password = req.body.password;
  var email = req.body.email;
  db.query("select user_email, user_pass from loginuser where user_email = ?", [email], async function (error, results) {
    if (error) {
      console.log(error);
    }
    console.log(results[0]);
    if (results.length > 0) {

      var hashedPassword = results[0].user_pass;
      if (await bcrypt.compare(password, hashedPassword)) {
        console.log(results.length);
        req.session.userinfo = results[0].user_email;
        res.redirect("user");
      } else {
        req.flash('message', ' Password sbagliata');
        res.redirect("login");
      }
    } else {
      req.flash('message', ' email sbagliata o inesistente');
      res.redirect("login");
    }
  })
})

app.get('/user', verificaAutenticazione, function (req, res, next) {
  db.query("SELECT * FROM notizie ORDER BY id DESC", async function (error, scheda) {
    if (error) {
      return next(error);
    }

    db.query("SELECT titolo,descrizione FROM attivita", async function (error, descrizioni) {
      if (error) {
        return next(error);
      }
      const notizie = JSON.parse(JSON.stringify(scheda));
      const descrizioniData = JSON.parse(JSON.stringify(descrizioni));
      res.render('user', { notizie: notizie, descrizioni: descrizioniData });
    });
  });
});


app.post("/upload", encoder, verificaAutenticazione, function (req, res) {
  var titolo = req.body.title;
  var descrizione = req.body.description;

  if (!req.files || !req.files.image) {
    return res.status(400).send('Nessun file caricato');
  }

  const image = req.files.image;
  const imageBuffer = image.data;

  // Verifica se il file caricato è un'immagine
  if (!/^image/.test(image.mimetype)) {
    req.flash('message', ' test');
    return res.redirect("login");
  }

  var images = sharp(imageBuffer);
  images.toFormat("jpeg", { mozjpeg: true });
  images.metadata()
    .then(metadata => {
      console.log(metadata);
      if (metadata.width > 300) {
        return images.rotate().resize(300, null).toBuffer();
      } else {
        return images.rotate().toBuffer();
      }
    })
    .then(imageData => {
      const base64Image = imageData.toString('base64');

      db.query("insert into notizie (titolo, descrizione, immagine) values (?, ?, ?)", [titolo, descrizione, base64Image]);
    })
    .then(() => {
      res.redirect("user");
      console.log("Immagine aggiunta con successo");
    })
    .catch(error => {
      console.error('Errore durante il caricamento e la manipolazione dell\'immagine:', error);
      res.status(500).send('Errore del server');
    });
});


app.delete('/delete/:id', verificaAutenticazione, (req, res) => {
  console.log("test");
  const itemId = req.params.id;
  db.query("DELETE FROM notizie WHERE id = ?;", [itemId]);

  res.sendStatus(204); // Risposta senza contenuto (elemento eliminato con successo)
});

app.get('/attivita', function (req, res, next) {
  var route = req.query.token;
  db.query('SELECT * FROM attivita WHERE titolo = ?', [route], function (error, results, fields) {
    if (error) {
      return next(error);
    }
    res.render('attivita', { route: route, attivita: results });
  });
});

app.post('/upload-attivita', (req, res, next) => {
  const { titolo, descrizione } = req.body;
  const image = req.files ? req.files.image : null;

  if (image) {
    sharp(image.data)
      .resize({ width: 1000 })
      .toFormat('jpeg', { mozjpeg: true })
      .toBuffer((err, imageBuffer, info) => {
        if (err) {
          console.error('Errore durante il ridimensionamento e la conversione dell\'immagine:', err);
          return res.status(500).json({ error: 'Errore durante il ridimensionamento e la conversione dell\'immagine' });
        }

        const newFileName = `${titolo}.jpg`;

        fs.writeFile(`images/discipline/${newFileName}`, imageBuffer, (err) => {
          if (err) {
            console.error('Errore durante il salvataggio dell\'immagine:', err);
            return res.status(500).json({ error: 'Errore durante il salvataggio dell\'immagine' });
          }

          db.query('UPDATE attivita SET descrizione = ? WHERE titolo = ?', [descrizione, titolo], (err, result) => {
            if (err) {
              console.error('Errore durante l\'esecuzione della query:', err);
              return res.status(500).json({ error: 'Errore durante l\'esecuzione della query' });
            }

            res.redirect('/user');
          });
        });
      });
  } else {
    db.query('UPDATE attivita SET descrizione = ? WHERE titolo = ?', [descrizione, titolo], (err, result) => {
      if (err) {
        console.error('Errore durante l\'esecuzione della query:', err);
        return res.status(500).json({ error: 'Errore durante l\'esecuzione della query' });
      }

      res.redirect('/user');
    });
  }
});

function creaLoginuser() {
  const checkTableQuery = `SELECT 1 FROM loginuser LIMIT 1`;
  db.query(checkTableQuery, (err, result) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') {    // Se la tabella non esiste, creala
        const createTableQuery = `
        CREATE TABLE loginuser (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_email VARCHAR(255),
          user_pass VARCHAR(255)
        )
      `;
        db.query(createTableQuery, async (err, result) => {
          if (err) {
            console.error('Errore durante la creazione della tabella loginuser:', err);
            return;
          }
          console.log('Tabella loginuser creata con successo.');
          email = process.env.loginuser_email;
          password = process.env.loginuser_pass;
          const salt = await bcrypt.genSalt();
          let hashedPassword = await bcrypt.hash(password, salt);
          console.log(hashedPassword);
          console.log(salt);
          db.query("insert into loginuser(user_pass,user_email) values( ?, ? )", [hashedPassword, email], function (error, results) {
            if (error) {
              console.log(error);
            } else {
              console.log(results);
            }
          });
        });
      } else {
        console.error('Errore durante la verifica della tabella loginuser:', err);
        return;
      }
    } else {
      console.log('La tabella loginuser esiste già.');
    }
  });
}

function creanotizie() {
  const checkTableQuery = `SELECT 1 FROM notizie LIMIT 1`;
  db.query(checkTableQuery, (err, result) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') {    // Se la tabella non esiste, creala
        const createTableQuery = `
        CREATE TABLE notizie (
          id INT AUTO_INCREMENT PRIMARY KEY,
          titolo VARCHAR(80),
          descrizione VARCHAR(255),
          immagine LONGTEXT
        )`;
        db.query(createTableQuery, async (err, result) => {
          if (err) {
            console.error('Errore durante la creazione della tabella notizie:', err);
            return;
          }
          console.log('Tabella notizie creata con successo.');
        });
      } else {
        console.error('Errore durante la verifica della tabella notizie:', err);
        return;
      }
    } else {
      console.log('La tabella notizie esiste già.');
    }
  });

}

function creaattivita() {
  const checkTableQuery = `SELECT 1 FROM attivita LIMIT 1`;
  db.query(checkTableQuery, (err, result) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        const createTableQuery = `
        CREATE TABLE attivita (
          id INT AUTO_INCREMENT PRIMARY KEY,
          titolo VARCHAR(80),
          descrizione VARCHAR(255),
          immagine LONGTEXT
        )`;
        db.query(createTableQuery, async (err, result) => {
          if (err) {
            console.error('Errore durante la creazione della tabella loginuser:', err);
            return;
          }
          console.log('Tabella attivita creata con successo.');
          db.query("insert into attivita(titolo,descrizione,immagine) values( ?, ? ,? ),( ?, ? ,? ),( ?, ? ,? ),( ?, ? ,? ),( ?, ? ,? ),( ?, ? ,? )",
            ['artistica', "descrizione artistica", '/images/discipline/artistica.jpg',
              'yoga', "descrizione yoga", '/images/discipline/yoga.jpg',
              'tessuti', "descrizione tessuti", '/images/discipline/tessuti.jpg',
              'thai', "descrizione thai", '/images/discipline/thai.jpg',
              'ritmica', "descrizione ritmica", '/images/discipline/ritmica.jpg',
              'teatro', "descrizione teatro", '/images/discipline/teatro.jpg'
            ], function (error, results) {
              if (error) {
                console.log(error);
              } else {
                console.log(results);
              }
            });
        });
      } else {
        console.error('Errore durante la verifica della tabella attivita:', err);
        return;
      }
    } else {
      console.log('La tabella attivita esiste già.');
    }
  });
}

function verificaAutenticazione(req, res, next) {
  if (req.session && req.session.userinfo) {
    next();
  } else {
    req.flash('message', ' errore! fai prima il login');
    res.redirect("login");
  }
}

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404, 'Pagina non trovata'));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

app.listen(port, (err) => {
  if (err) {
    return console.error(err);
  }
  return console.log(`app is listening on ${port}`);
});