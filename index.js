const express = require("express");
const app = express();
const path = require("path");
const userModel = require("./models/user.models.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const postsModel = require("./models/posts.model.js");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());

app.set("view engine", "ejs");

app.get("/", function (req, res) {
  res.render("index");
});
app.get("/login", function (req, res) {
  res.render("login");
});
// register has been done and the encryption has also done.
app.post("/register", async function (req, res) {
  let { email, username, name, age, password } = req.body;
  let user = await userModel.findOne({ email });
  if (user) {
    return res.status(400).send("User already registered");
  }
  bcrypt.genSalt(10, (err, salt) => {
    if (err) {
      return res.status(500).send("Error generating salt");
    }
    bcrypt.hash(password, salt, async (err, hash) => {
      if (err) {
        return res.status(500).send("Error hashing password");
      }
      let newUser = await userModel.create({
        name,
        username,
        email,
        age,
        password: hash,
      });

      // setting up the token for the user created
      let token = jwt.sign({ email: email, userid: newUser._id }, "shhhh");
      res.cookie("token", token);
      res.redirect("/login");
    });
  });
});

app.post("/login", async function (req, res) {
  let { email, password } = req.body;
  try {
    let user = await userModel.findOne({ email });

    if (!user) {
      return res.status(500).send("Something went wrong");
    }

    bcrypt.compare(password, user.password, function (err, result) {
      if (err) {
        return res.status(500).send("Error during password comparison");
      }

      if (result) {
        let token = jwt.sign({ email: email, userid: user._id }, "shhhh");
        res.cookie("token", token);
        res.redirect("/profile");
      } else {
        return res.redirect("/login");
      }
    });
  } catch (err) {
    return res.status(500).send("Internal server error");
  }
});
app.get("/logout", function (req, res) {
  res.cookie("token", "");
  res.redirect("/login");
});

app.get("/profile", isLoggedIn, async function (req, res) {
  try {
    let user = await userModel.findOne({ email: req.user.email }).populate("posts");
    res.render("profile", { user });
  } catch (err) {
    res.status(500).send("Internal server error");
  }
});
app.post("/post",isLoggedIn, async (req, res)=> {
  let user = await userModel.findOne({ email: req.user.email });
  let { content } = req.body;
  let post = await postsModel.create({
    user: user._id,
    content,
  });
  user.posts.push(post._id);
  await user.save();
  res.redirect("/profile");
});
app.get("/allposts", async function (req, res) {
  try {
    let posts = await postsModel.find().populate("user", "username");
    res.render("posts", { posts });
  } catch (err) {
    res.status(500).send("Internal server error");
  }
});


//Post like functionality.
app.get("/like/:id",isLoggedIn,async function(req,res){
  let post=await postsModel.findOne({_id:req.params.id}).populate("user");
  if(post.likes.indexOf(req.user.userid)=== -1){
    post.likes.push(req.user.userid);
  }
  else{
    post.likes.splice(post.likes.indexOf(req.user.userid),1)
  }
  await post.save();
  res.redirect("/profile");

})
// Update Funtionality
app.get("/edit/:id",isLoggedIn,async function(req,res){
  let post=await postsModel.findOne({_id:req.params.id}).populate("user");
  res.render("edit",{post});
})

app.post("/update/:id",isLoggedIn,async function(req,res){
  let post=await postsModel.findOneAndUpdate({_id:req.params.id},{content:req.body.content});
  res.redirect("/profile");
})
// making the protected route
function isLoggedIn(req, res, next) {
  if (!req.cookies.token) {
    return res.redirect("/login");
  }

  try {

    // new thing which i have learned in this
    let data = jwt.verify(req.cookies.token, "shhhh");
    req.user = data;
    next();
  } catch (err) {
    res.cookie("token", "", { expires: new Date(0) });
    return res.redirect("/login");
  }
}

app.listen(3000);
