const express = require('express');
const mysql = require('mysql2');
var path = require('path');
var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);
var createError = require('http-errors');
require('dotenv').config();
const port = process.env.ENV_PORT;
const http = require("http");
const app = express();
const cors =require("cors");
const { Server } = require("socket.io");
var flush = require('connect-flash');
var encoder = express.urlencoded({ extended: true });
var bcrypt = require('bcrypt');
var nodemailer = require('nodemailer');
var crypto = require('crypto');
var Excel = require('exceljs');
const date = new Date();
const ore = date.getHours();
const minuti = date.getMinutes();
const orario = ore + ":" + minuti;
const anno = date.getFullYear();
const fs = require('fs');
const fileUpload = require('express-fileupload');
app.use(fileUpload());
const sharp = require("sharp");


var transporter = nodemailer.createTransport({
  service: process.env.service,
  auth: {
    user: process.env.user,
    pass: process.env.pass
  }
});

app.use(cors());
app.use(flush());

const server = http.createServer(app);
const io = new Server(server,{
  cors: {
    origin: process.env.origin,
    methods: ["GET", "POST"],
  },
});

const mysqlConfig = {
  host: process.env.ENV_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQL_TCP_PORT
}

let db =  mysql.createConnection(mysqlConfig);


db.connect((error) => {
    if (error) {
      console.log(error)
    }
    else console.log("Connected to the database...")
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

  io.use((socket, next) => {
    biscotto(socket.request, {}, next);
  }); 

// view engine setup
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');  

io.on("connect_error", (err) => {
  console.log(`connect_error due to ${err.message}`);
});

io.on('connection', (socket) => {
  if (!socket.destroyed) socket.write("something");
  const session = socket.request.session;
  //console.log('This user connected:', socket.id);
  if (session.userinfo) {
    db.query("select user_email,user_name,branca from loginuser where user_email = ?", [session.userinfo], async function (error, results) {
      if (error) {
        console.log(error);
      } else {
        socket.emit('message', formatMessage('Padova 6','', 'Benvenut!'));

        socket.broadcast.emit('message', formatMessage('Padova 6','', `${results[0].user_name} si è connesso`));

        socket.on('disconnect', () => {
          io.emit('message', formatMessage('Padova 6', `${results[0].user_name} si è disconnesso`));
        });
        socket.on('chatMessage', msg => {
          io.emit('message', formatMessage(results[0].user_name,results[0].branca, msg));
        });
      }
    });
  }
});

function formatMessage(username,branca, text) {
  return {
    username,
    branca,
    text,
    time: orario
  }
}

app.get('/', function (req, res) {
  var user = false;
  if (req.session.userinfo) {
    user = true;
  }
  console.log("Questa persona è in index: " + req.session.userinfo);
  req.flash('message', user);
  res.render('index', { "message": req.flash('message') });
});

app.get('/login', function (req, res, next) {
  res.render('login', { "message": req.flash('message') });
});

app.get('/register', function (req, res, next) {
  res.render('register', { "message": req.flash('message') });
});

app.get('/foto', function (req, res, next) {
  if (req.session.userinfo) {
    console.log("Questa persona è in foto: " + req.session.userinfo);
    db.query("select user_email,user_name from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
      if (error) {
        console.log(error);
      } else {
        req.flash('message', results[0].user_name);
        res.render('fotos', { 
          "message": req.flash('message'),
          anno:anno,
        });
      }
    });
  } else {
    req.flash('message', ' errore! fai prima il login');
    res.redirect("login");
  }
});

app.get('/Calendario', function (req, res, next) {
  var user = false;
  if (req.session.userinfo) {
    user = true;
  }
  console.log("Questa persona è in Calendario: " + req.session.userinfo);
  req.flash('message', user);
  res.render('Calendario', { "message": req.flash('message') });
});

app.get('/Enciclopedia', function (req, res, next) {
  var user = false;
  if (req.session.userinfo) {
    user = true;
  }
  console.log("Questa persona è in Enciclopedia: " + req.session.userinfo);
  req.flash('message', user);
  res.render('Enciclopedia', { "message": req.flash('message') });
});

app.get('/chat', function (req, res, next) {
  if (req.session.userinfo) {
    db.query("select user_email,user_name from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
      if (error) {
        console.log(error);
      } else {
        db.query("select (admin_check=1) as admin_check from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
          if (error) {
            console.log(error);
          }
          if (results[0].admin_check == 1) {
            console.log("Questa persona è in Chat: " + req.session.userinfo);
            req.flash('message', results[0].user_name);
            res.render('Chat', { "message": req.flash('message') });


          }else{
          req.flash('message', ' solo i capi possono accedere a questa pagina!');
          res.redirect("login");
          console.log(req.session);
        }
        });}
      });
    }else{
      req.flash('message', ' sessione scaduta rifai il login');
      res.redirect("login");
    }
  });

app.get('/Iscrizioni', function (req, res, next) {
if (req.session.userinfo) {
  db.query("select user_email,user_name from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
    if (error) {
      console.log(error);
    } else {
      db.query("select * from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
        if (error) {
          console.log(error);
        }
        if (results[0].branca == "LC" || results[0].branca == "EG" || results[0].branca == "NO" || results[0].branca == "RS" || results[0].admin_check == 1) {
          console.log("Questa persona è in Iscrizioni: " + req.session.userinfo);
          const jsonProfilo = JSON.parse(JSON.stringify(results));
          jsonProfilo.push(req.flash('message'));
          res.render('Iscrizioni', { jsonProfilo: jsonProfilo });

        }else{
        req.flash('message', ' solo chi fa parte del gruppo può accedere a questa pagina!');
        res.redirect("login");
        //console.log(req.session);
      }
      });}
    });
  }else{
    req.flash('message', ' sessione scaduta rifai il login');
    res.redirect("login");
  }
});  

app.get('/user', function (req, res, next) {
  if (req.session.userinfo) {
    db.query("select user_email,user_name,branca,(admin_check=1) as admin_check from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
      if (error) {
        console.log(error);
      } else {
        const username = results[0].user_name;
        const email = results[0].user_email;
        const branca = results[0].branca;
        const admin_check = results[0].admin_check;
        var Orders = [username, email, branca, admin_check];
        req.flash('info', username);
        req.flash('info', email);
        req.flash('info', branca);
        //console.log(admin_check);
        console.log("questa persona è in user: " + req.session.userinfo);

        res.render('user', { Orders: Orders });
        console.log("Ho passato questi dati: " + Orders);
      }
    });
  } else {
    req.flash('message', ' sessione scaduta rifai il login');
    res.redirect("login");
  }
});

app.get('/fotos', function (req, res, next) {
  if (req.session.userinfo) {
    db.query("select user_email,user_name,branca from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
      if (error) {
        console.log(error);
      } else {
        if (results[0].branca) {
          var route = req.query.token;
          console.log("Questa persona è in " + route + ": " + req.session.userinfo);
          const branca = route.slice(0, 2);
          const anno2 = route.slice(2, 6);
          if((anno2<=anno && anno2>=2022) && (branca=="lc" || branca=="eg" || branca=="no" || branca=="rs")){
          let images = getImagesFromDir(path.join(__dirname, `/public/uploads/${anno2}/${branca}`),anno2,branca);///public/uploads/${route}
          let grandezze = getDimentionsFromDir(path.join(__dirname, `/public/uploads/${anno2}/${branca}`));///public/uploads/${route}
          console.log(grandezze);
          //console.log(images);

          res.render('foto', {
            images: images,
            route:route,
          });
      
        }else{
        req.flash('message', ' non abbiamo fatto una pagina su questo anno');
          res.redirect("login");
      }}
        else {
          req.flash('message', ' non fai parte del gruppo, scrivici se pensi sia un problema');
          res.redirect("login");
        }
      }
    });
  } else {
    req.flash('message', ' sessione scaduta rifai il login');
    res.redirect("login");
  }
});

function getImagesFromDir(dirPath,anno,branca) {
  let allImages = [];
  let files = fs.readdirSync(dirPath)

  for (let i in files) {
      let file = files[i]
      let fileLocation = path.join(dirPath, file)
      var stat = fs.statSync(fileLocation);
      if (stat && stat.isDirectory()) {
          getImagesFromDir(fileLocation)
      } else if (stat && stat.isFile() && ['.jpg', '.png', '.jpeg'].indexOf(path.extname(fileLocation)) !== -1) {
          allImages.push(`uploads/${anno}/${branca}/` + file)
      }
  }
  return allImages
};

function getDimentionsFromDir(dirPath) {
  let allDimentions = [];
  let files = fs.readdirSync(dirPath)

  for (let i in files) {
      let file = files[i]
      let fileLocation = path.join(dirPath, file)
      const buffer = fs.readFileSync(fileLocation)
      sharp(buffer)
      .metadata()
      .then((metadata) => {
        const width = metadata.width;
        const height = metadata.height;
        //console.log(`Image dimensions from sharp: ${width}x${height}`);
        allDimentions.push(width);      
        allDimentions.push(height); 
      });
     
      console.log(allDimentions)

  }
  console.log(allDimentions)
  return allDimentions
};


/*
 image.metadata(function (err, metadata) {
        if(err)console.log(err);
        /*console.log("giro "+i)
        console.log(metadata.width);
        console.log(metadata.height);  
        //console.log("giro "+i)
        var wid = metadata.width;
        var hei = metadata.height;
        //console.log(wid)
        //console.log(hei)
        allDimentions.push(wid);      
        allDimentions.push(hei); 
        console.log(allDimentions)
      });
      */

app.post('/upload', (req, res) => {
  if (req.session.userinfo) {
    db.query("select user_email,user_name from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
      if (error) {
        console.log(error);
      } else {
        db.query("select (admin_check=1) as admin_check from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
          if (error) {
            console.log(error);
          }
          if (results[0].admin_check == 1) {
            var route = req.query.token;
            const branca = route.slice(0, 2);
            const anno2 = route.slice(2, 6);
            //console.log(route);

            if ((anno2 <= anno && anno2 >= 2022) && (branca == "lc" || branca == "eg" || branca == "no" || branca == "rs")) {
              const { image } = req.files;
              console.log(image);
              // If no image submitted, exit
              if (!image) { req.flash('message', ' non hai caricato niente'); res.redirect("login"); }

              else {
                if (image.length != undefined) { 
                
                for (var i = 0; i < image.length; i++) {
                  console.log(image[i]);
                  // If does not have image mime type prevent from uploading
                  if (/^image[i]/.test(image[i].mimetype)){ req.flash('message', ' test'); res.redirect("login"); break;};
                  var nome_imma = crypto.randomBytes(6).toString('hex') + '.jpeg';//con 6 sono tipo 20349 combinazioni e con 7 sono 74613
                  var cartella = path.join(__dirname, `/public/uploads/${anno2}/${branca}/`) + nome_imma;
                  console.log("giro "+i);
                  var brocker = image[i].data;
                  var images = sharp(brocker);

                  console.log(brocker);
                  images.toFormat("jpeg", { mozjpeg: true });
                  images.metadata(function (err, metadata) {
                    if(err)console.log(err);
                    console.log(metadata);
                    if (metadata.width > 1920) {
                      images.rotate().resize(1920, null).toFile(cartella);
                      console.log("ho ridimensionato l'immagine a 1920p");
                    } else {
                      images.rotate().toFile(cartella);
                    }
                  });
                  console.log("Questa persona ha caricato " + image[i].name + " in " + route + ": " + req.session.userinfo);
                  await sleep(10000);
                };

                }else { 
                    console.log(image);
                    // If does not have image mime type prevent from uploading
                    if (!/^image/.test(image.mimetype)){ req.flash('message', ' test'); res.redirect("login");};
                    var nome_imma = crypto.randomBytes(6).toString('hex') + '.jpeg';//con 6 sono tipo 20349 combinazioni e con 7 sono 74613
                    var cartella = path.join(__dirname, `/public/uploads/${anno2}/${branca}/`) + nome_imma;

                    var images = sharp(image.data);
  
                    images.toFormat("jpeg", { mozjpeg: true });
                    images.metadata(function (err, metadata) {
                      if(err)console.log(err);
                      console.log(metadata);
                      if (metadata.width > 1920) {
                        images.rotate().resize(1920, null).toFile(cartella);
                        console.log("ho ridimensionato l'immagine a 1920p");
                      } else {
                        images.rotate().toFile(cartella);
                      }
                    });
                    console.log("Questa persona ha caricato " + image.name + " in " + route + ": " + req.session.userinfo);
                  
                };

                await sleep(1000);

                res.redirect(`fotos?token=${route}`);
              }
            } else {
              req.flash('message', ' non abbiamo fatto una pagina su questo anno');
              res.redirect("login");
            }
          } else {
            req.flash('message', ' solo i capi possono caricare foto');
            res.redirect("login");
            console.log(req.session);
          }
        });
      }
    });
  } else {
    req.flash('message', ' sessione scaduta rifai il login');
    res.redirect("login");
  }
});


app.get('/verify-email', async function (req, res, next) {
  var token = req.query.token;
  console.log(token);
  db.query("select user_token from loginuser where  user_token = ?", [token], async function (error, results) {
    console.log("token trovato");
    console.log(results);
    console.log(results[0].user_token);
    if (error) {
      console.log(error);
    }
    if (token == results[0].user_token) {
      var status = true;
      db.query("update loginuser set user_status = true where user_token = ?", [token], async function (error, results) {
        if (error) {
          console.log(error);
        }
        else {
          console.log("updatato");
          db.query("select user_name from loginuser where  user_token = ?", [token], async function (error, results) {
            if (error) {
              console.log(error);
            }
            req.flash('message', results[0].user_name);
            res.redirect("user");
          });
        }
      });
    } else {
      req.flash('message', ' token invalido, contattaci');
      res.redirect("register");
      console.log("token invalido");
    }
  })
});

app.post("/login", encoder, function (req, res) {
  var password = req.body.password;
  var email = req.body.email;
  db.query("select user_email, user_pass , user_name , (user_status = 1) as user_status from loginuser where user_email = ?", [email], async function (error, results) {
    if (error) {
      console.log(error);
    }
    console.log(results[0]);
    if (results.length > 0) {
      if (results[0].user_status == 1) {
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
        req.flash('message', ' Conferma la mail');
        res.redirect("login");
      }
    } else {
      req.flash('message', ' email sbagliata o inesistente');
      res.redirect("login");
    }
  })
})

app.post("/register", encoder, function (req, res) {
  var name = req.body.name;
  var password = req.body.password;
  var Confirmpassword = req.body.Confirmpassword;
  var email = req.body.email;
  db.query("select user_email from loginuser where user_email = ?", [email], async function (error, results) {
    if (error) {
      console.log(error);
    }
    if (results.length > 0) {
      req.flash('message', ' Questa mail è già stata utilizzata!');
      res.redirect("register");
    }
    else if (password !== Confirmpassword) {
      req.flash('message', ' Le password non corrispondono!');
      res.redirect("register");
    } else {
      const salt = await bcrypt.genSalt();
      let hashedPassword = await bcrypt.hash(password, salt);
      console.log(hashedPassword);
      console.log(salt);
      var status = false;
      var token = crypto.randomBytes(64).toString('hex');
      db.query("insert into loginuser(user_name,user_pass,user_email,user_status,user_token) values( ?, ? , ?, ?, ?)", [name, hashedPassword, email, status, token], function (error, results) {
        if (error) {
          console.log(error);
        } else {
          console.log(results);

          var mailOptions = {
            from: process.env.user,
            to: email,
            subject: 'Email di conferma',
            text: `https://padova6.chiglia.ovh/verify-email?token=${token}`,
            html: `
          <p>Salve questa è la mail di conferma per il sito ufficiale del gruppo scout Padova 6. Se sei stato tu a registrarti sul sito semplicemente schiaccia sul
          link qui sotto. Se non sei stato tu ignora questa mail.</p>
          <a style="text-decoration:none;background-color:blue;border:none;color:white;padding:10px 30px;border-radius:3px;cursor:pointer"href="https://padova6.chiglia.ovh/verify-email?token=${token}">verifica il tuo account</a>
          <p>Se in futuro verrai contattato da mail che non sono questa ignorale, questa è l'unica mail del Padova 6</p>`
          };

          transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
              console.log(error);
            } else {
              console.log('Email sent: ' + info.response);
            }
          });
        }
        req.flash('message', ' Ti abbiamo inviato un email di conferma');
        res.redirect("register");
      });
    }
  })
})

app.get('/logout', function (req, res, next) {
        //res.cookie("key", value);
        res.clearCookie("userID");
        res.redirect('/');
        res.end();
});

app.get('/pagamenti', function (req, res, next) {
  if (req.session.userinfo) {
    db.query("select user_email,user_name from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
      if (error) {
        console.log(error);
      } else {
        db.query("select (admin_check=1) as admin_check from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
          if (error) {
            console.log(error);
          }
          else if (results[0].admin_check == 1) {
            db.query("SELECT * FROM pagamenti ORDER BY id DESC LIMIT 2", function (error, pagamenti, fields) {
              if (error) {
                console.log(error);
              }
              const jsonPagamanti = JSON.parse(JSON.stringify(pagamenti));
              jsonPagamanti.push(req.flash('message'));
              res.render('pagamenti', { jsonPagamanti: jsonPagamanti });

            });
          } else {
            res.redirect('user');
            console.log(req.session);
          }
        });
      }
    });
  } else {
    req.flash('message', ' sessione scaduta rifai il login');
    res.redirect("login");
  }
});


app.post("/pagamenti", encoder, function (req, res) {
  if (req.session.userinfo) {
    db.query("select user_email,user_name from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
      if (error) {
        console.log(error);
      } else {
        db.query("select (admin_check=1) as admin_check from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
          if (error) {
            console.log(error);
          }
          if (results[0].admin_check == 1) {
            var imp = req.body.importo;
            var tipo = req.body.tipo;
            var data = req.body.data;
            var contanti = req.body.contanti;
            var bancomat = req.body.bancomat;
            console.log(imp);
            console.log(tipo);
            console.log(data);
            console.log(bancomat);
            console.log(contanti);
            if (contanti == "on" & bancomat == undefined) {
              db.query("insert into pagamenti (importo,tipo_di_spesa, data,bancomat) values (?,?,?,'1')", [imp, tipo, data], async function (error, results) {
                if (error) {
                  console.log(error);
                }
                res.redirect("pagamenti");
              });
            } else if (contanti == undefined & bancomat == "on") {
              db.query("insert into pagamenti (importo,tipo_di_spesa, data,bancomat) values (?,?,?,'0')", [imp, tipo, data], async function (error, results) {
                if (error) {
                  console.log(error);
                }
                res.redirect("pagamenti");
              });
            } else if (contanti == "on" & bancomat == "on") {
              req.flash('message', ' seleziona o bancomat o contanti');
              res.redirect("pagamenti");
            } else if (contanti == undefined & bancomat == undefined) {
              req.flash('message', ' seleziona o bancomat o contanti');
              res.redirect("pagamenti");
            }
          } else {
            req.flash('message', ' solo per capi');
            res.redirect("login");
            console.log(req.session);
          }
        });
      }
    });
  } else {
    req.flash('message', ' sessione scaduta rifai il login');
    res.redirect("login");
  }
})

app.get('/profili', function (req, res, next) {
  if (req.session.userinfo) {
    db.query("select user_email,user_name from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
      if (error) {
        console.log(error);
      } else {
        db.query("select (admin_check=1) as admin_check from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
          if (error) {
            console.log(error);
          }
          else if (results[0].admin_check == 1) {
            db.query("SELECT * FROM loginuser ORDER BY id", function (error, loginuser, fields) {
              if (error) {
                console.log(error);
              }
              const jsonPagamanti = JSON.parse(JSON.stringify(loginuser));
              jsonPagamanti.push(req.flash('message'));
              console.log("questa persona è in profili: " + req.session.userinfo);
              res.render('profili', { jsonPagamanti: jsonPagamanti });

            });
          } else {
            req.flash('message', ' solo per capi');
            res.redirect("login");
            console.log(req.session);
          }
        });
      }
    });
  } else {
    req.flash('message', ' sessione scaduta rifai il login');
    res.redirect("login");
  }
});


app.post("/update", encoder, function (req, res) {
  if (req.session.userinfo) {
    db.query("select user_email,user_name from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
      if (error) {
        console.log(error);
      } else {
        var name = results[0].user_name;
        db.query("select user_email,user_name,(admin_check=1) as admin_check from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
          if (error) {
            console.log(error);
          }
          if (results[0].admin_check == 1) {
            var id = req.body.id;
            db.query("select * from loginuser where id = ?", [id], async function (error, results) {
              var branca = req.body.branca;
              if(req.body.email == "")var email = results[0].user_email;
              else{var email = req.body.email;}  
              if(req.body.name == "")var user_name = results[0].user_name;
              else{var user_name = req.body.name;}           
              if(req.body.user_status== "on"){var user_status = true;}
              else{var user_status = false;}
              if(req.body.admin_check=="on"){var admin_check = true;}
              else{var admin_check = false;}

              db.query("update loginuser set branca = ? , user_status = ? , admin_check = ? , user_email = ? , user_name = ? where id = ?", [branca,user_status, admin_check,email,user_name,id], async function (error, results) {
                if (error) {
                  console.log(error);
                }
                else{
                console.log("ho aggiornato da profili: "+ name);
              }
              });
            });
            res.redirect("profili");

          } else {
            req.flash('message', ' solo per capi');
            res.redirect("login");
          }
        });
      }
    });
  } else {
    req.flash('message', ' sessione scaduta rifai il login');
    res.redirect("login");
  }
})

app.post("/register_admin", encoder, function (req, res) {
  if (req.session.userinfo) {
    db.query("select user_email,user_name from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
      if (error) {
        console.log(error);
      } else {
        db.query("select (admin_check=1) as admin_check from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
          if (error) {
            console.log(error);
          }
          if (results[0].admin_check == 1) {
            var name = req.body.name;
            var password = req.body.password;
            var Confirmpassword = req.body.Confirmpassword;
            var email = req.body.email;
            var branca = req.body.branca;

            db.query("select user_email from loginuser where user_email = ?", [email], async function (error, results) {
              if (error) {
                console.log(error);
              }
              if (results.length > 0) {
                req.flash('message', ' Questa mail è già stata utilizzata!');
                res.redirect("register");
              }
              else if (password !== Confirmpassword) {
                req.flash('message', ' Le password non corrispondono!');
                res.redirect("register");
              } else {                
                const salt = await bcrypt.genSalt();
                let hashedPassword = await bcrypt.hash(password, salt);
                //console.log(hashedPassword);
                //console.log(salt);
                if (req.body.user_status == "on") { var user_status = true; }
                else { var user_status = false; }
                if (req.body.admin_check == "on") { var admin_check = true; }
                else { var admin_check = false; }

                db.query("insert into loginuser(user_name,user_pass,user_email,user_status,admin_check,branca) values( ?, ? , ?, ?, ?, ?)", [name, hashedPassword, email, user_status,admin_check,branca], async function (error, results) {
                  if (error) {
                    console.log(error);
                  }
                  else {
                    console.log("Ho inserito un nuovo chiamato "+name+" da register_admin");
                    res.redirect('profili');
                  }
                });
              }
            });
          } else {
            req.flash('message', ' solo per capi');
            res.redirect("login");
            console.log(req.session);
          }
        });
      }
    });
  } else {
    req.flash('message', ' sessione scaduta rifai il login');
    res.redirect("login");
  }
})

app.post("/delete", encoder, function (req, res) {
  if (req.session.userinfo) {
    db.query("select user_email,user_name from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
      if (error) {
        console.log(error);
      } else {
        db.query("select (admin_check=1) as admin_check from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
          if (error) {
            console.log(error);
          }
          if (results[0].admin_check == 1) {
            var id = req.body.id;
            db.query("delete from loginuser where (id) = ( ?)", [id], async function (error, results) {
              if (error) {
                console.log(error);
              }
              else {
                console.log("Ho eliminato un profilo con id: "+id);
                res.redirect('profili');
              }
            });
          } else {
            req.flash('message', ' solo per capi');
            res.redirect("login");
            console.log(req.session);
          }
        });
      }
    });
  } else {
    req.flash('message', ' sessione scaduta rifai il login');
    res.redirect("login");
  }
})

app.post("/dati", encoder, function (req, res) {
  if (req.session.userinfo) {
    db.query("select user_email,user_name from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
      if (error) {
        console.log(error);
      } else {
        db.query("select user_email,user_name,telefono,indirizzo,luogo_nascita,data_nascita,fiscale,parrocchia,scuola,casa,(admin_check=1) as admin_check from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
          if (error) {
            console.log(error);
          }
          if (results[0].admin_check == 1) {
              if(results[0].user_email != req.body.email)var email = req.body.email;
              else{var email = results[0].user_email;}  
              if(results[0].user_name != req.body.name)var user_name = req.body.name;
              else{var user_name = results[0].user_name;}  
              if(results[0].telefono != req.body.telefono)var telefono = req.body.telefono;
              else{var telefono = results[0].telefono;}  
              if(results[0].indirizzo != req.body.indirizzo)var indirizzo = req.body.indirizzo;
              else{var indirizzo = results[0].indirizzo;} 
              if(results[0].luogo_nascita != req.body.luogo_nascita)var luogo_nascita = req.body.luogo_nascita;
              else{var luogo_nascita = results[0].luogo_nascita;} 
              if(results[0].data_nascita != req.body.data_nascita)var data_nascita = req.body.data_nascita;
              else{var data_nascita = results[0].data_nascita;} 
              if(results[0].fiscale != req.body.fiscale)var fiscale = req.body.fiscale;
              else{var fiscale = results[0].fiscale;} 
              if(results[0].parrocchia != req.body.parrocchia)var parrocchia = req.body.parrocchia;
              else{var parrocchia = results[0].parrocchia;} 
              if(results[0].scuola != req.body.scuola)var scuola = req.body.scuola;
              else{var scuola = results[0].scuola;} 

              console.log(req.body.casa);
              if (req.body.casa == "on") { var casa = true; }
              else { var casa = false; }
              console.log(casa);

              db.query("update loginuser set user_email=?,user_name=?,telefono=?,indirizzo=?,luogo_nascita=?,data_nascita=?,fiscale=?,parrocchia=?,scuola=?,casa=? where user_email = ?", [email,user_name,telefono,indirizzo,luogo_nascita,data_nascita,fiscale,parrocchia,scuola,casa,results[0].user_email], async function (error, results) {
                if (error) {
                  console.log(error);
                }
                else{
                console.log("ho aggiornato da dati: "+ user_name);
              }
              });

            res.redirect("Iscrizioni");

          } else {
            req.flash('message', ' solo per capi');
            res.redirect("login");
          }
        });
      }
    });
  } else {
    req.flash('message', ' sessione scaduta rifai il login');
    res.redirect("login");
  }
})

app.get('/ghed', function (req, res, next) {
  if (req.session.userinfo) {
    db.query("select user_email,user_name from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
      if (error) {
        console.log(error);
      } else {
        db.query("select (admin_check=1) as admin_check from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
          if (error) {
            console.log(error);
          }
          else if (results[0].admin_check == 1) {
            res.render('ghed');
          } else {
            req.flash('message', ' solo per capi');
            res.redirect("login");
            console.log(req.session);
          }
        });
      }
    });
  } else {
    req.flash('message', ' sessione scaduta rifai il login');
    res.redirect("login");
  }
});


app.get('/createExcel', function (req, res, next) {
  if (req.session.userinfo) {
    db.query("select user_email,user_name from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
      if (error) {
        console.log(error);
      }
      db.query("select (admin_check=1) as admin_check from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
        if (error) {
          console.log(error);
        }
        else if (results[0].admin_check == 1) {
          var workbook = new Excel.Workbook();

          workbook.views = [
            {
              x: 0, y: 0, width: 100, height: 200,
              firstSheet: 0, activeTab: 1, visibility: 'visible'
            }
          ];
          var worksheet = workbook.addWorksheet('My Sheet');
          worksheet.columns = [
            { header: 'Id', key: 'id', width: 5 },
            { header: 'Importo', key: 'importo', width: 10 },
            { header: 'Tipo_di_spesa', key: 'tipo_di_spesa', width: 30 },
            { header: 'Data', key: 'data', width: 15 },
            { header: 'Bancomat_contanti', key: 'bancomat', width: 20 },
          ];


          db.query("SELECT * FROM pagamenti", function (err, pagamenti, fields) {
            if (error) {
              console.log(error);
            }
            const jsonPagamanti = JSON.parse(JSON.stringify(pagamenti));
            console.log(jsonPagamanti);


            worksheet.addRows(jsonPagamanti);


            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader("Content-Disposition", "attachment; filename=" + "pagamenti.xlsx");
            workbook.xlsx.write(res)
              .then(function (data) {
                res.end();
                console.log('File write done........');
              });
          });
        } else {
          req.flash('message', ' solo per capi');
          res.redirect("login");
          console.log(req.session);
        }
      });
    });
  } else {
    req.flash('message', ' sessione scaduta rifai il login');
    res.redirect("login");
  }
});

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function intervalFunc() {
  console.log("è quel momento dell'anno dove si potrebbe rompere tutto");
  const folderName = path.join(__dirname, `/public/uploads/${anno+1}`);
  console.log(folderName);

  if (!fs.existsSync(folderName)) {
    fs.mkdirSync(folderName);
    console.log("è l'anno nuovo e ho fatto");
    const LC = path.join(__dirname, `/public/uploads/${anno+1}/lc`);
    fs.mkdirSync(LC);
    const EG = path.join(__dirname, `/public/uploads/${anno+1}/eg`);
    fs.mkdirSync(EG);
    const NO = path.join(__dirname, `/public/uploads/${anno+1}/no`);
    fs.mkdirSync(NO);
    const RS = path.join(__dirname, `/public/uploads/${anno+1}/rs`);
    fs.mkdirSync(RS);
  }else{
    console.log("non è ancora passato un anno");
  }
}
 
setInterval(intervalFunc, 2147483647);//10 mesi = 26298000000 max = 2147483647

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

server.listen(port, (err) => {
  if (err) {
      return console.error(err);
  }
  return console.log(`app is listening on ${port}`);
});