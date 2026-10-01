/*
===========================================================
 PULSE SOCIAL
 Production Node.js + Express Server
 JSON Storage + Railway Persistent Volume
===========================================================

RAILWAY VOLUME:
  Mount path:
    /app/storage

RAILWAY VARIABLE:
  STORAGE_ROOT=/app/storage

LOCAL DEVELOPMENT:
  STORAGE_ROOT defaults to ./storage

REQUIRED PACKAGES:
  npm install express express-session bcryptjs dotenv multer

START:
  node server.js
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

const app = express();

/* =========================================================
   CONFIG
========================================================= */

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

const IS_PRODUCTION =
  String(process.env.NODE_ENV || "").toLowerCase() === "production";

const SESSION_SECRET =
  process.env.SESSION_SECRET || "pulse-social-development-secret";

const ADMIN_USERNAME = String(
  process.env.ADMIN_USERNAME || ""
).trim().toLowerCase();

/*
  Railway:
    STORAGE_ROOT=/app/storage

  Local:
    ./storage
*/
const STORAGE_ROOT = path.resolve(
  process.env.STORAGE_ROOT || path.join(__dirname, "storage")
);

const DATA_DIR = path.join(STORAGE_ROOT, "data");
const UPLOADS_DIR = path.join(STORAGE_ROOT, "uploads");

const PROFILE_UPLOAD_DIR = path.join(UPLOADS_DIR, "profiles");
const COVER_UPLOAD_DIR = path.join(UPLOADS_DIR, "covers");
const POST_UPLOAD_DIR = path.join(UPLOADS_DIR, "posts");
const MESSAGE_UPLOAD_DIR = path.join(UPLOADS_DIR, "messages");

const PUBLIC_DIR = path.join(__dirname, "public");

/* =========================================================
   DATA FILES
========================================================= */

const USERS_FILE = path.join(DATA_DIR, "users.json");
const POSTS_FILE = path.join(DATA_DIR, "posts.json");
const COMMENTS_FILE = path.join(DATA_DIR, "comments.json");
const LIKES_FILE = path.join(DATA_DIR, "likes.json");
const FOLLOWS_FILE = path.join(DATA_DIR, "follows.json");
const NOTIFICATIONS_FILE = path.join(DATA_DIR, "notifications.json");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
const VERIFICATION_FILE = path.join(
  DATA_DIR,
  "verification_requests.json"
);

/* =========================================================
   CREATE DIRECTORIES
========================================================= */

[
  STORAGE_ROOT,
  DATA_DIR,
  UPLOADS_DIR,
  PROFILE_UPLOAD_DIR,
  COVER_UPLOAD_DIR,
  POST_UPLOAD_DIR,
  MESSAGE_UPLOAD_DIR,
  PUBLIC_DIR
].forEach((dir) => {
  fs.mkdirSync(dir, { recursive: true });
});

/* =========================================================
   JSON HELPERS
========================================================= */

function ensureJSONFile(file, defaultValue = []) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(
      file,
      JSON.stringify(defaultValue, null, 2),
      "utf8"
    );
  }
}

[
  USERS_FILE,
  POSTS_FILE,
  COMMENTS_FILE,
  LIKES_FILE,
  FOLLOWS_FILE,
  NOTIFICATIONS_FILE,
  MESSAGES_FILE,
  VERIFICATION_FILE
].forEach((file) => ensureJSONFile(file, []));

function readJSON(file, fallback = []) {
  try {
    if (!fs.existsSync(file)) {
      ensureJSONFile(file, fallback);
      return fallback;
    }

    const raw = fs.readFileSync(file, "utf8").trim();

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);

    return parsed;
  } catch (error) {
    console.error("JSON READ ERROR:", file, error.message);
    return fallback;
  }
}

function writeJSON(file, data) {
  const tempFile = `${file}.tmp`;

  try {
    fs.writeFileSync(
      tempFile,
      JSON.stringify(data, null, 2),
      "utf8"
    );

    fs.renameSync(tempFile, file);
  } catch (error) {
    console.error("JSON WRITE ERROR:", file, error.message);

    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch (_) {}

    throw error;
  }
}

/* =========================================================
   UTILITIES
========================================================= */

function generateId() {
  return crypto.randomBytes(12).toString("hex");
}

function now() {
  return new Date().toISOString();
}

function clean(value, maxLength = 5000) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function normalizeUsername(username) {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "");
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function fileExists(file) {
  try {
    return fs.existsSync(file);
  } catch (_) {
    return false;
  }
}

function deleteFileIfExists(file) {
  try {
    if (file && fileExists(file)) {
      fs.unlinkSync(file);
    }
  } catch (error) {
    console.error("FILE DELETE ERROR:", error.message);
  }
}

function publicUploadPath(folder, filename) {
  return `/uploads/${folder}/${filename}`;
}

/* =========================================================
   USER HELPERS
========================================================= */

function getUsers() {
  return readJSON(USERS_FILE, []);
}

function saveUsers(users) {
  writeJSON(USERS_FILE, users);
}

function getPosts() {
  return readJSON(POSTS_FILE, []);
}

function savePosts(posts) {
  writeJSON(POSTS_FILE, posts);
}

function getComments() {
  return readJSON(COMMENTS_FILE, []);
}

function saveComments(comments) {
  writeJSON(COMMENTS_FILE, comments);
}

function getLikes() {
  return readJSON(LIKES_FILE, []);
}

function saveLikes(likes) {
  writeJSON(LIKES_FILE, likes);
}

function getFollows() {
  return readJSON(FOLLOWS_FILE, []);
}

function saveFollows(follows) {
  writeJSON(FOLLOWS_FILE, follows);
}

function getNotifications() {
  return readJSON(NOTIFICATIONS_FILE, []);
}

function saveNotifications(notifications) {
  writeJSON(NOTIFICATIONS_FILE, notifications);
}

function getMessages() {
  return readJSON(MESSAGES_FILE, []);
}

function saveMessages(messages) {
  writeJSON(MESSAGES_FILE, messages);
}

function getVerificationRequests() {
  return readJSON(VERIFICATION_FILE, []);
}

function saveVerificationRequests(requests) {
  writeJSON(VERIFICATION_FILE, requests);
}

function getUserById(id) {
  const users = getUsers();

  return users.find(
    (user) => String(user.id) === String(id)
  );
}

function getUserByUsername(username) {
  const target = normalizeUsername(username);

  const users = getUsers();

  return users.find(
    (user) =>
      normalizeUsername(user.username) === target
  );
}

function getUserByEmail(email) {
  const target = normalizeEmail(email);

  const users = getUsers();

  return users.find(
    (user) =>
      normalizeEmail(user.email) === target
  );
}

function getPostById(id) {
  const posts = getPosts();

  return posts.find(
    (post) => String(post.id) === String(id)
  );
}

function getCurrentUser(req) {
  if (!req.session || !req.session.userId) {
    return null;
  }

  return getUserById(req.session.userId);
}

/* =========================================================
   ADMIN
========================================================= */

function isAdminUser(user) {
  if (!user) return false;

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
    normalizeUsername(user.username) ===
    ADMIN_USERNAME
  );
}

/* =========================================================
   SAFE USER
========================================================= */

function safeUser(user, currentUserId = null) {
  if (!user) return null;

  const follows = getFollows();

  const followersCount = follows.filter(
    (follow) =>
      String(follow.followingId) === String(user.id)
  ).length;

  const followingCount = follows.filter(
    (follow) =>
      String(follow.followerId) === String(user.id)
  ).length;

  const usersPosts = getPosts().filter(
    (post) =>
      String(post.userId) === String(user.id)
  );

  const following =
    currentUserId &&
    follows.some(
      (follow) =>
        String(follow.followerId) ===
          String(currentUserId) &&
        String(follow.followingId) ===
          String(user.id)
    );

  const verified =
    user.verified === true ||
    user.isVerified === true;

  return {
    id: user.id,

    name: user.name || "",

    username: user.username || "",

    email: user.email || "",

    bio: user.bio || "",

    profilePicture:
      user.profilePicture ||
      user.profileImage ||
      user.avatar ||
      "/images/default-avatar.png",

    profileImage:
      user.profileImage ||
      user.profilePicture ||
      user.avatar ||
      "/images/default-avatar.png",

    avatar:
      user.avatar ||
      user.profilePicture ||
      user.profileImage ||
      "/images/default-avatar.png",

    coverPhoto:
      user.coverPhoto ||
      user.coverImage ||
      user.cover ||
      "",

    coverImage:
      user.coverImage ||
      user.coverPhoto ||
      user.cover ||
      "",

    cover:
      user.cover ||
      user.coverPhoto ||
      user.coverImage ||
      "",

    role: user.role || "user",

    verified,

    isVerified: verified,

    verificationStatus:
      user.verificationStatus || "none",

    createdAt: user.createdAt || null,

    isAdmin: isAdminUser(user),

    followersCount,

    followingCount,

    postsCount: usersPosts.length,

    isFollowing: Boolean(following),

    following: Boolean(following)
  };
}

/* =========================================================
   AUTH MIDDLEWARE
========================================================= */

function requireAuth(req, res, next) {
  const user = getCurrentUser(req);

  if (!user) {
    return res.status(401).json({
      success: false,
      error: "You must be logged in."
    });
  }

  req.user = user;

  next();
}

function requireAdmin(req, res, next) {
  const user = getCurrentUser(req);

  if (!user) {
    return res.status(401).json({
      success: false,
      error: "You must be logged in."
    });
  }

  if (!isAdminUser(user)) {
    return res.status(403).json({
      success: false,
      error: "Administrator access required."
    });
  }

  req.user = user;

  next();
}

/* =========================================================
   FOLLOW HELPERS
========================================================= */

function isFollowing(followerId, followingId) {
  const follows = getFollows();

  return follows.some(
    (follow) =>
      String(follow.followerId) ===
        String(followerId) &&
      String(follow.followingId) ===
        String(followingId)
  );
}

function followersCount(userId) {
  return getFollows().filter(
    (follow) =>
      String(follow.followingId) ===
      String(userId)
  ).length;
}

function followingCount(userId) {
  return getFollows().filter(
    (follow) =>
      String(follow.followerId) ===
      String(userId)
  ).length;
}

/* =========================================================
   POST HELPERS
========================================================= */

function postLikeCount(postId) {
  return getLikes().filter(
    (like) =>
      String(like.postId) === String(postId)
  ).length;
}

function postCommentCount(postId) {
  return getComments().filter(
    (comment) =>
      String(comment.postId) === String(postId)
  ).length;
}

function buildPost(post, currentUserId = null) {
  const author = getUserById(post.userId);

  const liked =
    currentUserId &&
    getLikes().some(
      (like) =>
        String(like.postId) === String(post.id) &&
        String(like.userId) === String(currentUserId)
    );

  return {
    ...post,

    user: safeUser(author, currentUserId),

    author: safeUser(author, currentUserId),

    likeCount: postLikeCount(post.id),

    commentCount: postCommentCount(post.id),

    liked: Boolean(liked),

    isLiked: Boolean(liked),

    isOwner:
      currentUserId &&
      String(post.userId) ===
        String(currentUserId)
  };
}

/* =========================================================
   NOTIFICATIONS
========================================================= */

function createNotification({
  userId,
  fromUserId = null,
  type,
  text,
  postId = null,
  messageId = null
}) {
  if (
    !userId ||
    (fromUserId &&
      String(userId) === String(fromUserId))
  ) {
    return null;
  }

  const notifications = getNotifications();

  const notification = {
    id: generateId(),

    userId,

    fromUserId,

    type,

    text: clean(text, 500),

    postId,

    messageId,

    read: false,

    createdAt: now()
  };

  notifications.unshift(notification);

  saveNotifications(notifications);

  return notification;
}

/* =========================================================
   MULTER
========================================================= */

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

function imageFilter(req, file, cb) {
  if (!allowedMimeTypes.has(file.mimetype)) {
    return cb(
      new Error(
        "Only JPG, PNG, WEBP and GIF images are allowed."
      )
    );
  }

  cb(null, true);
}

function createStorage(destination) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, destination);
    },

    filename: (req, file, cb) => {
      const extension =
        path.extname(file.originalname).toLowerCase() ||
        ".jpg";

      cb(
        null,
        `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`
      );
    }
  });
}

const profileUpload = multer({
  storage: createStorage(PROFILE_UPLOAD_DIR),
  fileFilter: imageFilter,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

const coverUpload = multer({
  storage: createStorage(COVER_UPLOAD_DIR),
  fileFilter: imageFilter,
  limits: {
    fileSize: 15 * 1024 * 1024
  }
});

const postUpload = multer({
  storage: createStorage(POST_UPLOAD_DIR),
  fileFilter: imageFilter,
  limits: {
    fileSize: 15 * 1024 * 1024
  }
});

const messageUpload = multer({
  storage: createStorage(MESSAGE_UPLOAD_DIR),
  fileFilter: imageFilter,
  limits: {
    fileSize: 15 * 1024 * 1024
  }
});

/* =========================================================
   EXPRESS
========================================================= */

app.set("trust proxy", 1);

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
    secret: SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    rolling: true,

    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,

      httpOnly: true,

      sameSite: "lax",

      secure: IS_PRODUCTION
    }
  })
);

/* =========================================================
   STATIC FILES
========================================================= */

app.use(
  express.static(PUBLIC_DIR)
);

app.use(
  "/uploads",
  express.static(UPLOADS_DIR)
);

/* =========================================================
   HOME
========================================================= */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(PUBLIC_DIR, "index.html")
  );
});

/* =========================================================
   HEALTH
========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,

    status: "ok",

    app: "Pulse Social",

    version: "2.0.0",

    storageRoot: STORAGE_ROOT,

    persistentStorage:
      String(
        process.env.STORAGE_ROOT || ""
      ).length > 0,

    directories: {
      data: DATA_DIR,
      uploads: UPLOADS_DIR,
      profiles: PROFILE_UPLOAD_DIR,
      covers: COVER_UPLOAD_DIR,
      posts: POST_UPLOAD_DIR,
      messages: MESSAGE_UPLOAD_DIR
    },

    time: now()
  });
});

/* =========================================================
   REGISTER
========================================================= */

async function registerUser(req, res) {
  try {
    const name = clean(req.body.name, 100);

    const username = normalizeUsername(
      req.body.username
    );

    const email = normalizeEmail(
      req.body.email
    );

    const password = String(
      req.body.password || ""
    );

    if (!name) {
      return res.status(400).json({
        success: false,
        error: "Name is required."
      });
    }

    if (!username) {
      return res.status(400).json({
        success: false,
        error: "Username is required."
      });
    }

    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      return res.status(400).json({
        success: false,
        error:
          "Username must be 3-30 characters and use only letters, numbers and underscores."
      });
    }

    if (!email || !email.includes("@")) {
      return res.status(400).json({
        success: false,
        error: "A valid email is required."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error:
          "Password must be at least 6 characters."
      });
    }

    const users = getUsers();

    if (
      users.some(
        (user) =>
          normalizeUsername(user.username) ===
          username
      )
    ) {
      return res.status(409).json({
        success: false,
        error: "Username is already taken."
      });
    }

    if (
      users.some(
        (user) =>
          normalizeEmail(user.email) ===
          email
      )
    ) {
      return res.status(409).json({
        success: false,
        error: "Email is already registered."
      });
    }

    const passwordHash =
      await bcrypt.hash(password, 12);

    const user = {
      id: generateId(),

      name,

      username,

      email,

      passwordHash,

      bio: "",

      profilePicture:
        "/images/default-avatar.png",

      profileImage:
        "/images/default-avatar.png",

      avatar:
        "/images/default-avatar.png",

      coverPhoto: "",

      coverImage: "",

      cover: "",

      role: "user",

      verified: false,

      isVerified: false,

      verificationStatus: "none",

      createdAt: now()
    };

    users.push(user);

    saveUsers(users);

    req.session.userId = user.id;

    return res.status(201).json({
      success: true,

      message: "Account created successfully.",

      user: safeUser(user, user.id)
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to create account."
    });
  }
}

app.post(
  "/api/register",
  registerUser
);

app.post(
  "/api/signup",
  registerUser
);

/* =========================================================
   LOGIN
========================================================= */

app.post("/api/login", async (req, res) => {
  try {
    const login = clean(
      req.body.login ||
        req.body.username ||
        req.body.email,
      200
    );

    const password = String(
      req.body.password || ""
    );

    if (!login || !password) {
      return res.status(400).json({
        success: false,
        error:
          "Username/email and password are required."
      });
    }

    const users = getUsers();

    const normalizedLogin =
      login.toLowerCase();

    const user = users.find((item) => {
      return (
        normalizeUsername(item.username) ===
          normalizeUsername(normalizedLogin) ||
        normalizeEmail(item.email) ===
          normalizeEmail(normalizedLogin)
      );
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid login details."
      });
    }

    /*
      This check prevents:
      bcryptjs Illegal arguments: string, undefined
    */
    if (!user.passwordHash) {
      return res.status(401).json({
        success: false,
        error:
          "This account does not have a valid password. Please reset the password."
      });
    }

    const valid =
      await bcrypt.compare(
        password,
        user.passwordHash
      );

    if (!valid) {
      return res.status(401).json({
        success: false,
        error: "Invalid login details."
      });
    }

    req.session.userId = user.id;

    return res.json({
      success: true,

      message: "Login successful.",

      user: safeUser(user, user.id)
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to sign in."
    });
  }
});

/* =========================================================
   LOGOUT
========================================================= */

app.post("/api/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({
        success: false,
        error: "Unable to log out."
      });
    }

    res.clearCookie("connect.sid");

    return res.json({
      success: true,
      message: "Logged out successfully."
    });
  });
});

/* =========================================================
   CURRENT USER
========================================================= */

app.get("/api/me", (req, res) => {
  const user = getCurrentUser(req);

  if (!user) {
    return res.json({
      success: true,

      loggedIn: false,

      admin: false,

      user: null
    });
  }

  return res.json({
    success: true,

    loggedIn: true,

    admin: isAdminUser(user),

    user: safeUser(user, user.id)
  });
});

/* =========================================================
   GET USER PROFILE
========================================================= */

app.get(
  "/api/users/:username",
  requireAuth,
  (req, res) => {
    const user = getUserByUsername(
      req.params.username
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found."
      });
    }

    return res.json({
      success: true,

      user: safeUser(
        user,
        req.user.id
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
  (req, res) => {
    const users = getUsers();

    const index = users.findIndex(
      (user) =>
        String(user.id) ===
        String(req.user.id)
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: "User not found."
      });
    }

    const current = users[index];

    const name =
      req.body.name !== undefined
        ? clean(req.body.name, 100)
        : current.name;

    const bio =
      req.body.bio !== undefined
        ? clean(req.body.bio, 500)
        : current.bio || "";

    if (!name) {
      return res.status(400).json({
        success: false,
        error: "Name cannot be empty."
      });
    }

    current.name = name;
    current.bio = bio;

    users[index] = current;

    saveUsers(users);

    return res.json({
      success: true,

      message: "Profile updated successfully.",

      user: safeUser(
        current,
        current.id
      )
    });
  }
);

/* =========================================================
   PROFILE PICTURE UPLOAD
========================================================= */

app.post(
  "/api/profile/picture",
  requireAuth,
  profileUpload.single("profilePicture"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Please select an image."
        });
      }

      const users = getUsers();

      const index = users.findIndex(
        (user) =>
          String(user.id) ===
          String(req.user.id)
      );

      if (index === -1) {
        deleteFileIfExists(req.file.path);

        return res.status(404).json({
          success: false,
          error: "User not found."
        });
      }

      const user = users[index];

      const oldPicture =
        user.profilePicture;

      if (
        oldPicture &&
        oldPicture.startsWith(
          "/uploads/profiles/"
        )
      ) {
        const oldFilename =
          path.basename(oldPicture);

        deleteFileIfExists(
          path.join(
            PROFILE_UPLOAD_DIR,
            oldFilename
          )
        );
      }

      const publicPath =
        publicUploadPath(
          "profiles",
          req.file.filename
        );

      user.profilePicture = publicPath;
      user.profileImage = publicPath;
      user.avatar = publicPath;

      users[index] = user;

      saveUsers(users);

      return res.json({
        success: true,

        message:
          "Profile picture updated successfully.",

        profilePicture: publicPath,

        user: safeUser(
          user,
          user.id
        )
      });
    } catch (error) {
      console.error(
        "PROFILE PICTURE ERROR:",
        error
      );

      if (req.file) {
        deleteFileIfExists(req.file.path);
      }

      return res.status(500).json({
        success: false,
        error:
          "Unable to upload profile picture."
      });
    }
  }
);

/* =========================================================
   COVER PHOTO UPLOAD
========================================================= */

function handleCoverUpload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please select a cover photo."
      });
    }

    const users = getUsers();

    const index = users.findIndex(
      (user) =>
        String(user.id) ===
        String(req.user.id)
    );

    if (index === -1) {
      deleteFileIfExists(req.file.path);

      return res.status(404).json({
        success: false,
        error: "User not found."
      });
    }

    const user = users[index];

    const oldCover =
      user.coverPhoto ||
      user.coverImage ||
      user.cover ||
      "";

    if (
      oldCover &&
      oldCover.startsWith(
        "/uploads/covers/"
      )
    ) {
      const oldFilename =
        path.basename(oldCover);

      deleteFileIfExists(
        path.join(
          COVER_UPLOAD_DIR,
          oldFilename
        )
      );
    }

    const publicPath =
      publicUploadPath(
        "covers",
        req.file.filename
      );

    user.coverPhoto = publicPath;
    user.coverImage = publicPath;
    user.cover = publicPath;

    users[index] = user;

    saveUsers(users);

    return res.json({
      success: true,

      message:
        "Cover photo updated successfully.",

      coverPhoto: publicPath,

      coverImage: publicPath,

      cover: publicPath,

      user: safeUser(
        user,
        user.id
      )
    });
  } catch (error) {
    console.error(
      "COVER PHOTO ERROR:",
      error
    );

    if (req.file) {
      deleteFileIfExists(req.file.path);
    }

    return res.status(500).json({
      success: false,
      error:
        "Unable to upload cover photo."
    });
  }
}

app.post(
  "/api/profile/cover",
  requireAuth,
  coverUpload.single("coverPhoto"),
  handleCoverUpload
);

app.post(
  "/api/profile/cover-photo",
  requireAuth,
  coverUpload.single("coverPhoto"),
  handleCoverUpload
);

/* =========================================================
   CREATE POST
========================================================= */

app.post(
  "/api/posts",
  requireAuth,
  postUpload.single("image"),
  (req, res) => {
    try {
      const text = clean(
        req.body.text,
        5000
      );

      if (!text && !req.file) {
        return res.status(400).json({
          success: false,
          error:
            "Write something or add an image."
        });
      }

      const post = {
        id: generateId(),

        userId: req.user.id,

        text,

        image: req.file
          ? publicUploadPath(
              "posts",
              req.file.filename
            )
          : "",

        createdAt: now()
      };

      const posts = getPosts();

      posts.unshift(post);

      savePosts(posts);

      return res.status(201).json({
        success: true,

        message: "Post created successfully.",

        post: buildPost(
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
        deleteFileIfExists(req.file.path);
      }

      return res.status(500).json({
        success: false,
        error: "Unable to create post."
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
  (req, res) => {
    const limit = Math.min(
      Math.max(
        Number(req.query.limit) || 50,
        1
      ),
      100
    );

    const followingOnly =
      String(
        req.query.following || ""
      ).toLowerCase() === "true";

    let posts = getPosts();

    if (followingOnly) {
      const follows = getFollows();

      const followingIds =
        follows
          .filter(
            (follow) =>
              String(
                follow.followerId
              ) ===
              String(req.user.id)
          )
          .map(
            (follow) =>
              String(follow.followingId)
          );

      followingIds.push(
        String(req.user.id)
      );

      posts = posts.filter((post) =>
        followingIds.includes(
          String(post.userId)
        )
      );
    }

    posts.sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    );

    posts = posts
      .slice(0, limit)
      .map((post) =>
        buildPost(
          post,
          req.user.id
        )
      );

    return res.json({
      success: true,

      posts
    });
  }
);

/* =========================================================
   USER POSTS
========================================================= */

app.get(
  "/api/users/:username/posts",
  requireAuth,
  (req, res) => {
    const user =
      getUserByUsername(
        req.params.username
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found."
      });
    }

    const posts = getPosts()
      .filter(
        (post) =>
          String(post.userId) ===
          String(user.id)
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      )
      .map((post) =>
        buildPost(
          post,
          req.user.id
        )
      );

    return res.json({
      success: true,

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
  (req, res) => {
    const posts = getPosts();

    const index = posts.findIndex(
      (post) =>
        String(post.id) ===
        String(req.params.id)
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: "Post not found."
      });
    }

    const post = posts[index];

    if (
      String(post.userId) !==
        String(req.user.id) &&
      !isAdminUser(req.user)
    ) {
      return res.status(403).json({
        success: false,
        error:
          "You cannot delete this post."
      });
    }

    if (
      post.image &&
      post.image.startsWith(
        "/uploads/posts/"
      )
    ) {
      deleteFileIfExists(
        path.join(
          POST_UPLOAD_DIR,
          path.basename(post.image)
        )
      );
    }

    posts.splice(index, 1);

    savePosts(posts);

    const comments =
      getComments().filter(
        (comment) =>
          String(comment.postId) !==
          String(post.id)
      );

    saveComments(comments);

    const likes =
      getLikes().filter(
        (like) =>
          String(like.postId) !==
          String(post.id)
      );

    saveLikes(likes);

    return res.json({
      success: true,

      message: "Post deleted successfully."
    });
  }
);

/* =========================================================
   LIKE / UNLIKE
========================================================= */

app.post(
  "/api/posts/:id/like",
  requireAuth,
  (req, res) => {
    const post =
      getPostById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: "Post not found."
      });
    }

    const likes = getLikes();

    const index = likes.findIndex(
      (like) =>
        String(like.postId) ===
          String(post.id) &&
        String(like.userId) ===
          String(req.user.id)
    );

    let liked;

    if (index !== -1) {
      likes.splice(index, 1);

      liked = false;
    } else {
      likes.push({
        id: generateId(),

        postId: post.id,

        userId: req.user.id,

        createdAt: now()
      });

      liked = true;

      createNotification({
        userId: post.userId,

        fromUserId: req.user.id,

        type: "like",

        text: `${req.user.name} liked your post.`,

        postId: post.id
      });
    }

    saveLikes(likes);

    return res.json({
      success: true,

      liked,

      isLiked: liked,

      likeCount:
        postLikeCount(post.id)
    });
  }
);

/* =========================================================
   COMMENTS
========================================================= */

app.get(
  "/api/posts/:id/comments",
  requireAuth,
  (req, res) => {
    const post =
      getPostById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: "Post not found."
      });
    }

    const comments =
      getComments()
        .filter(
          (comment) =>
            String(comment.postId) ===
            String(post.id)
        )
        .sort(
          (a, b) =>
            new Date(a.createdAt) -
            new Date(b.createdAt)
        )
        .map((comment) => ({
          ...comment,

          user: safeUser(
            getUserById(
              comment.userId
            ),
            req.user.id
          ),

          isOwner:
            String(comment.userId) ===
            String(req.user.id)
        }));

    return res.json({
      success: true,

      comments
    });
  }
);

app.post(
  "/api/posts/:id/comments",
  requireAuth,
  (req, res) => {
    const post =
      getPostById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: "Post not found."
      });
    }

    const text = clean(
      req.body.text ||
        req.body.comment,
      1000
    );

    if (!text) {
      return res.status(400).json({
        success: false,
        error: "Comment cannot be empty."
      });
    }

    const comment = {
      id: generateId(),

      postId: post.id,

      userId: req.user.id,

      text,

      createdAt: now()
    };

    const comments = getComments();

    comments.push(comment);

    saveComments(comments);

    createNotification({
      userId: post.userId,

      fromUserId: req.user.id,

      type: "comment",

      text: `${req.user.name} commented on your post.`,

      postId: post.id
    });

    return res.status(201).json({
      success: true,

      comment: {
        ...comment,

        user: safeUser(
          req.user,
          req.user.id
        ),

        isOwner: true
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
  (req, res) => {
    const comments = getComments();

    const index =
      comments.findIndex(
        (comment) =>
          String(comment.id) ===
          String(req.params.id)
      );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: "Comment not found."
      });
    }

    const comment = comments[index];

    if (
      String(comment.userId) !==
        String(req.user.id) &&
      !isAdminUser(req.user)
    ) {
      return res.status(403).json({
        success: false,
        error:
          "You cannot delete this comment."
      });
    }

    comments.splice(index, 1);

    saveComments(comments);

    return res.json({
      success: true,

      message:
        "Comment deleted successfully."
    });
  }
);

/* =========================================================
   FOLLOW / UNFOLLOW
========================================================= */

app.post(
  "/api/users/:id/follow",
  requireAuth,
  (req, res) => {
    const target =
      getUserById(req.params.id);

    if (!target) {
      return res.status(404).json({
        success: false,
        error: "User not found."
      });
    }

    if (
      String(target.id) ===
      String(req.user.id)
    ) {
      return res.status(400).json({
        success: false,
        error:
          "You cannot follow yourself."
      });
    }

    const follows = getFollows();

    const index =
      follows.findIndex(
        (follow) =>
          String(follow.followerId) ===
            String(req.user.id) &&
          String(follow.followingId) ===
            String(target.id)
      );

    let following;

    if (index !== -1) {
      follows.splice(index, 1);

      following = false;
    } else {
      follows.push({
        id: generateId(),

        followerId: req.user.id,

        followingId: target.id,

        createdAt: now()
      });

      following = true;

      createNotification({
        userId: target.id,

        fromUserId: req.user.id,

        type: "follow",

        text: `${req.user.name} started following you.`
      });
    }

    saveFollows(follows);

    return res.json({
      success: true,

      following,

      isFollowing: following,

      followersCount:
        followersCount(target.id)
    });
  }
);

/* =========================================================
   FOLLOWERS
========================================================= */

app.get(
  "/api/users/:id/followers",
  requireAuth,
  (req, res) => {
    const user =
      getUserById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found."
      });
    }

    const users = getFollows()
      .filter(
        (follow) =>
          String(follow.followingId) ===
          String(user.id)
      )
      .map((follow) =>
        safeUser(
          getUserById(
            follow.followerId
          ),
          req.user.id
        )
      )
      .filter(Boolean);

    return res.json({
      success: true,

      users,

      followers: users
    });
  }
);

/* =========================================================
   FOLLOWING
========================================================= */

app.get(
  "/api/users/:id/following",
  requireAuth,
  (req, res) => {
    const user =
      getUserById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found."
      });
    }

    const users = getFollows()
      .filter(
        (follow) =>
          String(follow.followerId) ===
          String(user.id)
      )
      .map((follow) =>
        safeUser(
          getUserById(
            follow.followingId
          ),
          req.user.id
        )
      )
      .filter(Boolean);

    return res.json({
      success: true,

      users,

      following: users
    });
  }
);

/* =========================================================
   SEARCH
========================================================= */

app.get(
  "/api/search",
  requireAuth,
  (req, res) => {
    const query = clean(
      req.query.q,
      100
    ).toLowerCase();

    if (!query) {
      return res.json({
        success: true,
        users: []
      });
    }

    const users = getUsers()
      .filter((user) => {
        const name =
          String(user.name || "")
            .toLowerCase();

        const username =
          String(user.username || "")
            .toLowerCase();

        return (
          name.includes(query) ||
          username.includes(query)
        );
      })
      .filter(
        (user) =>
          String(user.id) !==
          String(req.user.id)
      )
      .slice(0, 30)
      .map((user) =>
        safeUser(
          user,
          req.user.id
        )
      );

    return res.json({
      success: true,

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
  (req, res) => {
    const notifications =
      getNotifications()
        .filter(
          (notification) =>
            String(notification.userId) ===
            String(req.user.id)
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
        )
        .slice(0, 100)
        .map((notification) => ({
          ...notification,

          user: safeUser(
            getUserById(
              notification.fromUserId
            ),
            req.user.id
          )
        }));

    return res.json({
      success: true,

      notifications,

      unreadCount:
        notifications.filter(
          (notification) =>
            !notification.read
        ).length
    });
  }
);

app.post(
  "/api/notifications/read",
  requireAuth,
  (req, res) => {
    const notifications =
      getNotifications();

    notifications.forEach(
      (notification) => {
        if (
          String(notification.userId) ===
          String(req.user.id)
        ) {
          notification.read = true;
        }
      }
    );

    saveNotifications(notifications);

    return res.json({
      success: true
    });
  }
);

/* =========================================================
   MESSAGES - CONVERSATIONS
========================================================= */

app.get(
  "/api/messages/conversations",
  requireAuth,
  (req, res) => {
    const messages = getMessages();

    const otherIds = new Set();

    messages.forEach((message) => {
      if (
        String(message.senderId) ===
        String(req.user.id)
      ) {
        otherIds.add(
          String(message.receiverId)
        );
      }

      if (
        String(message.receiverId) ===
        String(req.user.id)
      ) {
        otherIds.add(
          String(message.senderId)
        );
      }
    });

    const conversations = [];

    for (const otherId of otherIds) {
      const otherUser =
        getUserById(otherId);

      if (!otherUser) continue;

      const conversationMessages =
        messages
          .filter(
            (message) =>
              (
                String(message.senderId) ===
                  String(req.user.id) &&
                String(message.receiverId) ===
                  String(otherId)
              ) ||
              (
                String(message.senderId) ===
                  String(otherId) &&
                String(message.receiverId) ===
                  String(req.user.id)
              )
          )
          .sort(
            (a, b) =>
              new Date(b.createdAt) -
              new Date(a.createdAt)
          );

      const latest =
        conversationMessages[0];

      const unread =
        conversationMessages.filter(
          (message) =>
            String(message.receiverId) ===
              String(req.user.id) &&
            !message.read
        ).length;

      conversations.push({
        user: safeUser(
          otherUser,
          req.user.id
        ),

        lastMessage: latest
          ? {
              id: latest.id,

              text: latest.text || "",

              image: latest.image || "",

              createdAt:
                latest.createdAt,

              senderId:
                latest.senderId
            }
          : null,

        unreadCount: unread
      });
    }

    conversations.sort((a, b) => {
      const aDate =
        a.lastMessage
          ? new Date(
              a.lastMessage.createdAt
            )
          : 0;

      const bDate =
        b.lastMessage
          ? new Date(
              b.lastMessage.createdAt
            )
          : 0;

      return bDate - aDate;
    });

    return res.json({
      success: true,

      conversations
    });
  }
);

/* =========================================================
   GET MESSAGES WITH USER
========================================================= */

app.get(
  "/api/messages/:userId",
  requireAuth,
  (req, res) => {
    const otherUser =
      getUserById(
        req.params.userId
      );

    if (!otherUser) {
      return res.status(404).json({
        success: false,
        error: "User not found."
      });
    }

    const messages = getMessages();

    const conversation =
      messages
        .filter(
          (message) =>
            (
              String(message.senderId) ===
                String(req.user.id) &&
              String(message.receiverId) ===
                String(otherUser.id)
            ) ||
            (
              String(message.senderId) ===
                String(otherUser.id) &&
              String(message.receiverId) ===
                String(req.user.id)
            )
        )
        .sort(
          (a, b) =>
            new Date(a.createdAt) -
            new Date(b.createdAt)
        );

    let changed = false;

    conversation.forEach((message) => {
      if (
        String(message.receiverId) ===
          String(req.user.id) &&
        !message.read
      ) {
        message.read = true;

        changed = true;
      }
    });

    if (changed) {
      saveMessages(messages);
    }

    const result = conversation.map(
      (message) => ({
        ...message,

        sender: safeUser(
          getUserById(
            message.senderId
          ),
          req.user.id
        ),

        receiver: safeUser(
          getUserById(
            message.receiverId
          ),
          req.user.id
        ),

        isMine:
          String(message.senderId) ===
          String(req.user.id)
      })
    );

    return res.json({
      success: true,

      user: safeUser(
        otherUser,
        req.user.id
      ),

      messages: result
    });
  }
);

/* =========================================================
   SEND MESSAGE
========================================================= */

app.post(
  "/api/messages",
  requireAuth,
  messageUpload.single("image"),
  (req, res) => {
    try {
      const receiverId = clean(
        req.body.receiverId,
        200
      );

      const text = clean(
        req.body.text,
        5000
      );

      if (!receiverId) {
        if (req.file) {
          deleteFileIfExists(
            req.file.path
          );
        }

        return res.status(400).json({
          success: false,
          error: "Receiver is required."
        });
      }

      const receiver =
        getUserById(receiverId);

      if (!receiver) {
        if (req.file) {
          deleteFileIfExists(
            req.file.path
          );
        }

        return res.status(404).json({
          success: false,
          error: "Receiver not found."
        });
      }

      if (
        String(receiver.id) ===
        String(req.user.id)
      ) {
        if (req.file) {
          deleteFileIfExists(
            req.file.path
          );
        }

        return res.status(400).json({
          success: false,
          error:
            "You cannot message yourself."
        });
      }

      if (!text && !req.file) {
        return res.status(400).json({
          success: false,
          error:
            "Message cannot be empty."
        });
      }

      const message = {
        id: generateId(),

        senderId: req.user.id,

        receiverId: receiver.id,

        text,

        image: req.file
          ? publicUploadPath(
              "messages",
              req.file.filename
            )
          : "",

        read: false,

        createdAt: now()
      };

      const messages = getMessages();

      messages.push(message);

      saveMessages(messages);

      createNotification({
        userId: receiver.id,

        fromUserId: req.user.id,

        type: "message",

        text: `${req.user.name} sent you a message.`,

        messageId: message.id
      });

      return res.status(201).json({
        success: true,

        message: {
          ...message,

          sender: safeUser(
            req.user,
            req.user.id
          ),

          receiver: safeUser(
            receiver,
            req.user.id
          ),

          isMine: true
        }
      });
    } catch (error) {
      console.error(
        "SEND MESSAGE ERROR:",
        error
      );

      if (req.file) {
        deleteFileIfExists(
          req.file.path
        );
      }

      return res.status(500).json({
        success: false,
        error:
          "Unable to send message."
      });
    }
  }
);

/* =========================================================
   UNREAD MESSAGE COUNT
========================================================= */

app.get(
  "/api/messages/unread-count",
  requireAuth,
  (req, res) => {
    const count =
      getMessages().filter(
        (message) =>
          String(message.receiverId) ===
            String(req.user.id) &&
          !message.read
      ).length;

    return res.json({
      success: true,

      unreadCount: count,

      count
    });
  }
);

/* =========================================================
   USER STATS
========================================================= */

app.get(
  "/api/stats",
  requireAuth,
  (req, res) => {
    const posts = getPosts().filter(
      (post) =>
        String(post.userId) ===
        String(req.user.id)
    );

    const postIds = new Set(
      posts.map((post) =>
        String(post.id)
      )
    );

    const likesReceived =
      getLikes().filter((like) =>
        postIds.has(
          String(like.postId)
        )
      ).length;

    const commentsReceived =
      getComments().filter((comment) =>
        postIds.has(
          String(comment.postId)
        )
      ).length;

    return res.json({
      success: true,

      stats: {
        posts: posts.length,

        followers:
          followersCount(
            req.user.id
          ),

        following:
          followingCount(
            req.user.id
          ),

        likesReceived,

        commentsReceived
      }
    });
  }
);

/* =========================================================
   VERIFICATION - CURRENT USER
========================================================= */

app.get(
  "/api/verification/me",
  requireAuth,
  (req, res) => {
    const requests =
      getVerificationRequests();

    const request =
      requests
        .filter(
          (item) =>
            String(item.userId) ===
            String(req.user.id)
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
        )[0] || null;

    return res.json({
      success: true,

      verified:
        req.user.verified === true,

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
  (req, res) => {
    const users = getUsers();

    const userIndex =
      users.findIndex(
        (user) =>
          String(user.id) ===
          String(req.user.id)
      );

    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        error: "User not found."
      });
    }

    const user = users[userIndex];

    if (user.verified) {
      return res.status(400).json({
        success: false,
        error:
          "Your account is already verified."
      });
    }

    const requests =
      getVerificationRequests();

    const pending =
      requests.find(
        (item) =>
          String(item.userId) ===
            String(req.user.id) &&
          item.status === "pending"
      );

    if (pending) {
      return res.status(400).json({
        success: false,
        error:
          "You already have a pending verification request."
      });
    }

    const reason = clean(
      req.body.reason,
      2000
    );

    const request = {
      id: generateId(),

      userId: req.user.id,

      reason,

      status: "pending",

      createdAt: now(),

      updatedAt: now()
    };

    requests.push(request);

    saveVerificationRequests(
      requests
    );

    user.verificationStatus =
      "pending";

    users[userIndex] = user;

    saveUsers(users);

    return res.status(201).json({
      success: true,

      message:
        "Verification request submitted.",

      request
    });
  }
);

/* =========================================================
   ADMIN - CURRENT USER
========================================================= */

app.get(
  "/api/admin/me",
  requireAdmin,
  (req, res) => {
    return res.json({
      success: true,

      admin: true,

      user: safeUser(
        req.user,
        req.user.id
      )
    });
  }
);

/* =========================================================
   ADMIN STATS
========================================================= */

app.get(
  "/api/admin/stats",
  requireAdmin,
  (req, res) => {
    const users = getUsers();

    const posts = getPosts();

    const pending =
      getVerificationRequests().filter(
        (request) =>
          request.status === "pending"
      ).length;

    return res.json({
      success: true,

      stats: {
        users: users.length,

        posts: posts.length,

        comments:
          getComments().length,

        likes:
          getLikes().length,

        follows:
          getFollows().length,

        messages:
          getMessages().length,

        pendingVerification:
          pending
      }
    });
  }
);

/* =========================================================
   ADMIN USERS
========================================================= */

app.get(
  "/api/admin/users",
  requireAdmin,
  (req, res) => {
    const users = getUsers()
      .sort(
        (a, b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      )
      .map((user) =>
        safeUser(
          user,
          req.user.id
        )
      );

    return res.json({
      success: true,

      users
    });
  }
);

/* =========================================================
   ADMIN VERIFICATION REQUESTS
========================================================= */

app.get(
  "/api/admin/verification/requests",
  requireAdmin,
  (req, res) => {
    const requests =
      getVerificationRequests()
        .sort(
          (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
        )
        .map((request) => ({
          ...request,

          user: safeUser(
            getUserById(
              request.userId
            ),
            req.user.id
          )
        }));

    return res.json({
      success: true,

      requests
    });
  }
);

/* =========================================================
   ADMIN APPROVE VERIFICATION
========================================================= */

app.post(
  "/api/admin/verification/:requestId/approve",
  requireAdmin,
  (req, res) => {
    const requests =
      getVerificationRequests();

    const index =
      requests.findIndex(
        (request) =>
          String(request.id) ===
          String(req.params.requestId)
      );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error:
          "Verification request not found."
      });
    }

    const request = requests[index];

    const users = getUsers();

    const userIndex =
      users.findIndex(
        (user) =>
          String(user.id) ===
          String(request.userId)
      );

    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        error: "User not found."
      });
    }

    users[userIndex].verified = true;

    users[userIndex].isVerified = true;

    users[userIndex].verificationStatus =
      "approved";

    saveUsers(users);

    request.status = "approved";

    request.updatedAt = now();

    request.reviewedAt = now();

    request.reviewedBy =
      req.user.id;

    requests[index] = request;

    saveVerificationRequests(
      requests
    );

    createNotification({
      userId: request.userId,

      fromUserId: req.user.id,

      type: "verification",

      text:
        "Your verification request was approved."
    });

    return res.json({
      success: true,

      message:
        "Verification request approved."
    });
  }
);

/* =========================================================
   ADMIN REJECT VERIFICATION
========================================================= */

app.post(
  "/api/admin/verification/:requestId/reject",
  requireAdmin,
  (req, res) => {
    const requests =
      getVerificationRequests();

    const index =
      requests.findIndex(
        (request) =>
          String(request.id) ===
          String(req.params.requestId)
      );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error:
          "Verification request not found."
      });
    }

    const request = requests[index];

    const users = getUsers();

    const userIndex =
      users.findIndex(
        (user) =>
          String(user.id) ===
          String(request.userId)
      );

    if (userIndex !== -1) {
      users[userIndex].verified =
        false;

      users[userIndex].isVerified =
        false;

      users[userIndex].verificationStatus =
        "rejected";

      saveUsers(users);
    }

    request.status = "rejected";

    request.updatedAt = now();

    request.reviewedAt = now();

    request.reviewedBy =
      req.user.id;

    request.rejectionReason =
      clean(
        req.body.reason,
        1000
      );

    requests[index] = request;

    saveVerificationRequests(
      requests
    );

    createNotification({
      userId: request.userId,

      fromUserId: req.user.id,

      type: "verification",

      text:
        "Your verification request was rejected."
    });

    return res.json({
      success: true,

      message:
        "Verification request rejected."
    });
  }
);

/* =========================================================
   PROTECTED ADMIN PAGES
========================================================= */

app.get(
  "/admin.html",
  requireAdmin,
  (req, res) => {
    const file =
      path.join(
        PUBLIC_DIR,
        "admin.html"
      );

    if (!fs.existsSync(file)) {
      return res.status(404).send(
        "Admin page not found."
      );
    }

    res.sendFile(file);
  }
);

app.get(
  "/admin-verification.html",
  requireAdmin,
  (req, res) => {
    const file =
      path.join(
        PUBLIC_DIR,
        "admin-verification.html"
      );

    if (!fs.existsSync(file)) {
      return res.status(404).send(
        "Admin verification page not found."
      );
    }

    res.sendFile(file);
  }
);

/* =========================================================
   OPTIONAL DATA INFO
========================================================= */

app.get(
  "/api/storage-info",
  requireAdmin,
  (req, res) => {
    return res.json({
      success: true,

      storageRoot: STORAGE_ROOT,

      dataDirectory: DATA_DIR,

      uploadsDirectory: UPLOADS_DIR,

      persistent:
        Boolean(
          process.env.STORAGE_ROOT
        )
    });
  }
);

/* =========================================================
   API 404
========================================================= */

app.use(
  "/api",
  (req, res) => {
    return res.status(404).json({
      success: false,
      error: "API route not found."
    });
  }
);

/* =========================================================
   MULTER / GENERAL ERROR HANDLER
========================================================= */

app.use(
  (error, req, res, next) => {
    console.error(
      "SERVER ERROR:",
      error
    );

    if (
      error instanceof multer.MulterError
    ) {
      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {
        return res.status(400).json({
          success: false,
          error:
            "The selected image is too large."
        });
      }

      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    if (
      error &&
      error.message &&
      error.message.includes(
        "Only JPG"
      )
    ) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error:
        "An unexpected server error occurred."
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
    console.log("");
    console.log(
      "=========================================="
    );
    console.log(
      "       PULSE SOCIAL SERVER RUNNING"
    );
    console.log(
      "=========================================="
    );
    console.log(
      `URL: http://${HOST}:${PORT}`
    );
    console.log(
      `PORT: ${PORT}`
    );
    console.log(
      `STORAGE_ROOT: ${STORAGE_ROOT}`
    );
    console.log(
      `DATA_DIR: ${DATA_DIR}`
    );
    console.log(
      `UPLOADS_DIR: ${UPLOADS_DIR}`
    );
    console.log(
      `PERSISTENT STORAGE: ${
        process.env.STORAGE_ROOT
          ? "ENABLED"
          : "LOCAL DEFAULT"
      }`
    );
    console.log(
      "=========================================="
    );
    console.log("");
  }
);
