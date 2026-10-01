/*
===========================================================
 PULSE SOCIAL — COMPLETE SERVER
 Node.js + Express + JSON Storage
===========================================================

FEATURES
- Signup / Login / Logout
- Secure bcrypt passwords
- Session authentication
- User profiles
- Profile pictures
- Cover photos
- Posts
- Post images
- Likes
- Comments
- Follow / Unfollow
- Followers / Following
- Notifications
- Messages
- Message images
- Search
- Verification requests
- Admin dashboard
- Admin verification
- Statistics
- Railway persistent storage

RAILWAY
STORAGE_ROOT=/app/storage

LOCAL
Storage defaults to ./storage
===========================================================
*/

require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

/* =========================================================
   CONFIG
========================================================= */

const app = express();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

const NODE_ENV =
  String(process.env.NODE_ENV || "development").toLowerCase();

const IS_PRODUCTION =
  NODE_ENV === "production";

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "pulse-social-development-secret-change-this";

const ADMIN_USERNAME =
  String(process.env.ADMIN_USERNAME || "")
    .trim()
    .toLowerCase();

const STORAGE_ROOT = path.resolve(
  process.env.STORAGE_ROOT ||
  path.join(__dirname, "storage")
);

const DATA_DIR =
  path.join(STORAGE_ROOT, "data");

const UPLOADS_DIR =
  path.join(STORAGE_ROOT, "uploads");

const PROFILE_UPLOAD_DIR =
  path.join(UPLOADS_DIR, "profiles");

const COVER_UPLOAD_DIR =
  path.join(UPLOADS_DIR, "covers");

const POST_UPLOAD_DIR =
  path.join(UPLOADS_DIR, "posts");

const MESSAGE_UPLOAD_DIR =
  path.join(UPLOADS_DIR, "messages");

const PUBLIC_DIR =
  path.join(__dirname, "public");


/* =========================================================
   DIRECTORIES
========================================================= */

[
  STORAGE_ROOT,
  DATA_DIR,
  UPLOADS_DIR,
  PROFILE_UPLOAD_DIR,
  COVER_UPLOAD_DIR,
  POST_UPLOAD_DIR,
  MESSAGE_UPLOAD_DIR
].forEach(dir => {
  fs.mkdirSync(dir, {
    recursive: true
  });
});


/* =========================================================
   JSON FILES
========================================================= */

const FILES = {
  users:
    path.join(DATA_DIR, "users.json"),

  posts:
    path.join(DATA_DIR, "posts.json"),

  comments:
    path.join(DATA_DIR, "comments.json"),

  likes:
    path.join(DATA_DIR, "likes.json"),

  follows:
    path.join(DATA_DIR, "follows.json"),

  notifications:
    path.join(DATA_DIR, "notifications.json"),

  messages:
    path.join(DATA_DIR, "messages.json"),

  verificationRequests:
    path.join(
      DATA_DIR,
      "verification_requests.json"
    )
};


/* =========================================================
   JSON HELPERS
========================================================= */

function ensureJsonFile(filePath) {

  if (!fs.existsSync(filePath)) {

    fs.writeFileSync(
      filePath,
      "[]",
      "utf8"
    );
  }
}


Object.values(FILES).forEach(
  ensureJsonFile
);


function readJson(filePath) {

  try {

    if (!fs.existsSync(filePath)) {
      return [];
    }

    const raw =
      fs.readFileSync(
        filePath,
        "utf8"
      ).trim();

    if (!raw) {
      return [];
    }

    const data =
      JSON.parse(raw);

    return Array.isArray(data)
      ? data
      : [];

  } catch (error) {

    console.error(
      "JSON READ ERROR:",
      filePath,
      error.message
    );

    return [];
  }
}


function writeJson(
  filePath,
  data
) {

  const tempFile =
    `${filePath}.tmp`;

  fs.writeFileSync(
    tempFile,
    JSON.stringify(
      data,
      null,
      2
    ),
    "utf8"
  );

  fs.renameSync(
    tempFile,
    filePath
  );
}


/* =========================================================
   ID / TIME HELPERS
========================================================= */

function makeId() {

  return (
    Date.now().toString(36) +
    crypto.randomBytes(8)
      .toString("hex")
  );
}


function now() {

  return new Date()
    .toISOString();
}


/* =========================================================
   NORMALIZATION
========================================================= */

function normalizeUsername(value) {

  return String(value || "")
    .trim()
    .toLowerCase();
}


function normalizeEmail(value) {

  return String(value || "")
    .trim()
    .toLowerCase();
}


/* =========================================================
   USER HELPERS
========================================================= */

function getUsers() {
  return readJson(FILES.users);
}


function saveUsers(users) {
  writeJson(
    FILES.users,
    users
  );
}


function findUserById(id) {

  const users =
    getUsers();

  return users.find(
    user =>
      String(user.id) ===
      String(id)
  );
}


function findUserByUsername(username) {

  const target =
    normalizeUsername(username);

  return getUsers().find(
    user =>
      normalizeUsername(
        user.username
      ) === target
  );
}


function findUserByEmail(email) {

  const target =
    normalizeEmail(email);

  return getUsers().find(
    user =>
      normalizeEmail(
        user.email
      ) === target
  );
}


/* =========================================================
   ADMIN
========================================================= */

function isAdminUser(user) {

  if (!user) {
    return false;
  }

  if (
    user.role === "admin" ||
    user.role === "superadmin"
  ) {
    return true;
  }

  if (!ADMIN_USERNAME) {
    return false;
  }

  return (
    normalizeUsername(
      user.username
    ) === ADMIN_USERNAME
  );
}


/* =========================================================
   FOLLOW HELPERS
========================================================= */

function getFollows() {
  return readJson(FILES.follows);
}


function saveFollows(data) {
  writeJson(
    FILES.follows,
    data
  );
}


function isFollowing(
  followerId,
  followingId
) {

  return getFollows().some(
    follow =>
      String(follow.followerId) ===
        String(followerId) &&
      String(follow.followingId) ===
        String(followingId)
  );
}


function followerCount(userId) {

  return getFollows().filter(
    follow =>
      String(follow.followingId) ===
      String(userId)
  ).length;
}


function followingCount(userId) {

  return getFollows().filter(
    follow =>
      String(follow.followerId) ===
      String(userId)
  ).length;
}


/* =========================================================
   POSTS
========================================================= */

function getPosts() {
  return readJson(FILES.posts);
}


function savePosts(posts) {
  writeJson(
    FILES.posts,
    posts
  );
}


/* =========================================================
   COMMENTS
========================================================= */

function getComments() {
  return readJson(FILES.comments);
}


function saveComments(comments) {
  writeJson(
    FILES.comments,
    comments
  );
}


/* =========================================================
   LIKES
========================================================= */

function getLikes() {
  return readJson(FILES.likes);
}


function saveLikes(likes) {
  writeJson(
    FILES.likes,
    likes
  );
}


/* =========================================================
   NOTIFICATIONS
========================================================= */

function getNotifications() {
  return readJson(
    FILES.notifications
  );
}


function saveNotifications(data) {
  writeJson(
    FILES.notifications,
    data
  );
}


function createNotification({
  userId,
  actorId,
  type,
  postId = null,
  message
}) {

  if (
    !userId ||
    !actorId ||
    String(userId) ===
      String(actorId)
  ) {
    return;
  }

  const notifications =
    getNotifications();

  notifications.unshift({
    id: makeId(),
    userId,
    actorId,
    type,
    postId,
    message:
      message || "",
    read: false,
    createdAt: now()
  });

  saveNotifications(
    notifications.slice(
      0,
      5000
    )
  );
}


/* =========================================================
   MESSAGES
========================================================= */

function getMessages() {
  return readJson(
    FILES.messages
  );
}


function saveMessages(messages) {
  writeJson(
    FILES.messages,
    messages
  );
}


/* =========================================================
   VERIFICATION
========================================================= */

function getVerificationRequests() {

  return readJson(
    FILES.verificationRequests
  );
}


function saveVerificationRequests(data) {

  writeJson(
    FILES.verificationRequests,
    data
  );
}


/* =========================================================
   SAFE USER
========================================================= */

function safeUser(
  user,
  viewerId = null
) {

  if (!user) {
    return null;
  }

  const posts =
    getPosts();

  return {

    id:
      user.id,

    name:
      user.name || "",

    username:
      user.username || "",

    email:
      user.email || "",

    bio:
      user.bio || "",

    profilePicture:
      user.profilePicture ||
      user.profileImage ||
      user.avatar ||
      "/images/default-avatar.png",

    profileImage:
      user.profilePicture ||
      user.profileImage ||
      user.avatar ||
      "/images/default-avatar.png",

    avatar:
      user.profilePicture ||
      user.profileImage ||
      user.avatar ||
      "/images/default-avatar.png",

    coverPhoto:
      user.coverPhoto ||
      user.coverImage ||
      user.cover ||
      null,

    coverImage:
      user.coverPhoto ||
      user.coverImage ||
      user.cover ||
      null,

    cover:
      user.coverPhoto ||
      user.coverImage ||
      user.cover ||
      null,

    role:
      user.role || "user",

    verified:
      Boolean(
        user.verified ||
        user.isVerified
      ),

    isVerified:
      Boolean(
        user.verified ||
        user.isVerified
      ),

    verificationStatus:
      user.verificationStatus ||
      "none",

    createdAt:
      user.createdAt || null,

    isAdmin:
      isAdminUser(user),

    followersCount:
      followerCount(user.id),

    followingCount:
      followingCount(user.id),

    postsCount:
      posts.filter(
        post =>
          String(post.userId) ===
          String(user.id)
      ).length,

    isFollowing:
      viewerId
        ? isFollowing(
            viewerId,
            user.id
          )
        : false
  };
}


/* =========================================================
   POST WITH USER DATA
========================================================= */

function safePost(
  post,
  viewerId = null
) {

  const user =
    findUserById(
      post.userId
    );

  const likes =
    getLikes();

  const comments =
    getComments();

  const postLikes =
    likes.filter(
      like =>
        String(like.postId) ===
        String(post.id)
    );

  const postComments =
    comments.filter(
      comment =>
        String(comment.postId) ===
        String(post.id)
    );

  const liked =
    viewerId
      ? postLikes.some(
          like =>
            String(
              like.userId
            ) ===
            String(viewerId)
        )
      : false;

  return {

    ...post,

    user:
      safeUser(
        user,
        viewerId
      ),

    author:
      safeUser(
        user,
        viewerId
      ),

    likesCount:
      postLikes.length,

    likeCount:
      postLikes.length,

    commentsCount:
      postComments.length,

    commentCount:
      postComments.length,

    liked,

    isLiked:
      liked
  };
}


/* =========================================================
   EXPRESS
========================================================= */

app.set(
  "trust proxy",
  1
);

app.use(
  express.json({
    limit: "10mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb"
  })
);


/* =========================================================
   SESSION
========================================================= */

app.use(
  session({

    secret:
      SESSION_SECRET,

    resave:
      false,

    saveUninitialized:
      false,

    rolling:
      true,

    cookie: {

      maxAge:
        7 *
        24 *
        60 *
        60 *
        1000,

      httpOnly:
        true,

      sameSite:
        "lax",

      secure:
        IS_PRODUCTION
    }
  })
);


/* =========================================================
   STATIC FILES
========================================================= */

app.use(
  express.static(
    PUBLIC_DIR
  )
);

app.use(
  "/uploads",
  express.static(
    UPLOADS_DIR
  )
);


/* =========================================================
   MULTER
========================================================= */

const imageStorage =
  multer.diskStorage({

    destination:
      function (
        req,
        file,
        cb
      ) {

        const field =
          file.fieldname;

        if (
          field ===
          "profilePicture"
        ) {

          cb(
            null,
            PROFILE_UPLOAD_DIR
          );

          return;
        }

        if (
          field ===
          "coverPhoto"
        ) {

          cb(
            null,
            COVER_UPLOAD_DIR
          );

          return;
        }

        if (
          field ===
          "image"
        ) {

          cb(
            null,
            POST_UPLOAD_DIR
          );

          return;
        }

        if (
          field ===
          "messageImage"
        ) {

          cb(
            null,
            MESSAGE_UPLOAD_DIR
          );

          return;
        }

        cb(
          new Error(
            "Invalid upload field."
          )
        );
      },

    filename:
      function (
        req,
        file,
        cb
      ) {

        const ext =
          path.extname(
            file.originalname
          ).toLowerCase();

        cb(
          null,
          `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`
        );
      }
  });


const upload =
  multer({

    storage:
      imageStorage,

    limits: {

      fileSize:
        10 *
        1024 *
        1024
    },

    fileFilter:
      function (
        req,
        file,
        cb
      ) {

        const allowed =
          new Set([
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
          ]);

        if (
          !allowed.has(
            file.mimetype
          )
        ) {

          return cb(
            new Error(
              "Only JPG, PNG, WEBP and GIF images are allowed."
            )
          );
        }

        cb(
          null,
          true
        );
      }
  });


/* =========================================================
   AUTH MIDDLEWARE
========================================================= */

function requireAuth(
  req,
  res,
  next
) {

  if (
    !req.session ||
    !req.session.userId
  ) {

    return res.status(401).json({
      error:
        "You must be logged in."
    });
  }

  const user =
    findUserById(
      req.session.userId
    );

  if (!user) {

    req.session.destroy(
      () => {}
    );

    return res.status(401).json({
      error:
        "Your session is no longer valid."
    });
  }

  req.user =
    user;

  next();
}


function requireAdmin(
  req,
  res,
  next
) {

  if (
    !req.user ||
    !isAdminUser(req.user)
  ) {

    return res.status(403).json({
      error:
        "Administrator access required."
    });
  }

  next();
}


/* =========================================================
   HOME
========================================================= */

app.get(
  "/",
  (req, res) => {

    res.sendFile(
      path.join(
        PUBLIC_DIR,
        "index.html"
      )
    );
  }
);


/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/api/health",
  (req, res) => {

    res.json({

      ok:
        true,

      service:
        "Pulse Social",

      version:
        "3.0.0",

      time:
        now(),

      environment:
        NODE_ENV,

      storageRoot:
        STORAGE_ROOT,

      persistentStorage:
        IS_PRODUCTION &&
        STORAGE_ROOT ===
          "/app/storage",

      directories: {

        data:
          DATA_DIR,

        uploads:
          UPLOADS_DIR,

        profiles:
          PROFILE_UPLOAD_DIR,

        covers:
          COVER_UPLOAD_DIR,

        posts:
          POST_UPLOAD_DIR,

        messages:
          MESSAGE_UPLOAD_DIR
      }
    });
  }
);


/* =========================================================
   REGISTER
========================================================= */

async function registerHandler(
  req,
  res
) {

  try {

    const {
      name,
      username,
      email,
      password
    } = req.body;

    const cleanName =
      String(name || "")
        .trim();

    const cleanUsername =
      normalizeUsername(
        username
      );

    const cleanEmail =
      normalizeEmail(
        email
      );

    const cleanPassword =
      String(password || "");

    if (
      !cleanName ||
      !cleanUsername ||
      !cleanEmail ||
      !cleanPassword
    ) {

      return res.status(400).json({
        error:
          "All fields are required."
      });
    }

    if (
      !/^[a-z0-9_]{3,30}$/.test(
        cleanUsername
      )
    ) {

      return res.status(400).json({
        error:
          "Username must contain only letters, numbers and underscores and be 3-30 characters."
      });
    }

    if (
      cleanPassword.length < 6
    ) {

      return res.status(400).json({
        error:
          "Password must be at least 6 characters."
      });
    }

    if (
      findUserByUsername(
        cleanUsername
      )
    ) {

      return res.status(409).json({
        error:
          "Username already exists."
      });
    }

    if (
      findUserByEmail(
        cleanEmail
      )
    ) {

      return res.status(409).json({
        error:
          "Email already exists."
      });
    }

    const users =
      getUsers();

    const passwordHash =
      await bcrypt.hash(
        cleanPassword,
        12
      );

    const user = {

      id:
        makeId(),

      name:
        cleanName,

      username:
        cleanUsername,

      email:
        cleanEmail,

      passwordHash,

      bio:
        "",

      profilePicture:
        "/images/default-avatar.png",

      coverPhoto:
        null,

      role:
        "user",

      verified:
        false,

      isVerified:
        false,

      verificationStatus:
        "none",

      createdAt:
        now()
    };

    users.push(user);

    saveUsers(users);

    req.session.userId =
      user.id;

    res.status(201).json({

      success:
        true,

      message:
        "Account created successfully.",

      user:
        safeUser(
          user,
          user.id
        )
    });

  } catch (error) {

    console.error(
      "REGISTER ERROR:",
      error
    );

    res.status(500).json({
      error:
        "Unable to create account."
    });
  }
}


app.post(
  "/api/register",
  registerHandler
);

app.post(
  "/api/signup",
  registerHandler
);


/* =========================================================
   LOGIN
========================================================= */

app.post(
  "/api/login",
  async (
    req,
    res
  ) => {

    try {

      const {
        login,
        username,
        email,
        password
      } = req.body;

      const identifier =
        normalizeUsername(
          login ||
          username ||
          email
        );

      const cleanPassword =
        String(
          password || ""
        );

      if (
        !identifier ||
        !cleanPassword
      ) {

        return res.status(400).json({
          error:
            "Username/email and password are required."
        });
      }

      const user =
        findUserByUsername(
          identifier
        ) ||
        findUserByEmail(
          identifier
        );

      if (!user) {

        return res.status(401).json({
          error:
            "Invalid username/email or password."
        });
      }

      if (
        !user.passwordHash
      ) {

        return res.status(500).json({
          error:
            "This account does not have a valid password. Please create a new account."
        });
      }

      const passwordMatches =
        await bcrypt.compare(
          cleanPassword,
          user.passwordHash
        );

      if (
        !passwordMatches
      ) {

        return res.status(401).json({
          error:
            "Invalid username/email or password."
        });
      }

      req.session.userId =
        user.id;

      res.json({

        success:
          true,

        user:
          safeUser(
            user,
            user.id
          )
      });

    } catch (error) {

      console.error(
        "LOGIN ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Unable to sign in."
      });
    }
  }
);


/* =========================================================
   LOGOUT
========================================================= */

app.post(
  "/api/logout",
  (
    req,
    res
  ) => {

    req.session.destroy(
      error => {

        if (error) {

          return res.status(500).json({
            error:
              "Unable to log out."
          });
        }

        res.clearCookie(
          "connect.sid"
        );

        res.json({
          success:
            true
        });
      }
    );
  }
);


/* =========================================================
   CURRENT USER
========================================================= */

app.get(
  "/api/me",
  (
    req,
    res
  ) => {

    if (
      !req.session ||
      !req.session.userId
    ) {

      return res.json({
        loggedIn:
          false,
        user:
          null
      });
    }

    const user =
      findUserById(
        req.session.userId
      );

    if (!user) {

      return res.json({
        loggedIn:
          false,
        user:
          null
      });
    }

    res.json({

      loggedIn:
        true,

      user:
        safeUser(
          user,
          user.id
        )
    });
  }
);


/* =========================================================
   GET USER PROFILE
========================================================= */

app.get(
  "/api/users/:username",
  (
    req,
    res
  ) => {

    const user =
      findUserByUsername(
        req.params.username
      );

    if (!user) {

      return res.status(404).json({
        error:
          "User not found."
      });
    }

    const viewerId =
      req.session?.userId ||
      null;

    res.json({
      user:
        safeUser(
          user,
          viewerId
        )
    });
  }
);


/* =========================================================
   UPDATE PROFILE
========================================================= */

app.put(
  "/api/profile",
  requireAuth,
  (
    req,
    res
  ) => {

    const {
      name,
      bio
    } = req.body;

    const users =
      getUsers();

    const index =
      users.findIndex(
        user =>
          String(user.id) ===
          String(req.user.id)
      );

    if (index === -1) {

      return res.status(404).json({
        error:
          "User not found."
      });
    }

    if (
      typeof name ===
      "string"
    ) {

      const cleanName =
        name.trim();

      if (cleanName) {
        users[index].name =
          cleanName;
      }
    }

    if (
      typeof bio ===
      "string"
    ) {

      users[index].bio =
        bio.trim().slice(
          0,
          500
        );
    }

    saveUsers(users);

    const updatedUser =
      users[index];

    req.user =
      updatedUser;

    res.json({

      success:
        true,

      user:
        safeUser(
          updatedUser,
          updatedUser.id
        )
    });
  }
);


/* =========================================================
   PROFILE PICTURE
========================================================= */

const profilePictureUpload =
  upload.single(
    "profilePicture"
  );


app.post(
  "/api/profile/picture",
  requireAuth,
  profilePictureUpload,
  (
    req,
    res
  ) => {

    if (!req.file) {

      return res.status(400).json({
        error:
          "Please select a profile picture."
      });
    }

    const users =
      getUsers();

    const index =
      users.findIndex(
        user =>
          String(user.id) ===
          String(req.user.id)
      );

    if (index === -1) {

      return res.status(404).json({
        error:
          "User not found."
      });
    }

    const oldPicture =
      users[index].profilePicture;

    const relativePath =
      `/uploads/profiles/${req.file.filename}`;

    users[index].profilePicture =
      relativePath;

    users[index].profileImage =
      relativePath;

    users[index].avatar =
      relativePath;

    saveUsers(users);

    deleteLocalUpload(
      oldPicture
    );

    res.json({

      success:
        true,

      profilePicture:
        relativePath,

      profileImage:
        relativePath,

      avatar:
        relativePath,

      user:
        safeUser(
          users[index],
          users[index].id
        )
    });
  }
);


/* =========================================================
   COVER PHOTO
========================================================= */

const coverPhotoUpload =
  upload.single(
    "coverPhoto"
  );


function handleCoverPhotoUpload(
  req,
  res
) {

  if (!req.file) {

    return res.status(400).json({
      error:
        "Please select a cover photo."
    });
  }

  const users =
    getUsers();

  const index =
    users.findIndex(
      user =>
        String(user.id) ===
        String(req.user.id)
    );

  if (index === -1) {

    deleteFile(
      req.file.path
    );

    return res.status(404).json({
      error:
        "User not found."
    });
  }

  const oldCover =
    users[index].coverPhoto ||
    users[index].coverImage ||
    users[index].cover ||
    null;

  const relativePath =
    `/uploads/covers/${req.file.filename}`;

  /*
  IMPORTANT:
  Keep all three aliases so the
  profile frontend can use any
  of them.
  */

  users[index].coverPhoto =
    relativePath;

  users[index].coverImage =
    relativePath;

  users[index].cover =
    relativePath;

  saveUsers(users);

  deleteLocalUpload(
    oldCover
  );

  res.json({

    success:
      true,

    message:
      "Cover photo updated successfully.",

    coverPhoto:
      relativePath,

    coverImage:
      relativePath,

    cover:
      relativePath,

    user:
      safeUser(
        users[index],
        users[index].id
      )
  });
}


/*
Main cover endpoint
*/
app.post(
  "/api/profile/cover",
  requireAuth,
  coverPhotoUpload,
  handleCoverPhotoUpload
);


/*
Alias for compatibility
*/
app.post(
  "/api/profile/cover-photo",
  requireAuth,
  coverPhotoUpload,
  handleCoverPhotoUpload
);


/* =========================================================
   REMOVE COVER PHOTO
========================================================= */

app.delete(
  "/api/profile/cover",
  requireAuth,
  (
    req,
    res
  ) => {

    const users =
      getUsers();

    const index =
      users.findIndex(
        user =>
          String(user.id) ===
          String(req.user.id)
      );

    if (index === -1) {

      return res.status(404).json({
        error:
          "User not found."
      });
    }

    const oldCover =
      users[index].coverPhoto ||
      users[index].coverImage ||
      users[index].cover ||
      null;

    users[index].coverPhoto =
      null;

    users[index].coverImage =
      null;

    users[index].cover =
      null;

    saveUsers(users);

    deleteLocalUpload(
      oldCover
    );

    res.json({

      success:
        true,

      message:
        "Cover photo removed.",

      user:
        safeUser(
          users[index],
          users[index].id
        )
    });
  }
);


/* =========================================================
   POSTS
========================================================= */

const postUpload =
  upload.single(
    "image"
  );


app.post(
  "/api/posts",
  requireAuth,
  postUpload,
  (
    req,
    res
  ) => {

    try {

      const text =
        String(
          req.body.text ||
          req.body.content ||
          ""
        ).trim();

      if (
        !text &&
        !req.file
      ) {

        return res.status(400).json({
          error:
            "Write something or upload an image."
        });
      }

      const posts =
        getPosts();

      let image = null;

      if (req.file) {

        image =
          `/uploads/posts/${req.file.filename}`;
      }

      const post = {

        id:
          makeId(),

        userId:
          req.user.id,

        text,

        content:
          text,

        image,

        imageUrl:
          image,

        createdAt:
          now(),

        updatedAt:
          now()
      };

      posts.unshift(
        post
      );

      savePosts(
        posts.slice(
          0,
          10000
        )
      );

      res.status(201).json({

        success:
          true,

        post:
          safePost(
            post,
            req.user.id
          )
      });

    } catch (error) {

      console.error(
        "CREATE POST ERROR:",
        error
      );

      if (req.file) {
        deleteFile(
          req.file.path
        );
      }

      res.status(500).json({
        error:
          "Unable to create post."
      });
    }
  }
);


/* =========================================================
   FEED
========================================================= */

app.get(
  "/api/feed",
  requireAuth,
  (
    req,
    res
  ) => {

    const posts =
      getPosts()
        .sort(
          (a, b) =>
            new Date(
              b.createdAt
            ) -
            new Date(
              a.createdAt
            )
        )
        .slice(
          0,
          100
        )
        .map(
          post =>
            safePost(
              post,
              req.user.id
            )
        );

    res.json({

      posts,

      feed:
        posts
    });
  }
);


/* =========================================================
   USER POSTS
========================================================= */

app.get(
  "/api/users/:username/posts",
  (
    req,
    res
  ) => {

    const user =
      findUserByUsername(
        req.params.username
      );

    if (!user) {

      return res.status(404).json({
        error:
          "User not found."
      });
    }

    const viewerId =
      req.session?.userId ||
      null;

    const posts =
      getPosts()
        .filter(
          post =>
            String(
              post.userId
            ) ===
            String(
              user.id
            )
        )
        .sort(
          (a, b) =>
            new Date(
              b.createdAt
            ) -
            new Date(
              a.createdAt
            )
        )
        .map(
          post =>
            safePost(
              post,
              viewerId
            )
        );

    res.json({

      posts
    });
  }
);


/* =========================================================
   DELETE POST
========================================================= */

app.delete(
  "/api/posts/:id",
  requireAuth,
  (
    req,
    res
  ) => {

    const posts =
      getPosts();

    const index =
      posts.findIndex(
        post =>
          String(post.id) ===
          String(req.params.id)
      );

    if (index === -1) {

      return res.status(404).json({
        error:
          "Post not found."
      });
    }

    const post =
      posts[index];

    if (
      String(post.userId) !==
        String(req.user.id) &&
      !isAdminUser(req.user)
    ) {

      return res.status(403).json({
        error:
          "You cannot delete this post."
      });
    }

    posts.splice(
      index,
      1
    );

    savePosts(posts);

    deleteLocalUpload(
      post.image
    );

    const comments =
      getComments().filter(
        comment =>
          String(
            comment.postId
          ) !==
          String(post.id)
      );

    saveComments(
      comments
    );

    const likes =
      getLikes().filter(
        like =>
          String(
            like.postId
          ) !==
          String(post.id)
      );

    saveLikes(
      likes
    );

    res.json({
      success:
        true
    });
  }
);


/* =========================================================
   LIKE POST
========================================================= */

app.post(
  "/api/posts/:id/like",
  requireAuth,
  (
    req,
    res
  ) => {

    const posts =
      getPosts();

    const post =
      posts.find(
        item =>
          String(item.id) ===
          String(req.params.id)
      );

    if (!post) {

      return res.status(404).json({
        error:
          "Post not found."
      });
    }

    const likes =
      getLikes();

    const existingIndex =
      likes.findIndex(
        like =>
          String(
            like.postId
          ) ===
            String(
              post.id
            ) &&
          String(
            like.userId
          ) ===
            String(
              req.user.id
            )
      );

    let liked;

    if (
      existingIndex !== -1
    ) {

      likes.splice(
        existingIndex,
        1
      );

      liked = false;

    } else {

      likes.push({

        id:
          makeId(),

        postId:
          post.id,

        userId:
          req.user.id,

        createdAt:
          now()
      });

      liked = true;

      createNotification({

        userId:
          post.userId,

        actorId:
          req.user.id,

        type:
          "like",

        postId:
          post.id,

        message:
          `${req.user.name} liked your post.`
      });
    }

    saveLikes(
      likes
    );

    const count =
      likes.filter(
        like =>
          String(
            like.postId
          ) ===
          String(
            post.id
          )
      ).length;

    res.json({

      success:
        true,

      liked,

      isLiked:
        liked,

      likesCount:
        count,

      likeCount:
        count
    });
  }
);


/* =========================================================
   COMMENTS
========================================================= */

app.get(
  "/api/posts/:id/comments",
  (
    req,
    res
  ) => {

    const comments =
      getComments()
        .filter(
          comment =>
            String(
              comment.postId
            ) ===
            String(
              req.params.id
            )
        )
        .sort(
          (a, b) =>
            new Date(
              a.createdAt
            ) -
            new Date(
              b.createdAt
            )
        )
        .map(
          comment => {

            const user =
              findUserById(
                comment.userId
              );

            return {

              ...comment,

              user:
                safeUser(
                  user,
                  req.session?.userId ||
                  null
                ),

              author:
                safeUser(
                  user,
                  req.session?.userId ||
                  null
                )
            };
          }
        );

    res.json({

      comments
    });
  }
);


app.post(
  "/api/posts/:id/comments",
  requireAuth,
  (
    req,
    res
  ) => {

    const text =
      String(
        req.body.text ||
        req.body.content ||
        ""
      ).trim();

    if (!text) {

      return res.status(400).json({
        error:
          "Comment cannot be empty."
      });
    }

    const post =
      getPosts().find(
        item =>
          String(item.id) ===
          String(req.params.id)
      );

    if (!post) {

      return res.status(404).json({
        error:
          "Post not found."
      });
    }

    const comments =
      getComments();

    const comment = {

      id:
        makeId(),

      postId:
        post.id,

      userId:
        req.user.id,

      text:
        text.slice(
          0,
          2000
        ),

      createdAt:
        now()
    };

    comments.push(
      comment
    );

    saveComments(
      comments
    );

    createNotification({

      userId:
        post.userId,

      actorId:
        req.user.id,

      type:
        "comment",

      postId:
        post.id,

      message:
        `${req.user.name} commented on your post.`
    });

    res.status(201).json({

      success:
        true,

      comment: {

        ...comment,

        user:
          safeUser(
            req.user,
            req.user.id
          ),

        author:
          safeUser(
            req.user,
            req.user.id
          )
      }
    });
  }
);


/* =========================================================
   DELETE COMMENT
========================================================= */

app.delete(
  "/api/comments/:id",
  requireAuth,
  (
    req,
    res
  ) => {

    const comments =
      getComments();

    const index =
      comments.findIndex(
        comment =>
          String(comment.id) ===
          String(req.params.id)
      );

    if (index === -1) {

      return res.status(404).json({
        error:
          "Comment not found."
      });
    }

    const comment =
      comments[index];

    if (
      String(
        comment.userId
      ) !==
        String(
          req.user.id
        ) &&
      !isAdminUser(req.user)
    ) {

      return res.status(403).json({
        error:
          "You cannot delete this comment."
      });
    }

    comments.splice(
      index,
      1
    );

    saveComments(
      comments
    );

    res.json({
      success:
        true
    });
  }
);


/* =========================================================
   FOLLOW / UNFOLLOW
========================================================= */

app.post(
  "/api/users/:id/follow",
  requireAuth,
  (
    req,
    res
  ) => {

    const target =
      findUserById(
        req.params.id
      );

    if (!target) {

      return res.status(404).json({
        error:
          "User not found."
      });
    }

    if (
      String(
        target.id
      ) ===
      String(
        req.user.id
      )
    ) {

      return res.status(400).json({
        error:
          "You cannot follow yourself."
      });
    }

    const follows =
      getFollows();

    const index =
      follows.findIndex(
        follow =>
          String(
            follow.followerId
          ) ===
            String(
              req.user.id
            ) &&
          String(
            follow.followingId
          ) ===
            String(
              target.id
            )
      );

    let following;

    if (
      index !== -1
    ) {

      follows.splice(
        index,
        1
      );

      following =
        false;

    } else {

      follows.push({

        id:
          makeId(),

        followerId:
          req.user.id,

        followingId:
          target.id,

        createdAt:
          now()
      });

      following =
        true;

      createNotification({

        userId:
          target.id,

        actorId:
          req.user.id,

        type:
          "follow",

        message:
          `${req.user.name} followed you.`
      });
    }

    saveFollows(
      follows
    );

    res.json({

      success:
        true,

      following,

      isFollowing:
        following,

      followersCount:
        followerCount(
          target.id
        )
    });
  }
);


/* =========================================================
   FOLLOWERS
========================================================= */

app.get(
  "/api/users/:id/followers",
  (
    req,
    res
  ) => {

    const follows =
      getFollows()
        .filter(
          follow =>
            String(
              follow.followingId
            ) ===
            String(
              req.params.id
            )
        );

    const users =
      follows
        .map(
          follow =>
            findUserById(
              follow.followerId
            )
        )
        .filter(Boolean)
        .map(
          user =>
            safeUser(
              user,
              req.session?.userId ||
              null
            )
        );

    res.json({
      users
    });
  }
);


/* =========================================================
   FOLLOWING
========================================================= */

app.get(
  "/api/users/:id/following",
  (
    req,
    res
  ) => {

    const follows =
      getFollows()
        .filter(
          follow =>
            String(
              follow.followerId
            ) ===
            String(
              req.params.id
            )
        );

    const users =
      follows
        .map(
          follow =>
            findUserById(
              follow.followingId
            )
        )
        .filter(Boolean)
        .map(
          user =>
            safeUser(
              user,
              req.session?.userId ||
              null
            )
        );

    res.json({
      users
    });
  }
);


/* =========================================================
   SEARCH
========================================================= */

app.get(
  "/api/search",
  requireAuth,
  (
    req,
    res
  ) => {

    const query =
      String(
        req.query.q || ""
      )
        .trim()
        .toLowerCase();

    if (!query) {

      return res.json({
        users: []
      });
    }

    const users =
      getUsers()
        .filter(
          user =>
            String(
              user.name || ""
            )
              .toLowerCase()
              .includes(query) ||

            String(
              user.username || ""
            )
              .toLowerCase()
              .includes(query)
        )
        .slice(
          0,
          30
        )
        .map(
          user =>
            safeUser(
              user,
              req.user.id
            )
        );

    res.json({
      users
    });
  }
);


/* =========================================================
   NOTIFICATIONS
========================================================= */

app.get(
  "/api/notifications",
  requireAuth,
  (
    req,
    res
  ) => {

    const notifications =
      getNotifications()
        .filter(
          notification =>
            String(
              notification.userId
            ) ===
            String(
              req.user.id
            )
        )
        .slice(
          0,
          100
        )
        .map(
          notification => {

            const actor =
              findUserById(
                notification.actorId
              );

            return {

              ...notification,

              actor:
                safeUser(
                  actor,
                  req.user.id
                )
            };
          }
        );

    res.json({

      notifications
    });
  }
);


/* =========================================================
   MARK NOTIFICATIONS READ
========================================================= */

app.post(
  "/api/notifications/read",
  requireAuth,
  (
    req,
    res
  ) => {

    const notifications =
      getNotifications();

    notifications.forEach(
      notification => {

        if (
          String(
            notification.userId
          ) ===
          String(
            req.user.id
          )
        ) {

          notification.read =
            true;
        }
      }
    );

    saveNotifications(
      notifications
    );

    res.json({
      success:
        true
    });
  }
);


/* =========================================================
   MESSAGES — CONVERSATIONS
========================================================= */

app.get(
  "/api/messages/conversations",
  requireAuth,
  (
    req,
    res
  ) => {

    const messages =
      getMessages();

    const otherUserIds =
      new Set();

    messages.forEach(
      message => {

        if (
          String(
            message.senderId
          ) ===
          String(
            req.user.id
          )
        ) {

          otherUserIds.add(
            String(
              message.receiverId
            )
          );
        }

        if (
          String(
            message.receiverId
          ) ===
          String(
            req.user.id
          )
        ) {

          otherUserIds.add(
            String(
              message.senderId
            )
          );
        }
      }
    );

    const conversations =
      Array.from(
        otherUserIds
      )
        .map(
          userId => {

            const user =
              findUserById(
                userId
              );

            if (!user) {
              return null;
            }

            const conversation =
              messages
                .filter(
                  message =>
                    (
                      String(
                        message.senderId
                      ) ===
                        String(
                          req.user.id
                        ) &&
                      String(
                        message.receiverId
                      ) ===
                        String(
                          userId
                        )
                    ) ||
                    (
                      String(
                        message.senderId
                      ) ===
                        String(
                          userId
                        ) &&
                      String(
                        message.receiverId
                      ) ===
                        String(
                          req.user.id
                        )
                    )
                )
                .sort(
                  (a, b) =>
                    new Date(
                      b.createdAt
                    ) -
                    new Date(
                      a.createdAt
                    )
                );

            const last =
              conversation[0];

            const unread =
              conversation.filter(
                message =>
                  String(
                    message.receiverId
                  ) ===
                    String(
                      req.user.id
                    ) &&
                  !message.read
              ).length;

            return {

              user:
                safeUser(
                  user,
                  req.user.id
                ),

              lastMessage:
                last || null,

              unread
            };
          }
        )
        .filter(Boolean)
        .sort(
          (a, b) =>
            new Date(
              b.lastMessage?.createdAt ||
              0
            ) -
            new Date(
              a.lastMessage?.createdAt ||
              0
            )
        );

    res.json({
      conversations
    });
  }
);


/* =========================================================
   MESSAGES — GET CHAT
========================================================= */

app.get(
  "/api/messages/:userId",
  requireAuth,
  (
    req,
    res
  ) => {

    const otherUser =
      findUserById(
        req.params.userId
      );

    if (!otherUser) {

      return res.status(404).json({
        error:
          "User not found."
      });
    }

    const messages =
      getMessages()
        .filter(
          message =>
            (
              String(
                message.senderId
              ) ===
                String(
                  req.user.id
                ) &&
              String(
                message.receiverId
              ) ===
                String(
                  otherUser.id
                )
            ) ||
            (
              String(
                message.senderId
              ) ===
                String(
                  otherUser.id
                ) &&
              String(
                message.receiverId
              ) ===
                String(
                  req.user.id
                )
            )
        )
        .sort(
          (a, b) =>
            new Date(
              a.createdAt
            ) -
            new Date(
              b.createdAt
            )
        );

    let allMessages =
      getMessages();

    allMessages =
      allMessages.map(
        message => {

          if (
            String(
              message.senderId
            ) ===
              String(
                otherUser.id
              ) &&
            String(
              message.receiverId
            ) ===
              String(
                req.user.id
              )
          ) {

            message.read =
              true;
          }

          return message;
        }
      );

    saveMessages(
      allMessages
    );

    res.json({

      user:
        safeUser(
          otherUser,
          req.user.id
        ),

      messages
    });
  }
);


/* =========================================================
   SEND MESSAGE
========================================================= */

const messageUpload =
  upload.single(
    "image"
  );


app.post(
  "/api/messages",
  requireAuth,
  messageUpload,
  (
    req,
    res
  ) => {

    const receiverId =
      req.body.receiverId;

    const text =
      String(
        req.body.text || ""
      ).trim();

    if (!receiverId) {

      if (req.file) {
        deleteFile(
          req.file.path
        );
      }

      return res.status(400).json({
        error:
          "Receiver is required."
      });
    }

    const receiver =
      findUserById(
        receiverId
      );

    if (!receiver) {

      if (req.file) {
        deleteFile(
          req.file.path
        );
      }

      return res.status(404).json({
        error:
          "Receiver not found."
      });
    }

    if (
      String(
        receiver.id
      ) ===
      String(
        req.user.id
      )
    ) {

      if (req.file) {
        deleteFile(
          req.file.path
        );
      }

      return res.status(400).json({
        error:
          "You cannot message yourself."
      });
    }

    if (
      !text &&
      !req.file
    ) {

      return res.status(400).json({
        error:
          "Message cannot be empty."
      });
    }

    let image =
      null;

    if (req.file) {

      image =
        `/uploads/messages/${req.file.filename}`;
    }

    const messages =
      getMessages();

    const message = {

      id:
        makeId(),

      senderId:
        req.user.id,

      receiverId:
        receiver.id,

      text,

      image,

      createdAt:
        now(),

      read:
        false
    };

    messages.push(
      message
    );

    saveMessages(
      messages
    );

    createNotification({

      userId:
        receiver.id,

      actorId:
        req.user.id,

      type:
        "message",

      message:
        `${req.user.name} sent you a message.`
    });

    res.status(201).json({

      success:
        true,

      message
    });
  }
);


/* =========================================================
   UNREAD MESSAGES
========================================================= */

app.get(
  "/api/messages/unread-count",
  requireAuth,
  (
    req,
    res
  ) => {

    const count =
      getMessages()
        .filter(
          message =>
            String(
              message.receiverId
            ) ===
            String(
              req.user.id
            ) &&
            !message.read
        )
        .length;

    res.json({
      count
    });
  }
);


/* =========================================================
   STATISTICS
========================================================= */

app.get(
  "/api/stats",
  requireAuth,
  (
    req,
    res
  ) => {

    const posts =
      getPosts();

    const comments =
      getComments();

    const likes =
      getLikes();

    res.json({

      users:
        getUsers().length,

      posts:
        posts.length,

      comments:
        comments.length,

      likes:
        likes.length,

      followers:
        followerCount(
          req.user.id
        ),

      following:
        followingCount(
          req.user.id
        ),

      myPosts:
        posts.filter(
          post =>
            String(
              post.userId
            ) ===
            String(
              req.user.id
            )
        ).length
    });
  }
);


/* =========================================================
   VERIFICATION — CURRENT USER
========================================================= */

app.get(
  "/api/verification/me",
  requireAuth,
  (
    req,
    res
  ) => {

    const requests =
      getVerificationRequests();

    const request =
      requests
        .filter(
          item =>
            String(
              item.userId
            ) ===
            String(
              req.user.id
            )
        )
        .sort(
          (a, b) =>
            new Date(
              b.createdAt
            ) -
            new Date(
              a.createdAt
            )
        )[0] ||
      null;

    res.json({

      verified:
        Boolean(
          req.user.verified
        ),

      status:
        req.user.verificationStatus ||
        "none",

      request
    });
  }
);


/* =========================================================
   VERIFICATION REQUEST
========================================================= */

app.post(
  "/api/verification/request",
  requireAuth,
  (
    req,
    res
  ) => {

    if (
      req.user.verified
    ) {

      return res.status(400).json({
        error:
          "Your account is already verified."
      });
    }

    const requests =
      getVerificationRequests();

    const pending =
      requests.find(
        request =>
          String(
            request.userId
          ) ===
            String(
              req.user.id
            ) &&
          request.status ===
            "pending"
      );

    if (pending) {

      return res.status(400).json({
        error:
          "You already have a pending verification request."
      });
    }

    const request = {

      id:
        makeId(),

      userId:
        req.user.id,

      reason:
        String(
          req.body.reason ||
          ""
        ).trim(),

      status:
        "pending",

      createdAt:
        now(),

      updatedAt:
        now()
    };

    requests.push(
      request
    );

    saveVerificationRequests(
      requests
    );

    const users =
      getUsers();

    const index =
      users.findIndex(
        user =>
          String(user.id) ===
          String(req.user.id)
      );

    if (index !== -1) {

      users[index]
        .verificationStatus =
        "pending";

      saveUsers(
        users
      );
    }

    res.status(201).json({

      success:
        true,

      request
    });
  }
);


/* =========================================================
   ADMIN — CURRENT USER
========================================================= */

app.get(
  "/api/admin/me",
  requireAuth,
  requireAdmin,
  (
    req,
    res
  ) => {

    res.json({

      admin:
        true,

      user:
        safeUser(
          req.user,
          req.user.id
        )
    });
  }
);


/* =========================================================
   ADMIN — STATS
========================================================= */

app.get(
  "/api/admin/stats",
  requireAuth,
  requireAdmin,
  (
    req,
    res
  ) => {

    const users =
      getUsers();

    const posts =
      getPosts();

    const verification =
      getVerificationRequests();

    res.json({

      users:
        users.length,

      posts:
        posts.length,

      comments:
        getComments().length,

      likes:
        getLikes().length,

      follows:
        getFollows().length,

      messages:
        getMessages().length,

      pendingVerification:
        verification.filter(
          item =>
            item.status ===
            "pending"
        ).length
    });
  }
);


/* =========================================================
   ADMIN — USERS
========================================================= */

app.get(
  "/api/admin/users",
  requireAuth,
  requireAdmin,
  (
    req,
    res
  ) => {

    const users =
      getUsers()
        .map(
          user =>
            safeUser(
              user,
              req.user.id
            )
        );

    res.json({
      users
    });
  }
);


/* =========================================================
   ADMIN — VERIFICATION REQUESTS
========================================================= */

app.get(
  "/api/admin/verification/requests",
  requireAuth,
  requireAdmin,
  (
    req,
    res
  ) => {

    const requests =
      getVerificationRequests()
        .sort(
          (a, b) =>
            new Date(
              b.createdAt
            ) -
            new Date(
              a.createdAt
            )
        )
        .map(
          request => {

            const user =
              findUserById(
                request.userId
              );

            return {

              ...request,

              user:
                safeUser(
                  user,
                  req.user.id
                )
            };
          }
        );

    res.json({

      requests
    });
  }
);


/* =========================================================
   ADMIN — APPROVE VERIFICATION
========================================================= */

app.post(
  "/api/admin/verification/:id/approve",
  requireAuth,
  requireAdmin,
  (
    req,
    res
  ) => {

    const requests =
      getVerificationRequests();

    const index =
      requests.findIndex(
        request =>
          String(
            request.id
          ) ===
          String(
            req.params.id
          )
      );

    if (index === -1) {

      return res.status(404).json({
        error:
          "Verification request not found."
      });
    }

    const request =
      requests[index];

    request.status =
      "approved";

    request.updatedAt =
      now();

    saveVerificationRequests(
      requests
    );

    const users =
      getUsers();

    const userIndex =
      users.findIndex(
        user =>
          String(
            user.id
          ) ===
          String(
            request.userId
          )
      );

    if (
      userIndex !== -1
    ) {

      users[userIndex]
        .verified =
        true;

      users[userIndex]
        .isVerified =
        true;

      users[userIndex]
        .verificationStatus =
        "approved";

      saveUsers(
        users
      );
    }

    createNotification({

      userId:
        request.userId,

      actorId:
        req.user.id,

      type:
        "verification",

      message:
        "Your Pulse Social account has been verified."
    });

    res.json({

      success:
        true,

      message:
        "Verification approved."
    });
  }
);


/* =========================================================
   ADMIN — REJECT VERIFICATION
========================================================= */

app.post(
  "/api/admin/verification/:id/reject",
  requireAuth,
  requireAdmin,
  (
    req,
    res
  ) => {

    const requests =
      getVerificationRequests();

    const index =
      requests.findIndex(
        request =>
          String(
            request.id
          ) ===
          String(
            req.params.id
          )
      );

    if (index === -1) {

      return res.status(404).json({
        error:
          "Verification request not found."
      });
    }

    const request =
      requests[index];

    request.status =
      "rejected";

    request.updatedAt =
      now();

    saveVerificationRequests(
      requests
    );

    const users =
      getUsers();

    const userIndex =
      users.findIndex(
        user =>
          String(
            user.id
          ) ===
          String(
            request.userId
          )
      );

    if (
      userIndex !== -1
    ) {

      users[userIndex]
        .verificationStatus =
        "rejected";

      saveUsers(
        users
      );
    }

    createNotification({

      userId:
        request.userId,

      actorId:
        req.user.id,

      type:
        "verification",

      message:
        "Your verification request was rejected."
    });

    res.json({

      success:
        true,

      message:
        "Verification rejected."
    });
  }
);


/* =========================================================
   STORAGE INFO
========================================================= */

app.get(
  "/api/storage-info",
  requireAuth,
  requireAdmin,
  (
    req,
    res
  ) => {

    function sizeOfDirectory(
      directory
    ) {

      if (
        !fs.existsSync(
          directory
        )
      ) {
        return 0;
      }

      let total = 0;

      for (
        const entry of
        fs.readdirSync(
          directory,
          {
            withFileTypes: true
          }
        )
      ) {

        const fullPath =
          path.join(
            directory,
            entry.name
          );

        if (
          entry.isDirectory()
        ) {

          total +=
            sizeOfDirectory(
              fullPath
            );

        } else {

          try {

            total +=
              fs.statSync(
                fullPath
              ).size;

          } catch {}
        }
      }

      return total;
    }


    res.json({

      storageRoot:
        STORAGE_ROOT,

      persistent:
        IS_PRODUCTION &&
        STORAGE_ROOT ===
          "/app/storage",

      dataDirectory:
        DATA_DIR,

      uploadsDirectory:
        UPLOADS_DIR,

      profilesSize:
        sizeOfDirectory(
          PROFILE_UPLOAD_DIR
        ),

      coversSize:
        sizeOfDirectory(
          COVER_UPLOAD_DIR
        ),

      postsSize:
        sizeOfDirectory(
          POST_UPLOAD_DIR
        ),

      messagesSize:
        sizeOfDirectory(
          MESSAGE_UPLOAD_DIR
        )
    });
  }
);


/* =========================================================
   FILE HELPERS
========================================================= */

function deleteFile(
  filePath
) {

  try {

    if (
      filePath &&
      fs.existsSync(
        filePath
      )
    ) {

      fs.unlinkSync(
        filePath
      );
    }

  } catch (error) {

    console.error(
      "FILE DELETE ERROR:",
      error.message
    );
  }
}


function deleteLocalUpload(
  publicPath
) {

  if (
    !publicPath ||
    typeof publicPath !==
      "string"
  ) {
    return;
  }

  if (
    !publicPath.startsWith(
      "/uploads/"
    )
  ) {
    return;
  }

  const relative =
    publicPath.replace(
      /^\/uploads\//,
      ""
    );

  const fullPath =
    path.resolve(
      UPLOADS_DIR,
      relative
    );

  /*
  Prevent deleting files
  outside uploads directory.
  */

  if (
    !fullPath.startsWith(
      path.resolve(
        UPLOADS_DIR
      ) + path.sep
    )
  ) {
    return;
  }

  deleteFile(
    fullPath
  );
}


/* =========================================================
   MULTER ERROR HANDLER
========================================================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    if (
      error instanceof
      multer.MulterError
    ) {

      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {

        return res.status(400).json({
          error:
            "Image is too large. Maximum size is 10MB."
        });
      }

      return res.status(400).json({
        error:
          error.message
      });
    }

    if (
      error &&
      error.message
    ) {

      return res.status(400).json({
        error:
          error.message
      });
    }

    next(error);
  }
);


/* =========================================================
   API 404
========================================================= */

app.use(
  "/api",
  (
    req,
    res
  ) => {

    res.status(404).json({
      error:
        "API endpoint not found."
    });
  }
);


/* =========================================================
   GENERAL ERROR
========================================================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    console.error(
      "SERVER ERROR:",
      error
    );

    if (
      res.headersSent
    ) {
      return next(error);
    }

    res.status(500).json({
      error:
        "Internal server error."
    });
  }
);


/* =========================================================
   START SERVER
========================================================= */

app.listen(
  PORT,
  HOST,
  () => {

    console.log(
      "=========================================="
    );

    console.log(
      "        PULSE SOCIAL SERVER"
    );

    console.log(
      "=========================================="
    );

    console.log(
      `Server: http://${HOST}:${PORT}`
    );

    console.log(
      `Environment: ${NODE_ENV}`
    );

    console.log(
      `Storage: ${STORAGE_ROOT}`
    );

    console.log(
      `Profiles: ${PROFILE_UPLOAD_DIR}`
    );

    console.log(
      `Covers: ${COVER_UPLOAD_DIR}`
    );

    console.log(
      `Posts: ${POST_UPLOAD_DIR}`
    );

    console.log(
      `Messages: ${MESSAGE_UPLOAD_DIR}`
    );

    console.log(
      `Admin username: ${
        ADMIN_USERNAME || "(not set)"
      }`
    );

    console.log(
      "=========================================="
    );
  }
);
