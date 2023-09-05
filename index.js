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
  const session = socket.request.session;
  console.log('This user connected:', socket.id);
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
  //console.log(user);
  req.flash('message', user);
  res.render('index', { "message": req.flash('message') });
});

app.get('/login', function (req, res, next) {
  res.render('login', { "message": req.flash('message') });
});

app.get('/register', function (req, res, next) {
  res.render('register', { "message": req.flash('message') });
});

app.get('/chat', function (req, res, next) {
  if (req.session.userinfo) {
    console.log(req.session.userinfo);
    db.query("select user_email,user_name from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
      if (error) {
        console.log(error);
      } else {
        req.flash('message', results[0].user_name);
        res.render('foto', { "message": req.flash('message') });
      }
    });
  } else {
    req.flash('message', ' errore! fai prima il login');
    res.redirect("login");
  }
});

app.get('/Chi-siamo', function (req, res, next) {
  var user = false;
  if (req.session.userinfo) {
    user = true;
  }
  console.log(user);
  req.flash('message', user);
  res.render('Chi_siamo', { "message": req.flash('message') });
});

app.get('/Enciclopedia', function (req, res, next) {
  var user = false;
  if (req.session.userinfo) {
    user = true;
  }
  console.log(user);
  req.flash('message', user);
  res.render('Enciclopedia', { "message": req.flash('message') });
});

app.get('/user', function (req, res, next) {
  if (req.session.userinfo) {
    db.query("select user_email,user_name,branca from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
      if (error) {
        console.log(error);
      } else {
        const username = results[0].user_name;
        const email = results[0].user_email;
        const branca = results[0].branca;
        var Orders = [username, email, branca];
        req.flash('info', username);
        req.flash('info', email);
        req.flash('info', branca);
        console.log(req.flash('info'));
        console.log(req.session);

        db.query("select (admin_check=1) as admin_check from loginuser where user_email = ?", [email], async function (error, results) {
          if (error) {
            console.log(error);
          }
          else if (results[0].admin_check == 1) {
            res.render('user_admin', { Orders: Orders });
            console.log(req.session);
          } else {
            res.render('user', { Orders: Orders });
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

app.get('/foto', function (req, res, next) {
  if (req.session.userinfo) {
    db.query("select user_email,user_name from loginuser where user_email = ?", [req.session.userinfo], async function (error, results) {
      if (error) {
        console.log(error);
      } else {
        res.render('foto');
      }
    });
  } else {
    req.flash('message', ' sessione scaduta rifai il login');
    res.redirect("login");
  }
});

app.get('/login', function (req, res, next) {
  res.render('login', { "message": req.flash('message') });
});

app.get('/register', function (req, res, next) {
  res.render('register', { "message": req.flash('message') });
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
    console.log(results[0].user_status);
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
        req.flash('message', ' Conferma la mail');
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
            var imp = req.body.importo + "€";
            var tipo = req.body.tipo;
            var data = req.body.data;
            var contanti = req.body.contanti;
            var bancomat = req.body.bancomat;
            console.log(imp);
            if (contanti == "on" & bancomat == undefined) {
              db.query("insert into pagamenti (importo,tipo_di_spesa, data,bancomat) values (?,?,?,'contanti')", [imp, tipo, data], async function (error, results) {
                if (error) {
                  console.log(error);
                }
                res.redirect("pagamenti");
              });
            } else if (contanti == undefined & bancomat == "on") {
              db.query("insert into pagamenti (importo,tipo_di_spesa, data,bancomat) values (?,?,?,'bancomat')", [imp, tipo, data], async function (error, results) {
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
              res.render('profili', { jsonPagamanti: jsonPagamanti });

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


app.post("/profili", encoder, function (req, res) {
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
            console.log(req.body);
            console.log(req.body.user_status);
            var id = req.body.id;
            var branca = req.body.branca;
            if(req.body.user_status==1){var user_status = true;}
            else{var user_status = false;}
            if(req.body.admin_check==1){var admin_check = true;}
            else{var admin_check = false;}
            console.log(user_status);
            console.log(admin_check);

              db.query("update loginuser set branca = ? , user_status = ? , admin_check = ? where id = ?", [branca,user_status, admin_check,id], async function (error, results) {
                if (error) {
                  console.log(error);
                }
                else{
                console.log("aggiornato da profili");
              }
              });
              db.query("SELECT * FROM loginuser ORDER BY id", function (error, loginuser, fields) {
                if (error) {
                  console.log(error);
                }
                const jsonPagamanti = JSON.parse(JSON.stringify(loginuser));
                jsonPagamanti.push(req.flash('message'));
                res.render('profili', { jsonPagamanti: jsonPagamanti });
  
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
          res.redirect('user');
          console.log(req.session);
        }

      });
    });
  } else {
    req.flash('message', ' sessione scaduta rifai il login');
    res.redirect("login");
  }

});

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

