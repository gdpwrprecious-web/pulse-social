/*
===========================================================
 PULSE SOCIAL
 Complete Social Media Server
 Node.js + Express + JSON Storage

 FEATURES
 - Signup / Login / Logout
 - Secure bcrypt passwords
 - Persistent JSON storage
 - Railway Volume support
 - Profiles
 - Profile pictures
 - Cover photos
 - Posts
 - Image posts
 - Video posts
 - TikTok-style For You feed
 - TikTok-style Following feed
 - Likes
 - Comments
 - Follow / unfollow
 - Verified accounts
 - Notifications
 - Messages
 - Search
 - Verification requests
 - Admin dashboard
 - Admin verification
 - Post deletion
 - User deletion
 - Storage information
 - Health endpoint

 LOCAL STORAGE:
 ./storage

 RAILWAY:
 STORAGE_ROOT=/app/storage

 START:
 npm install
 node server.js
===========================================================
*/

"use strict";

/* =========================================================
   IMPORTS
========================================================= */

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

dotenv.config();

/* =========================================================
   APP
========================================================= */

const app = express();

app.set("trust proxy", 1);

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

const IS_PRODUCTION =
  process.env.NODE_ENV === "production";

/* =========================================================
   STORAGE
========================================================= */

const ROOT_DIR = __dirname;

const STORAGE_ROOT = path.resolve(
  process.env.STORAGE_ROOT ||
  path.join(ROOT_DIR, "storage")
);

const DATA_DIR = path.join(
  STORAGE_ROOT,
  "data"
);

const UPLOADS_DIR = path.join(
  STORAGE_ROOT,
  "uploads"
);

const PROFILE_UPLOADS_DIR =
  path.join(UPLOADS_DIR, "profiles");

const COVER_UPLOADS_DIR =
  path.join(UPLOADS_DIR, "covers");

const POST_UPLOADS_DIR =
  path.join(UPLOADS_DIR, "posts");

const VIDEO_UPLOADS_DIR =
  path.join(UPLOADS_DIR, "videos");

const MESSAGE_UPLOADS_DIR =
  path.join(UPLOADS_DIR, "messages");

const SESSION_FILE =
  path.join(
    STORAGE_ROOT,
    "sessions.json"
  );

/* =========================================================
   DATA FILES
========================================================= */

const FILES = {
  users: path.join(DATA_DIR, "users.json"),
  posts: path.join(DATA_DIR, "posts.json"),
  comments: path.join(DATA_DIR, "comments.json"),
  likes: path.join(DATA_DIR, "likes.json"),
  follows: path.join(DATA_DIR, "follows.json"),
  notifications: path.join(
    DATA_DIR,
    "notifications.json"
  ),
  messages: path.join(
    DATA_DIR,
    "messages.json"
  ),
  verificationRequests: path.join(
    DATA_DIR,
    "verification_requests.json"
  )
};

/* =========================================================
   CREATE DIRECTORIES
========================================================= */

function ensureDirectory(directory) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, {
      recursive: true
    });
  }
}

ensureDirectory(STORAGE_ROOT);
ensureDirectory(DATA_DIR);
ensureDirectory(UPLOADS_DIR);
ensureDirectory(PROFILE_UPLOADS_DIR);
ensureDirectory(COVER_UPLOADS_DIR);
ensureDirectory(POST_UPLOADS_DIR);
ensureDirectory(VIDEO_UPLOADS_DIR);
ensureDirectory(MESSAGE_UPLOADS_DIR);

/* =========================================================
   JSON HELPERS
========================================================= */

function ensureJsonFile(file, fallback = []) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(
      file,
      JSON.stringify(
        fallback,
        null,
        2
      ),
      "utf8"
    );
  }
}

Object.values(FILES).forEach(file => {
  ensureJsonFile(file, []);
});

ensureJsonFile(
  SESSION_FILE,
  []
);

/* =========================================================
   DATABASE HELPERS
========================================================= */

function readJson(file, fallback = []) {
  try {
    if (!fs.existsSync(file)) {
      return fallback;
    }

    const raw =
      fs.readFileSync(
        file,
        "utf8"
      );

    if (!raw.trim()) {
      return fallback;
    }

    const parsed =
      JSON.parse(raw);

    return parsed;
  } catch (error) {
    console.error(
      "JSON READ ERROR:",
      file,
      error.message
    );

    return fallback;
  }
}

function writeJson(file, data) {
  const tempFile =
    `${file}.tmp`;

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
    file
  );
}

/* =========================================================
   DATA LOADERS
========================================================= */

function getUsers() {
  return readJson(
    FILES.users,
    []
  );
}

function saveUsers(users) {
  writeJson(
    FILES.users,
    users
  );
}

function getPosts() {
  return readJson(
    FILES.posts,
    []
  );
}

function savePosts(posts) {
  writeJson(
    FILES.posts,
    posts
  );
}

function getComments() {
  return readJson(
    FILES.comments,
    []
  );
}

function saveComments(comments) {
  writeJson(
    FILES.comments,
    comments
  );
}

function getLikes() {
  return readJson(
    FILES.likes,
    []
  );
}

function saveLikes(likes) {
  writeJson(
    FILES.likes,
    likes
  );
}

function getFollows() {
  return readJson(
    FILES.follows,
    []
  );
}

function saveFollows(follows) {
  writeJson(
    FILES.follows,
    follows
  );
}

function getNotifications() {
  return readJson(
    FILES.notifications,
    []
  );
}

function saveNotifications(notifications) {
  writeJson(
    FILES.notifications,
    notifications
  );
}

function getMessages() {
  return readJson(
    FILES.messages,
    []
  );
}

function saveMessages(messages) {
  writeJson(
    FILES.messages,
    messages
  );
}

function getVerificationRequests() {
  return readJson(
    FILES.verificationRequests,
    []
  );
}

function saveVerificationRequests(
  requests
) {
  writeJson(
    FILES.verificationRequests,
    requests
  );
}

/* =========================================================
   GENERAL HELPERS
========================================================= */

function makeId(prefix = "") {
  return (
    prefix +
    crypto.randomBytes(12).toString("hex")
  );
}

function now() {
  return new Date().toISOString();
}

function cleanText(value, max = 5000) {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value)
    .trim()
    .slice(0, max);
}

function normalizeUsername(username) {
  return cleanText(
    username,
    50
  )
    .toLowerCase()
    .replace(/^@/, "");
}

function findUserById(id) {
  if (!id) {
    return null;
  }

  return getUsers().find(
    user =>
      String(user.id) ===
      String(id)
  ) || null;
}

function findUserByUsername(username) {
  const normalized =
    normalizeUsername(username);

  return getUsers().find(
    user =>
      normalizeUsername(
        user.username
      ) === normalized
  ) || null;
}

function findUserByEmail(email) {
  const normalized =
    cleanText(email, 200)
      .toLowerCase();

  return getUsers().find(
    user =>
      String(user.email || "")
        .toLowerCase() ===
      normalized
  ) || null;
}

/* =========================================================
   ADMIN
========================================================= */

function isAdmin(user) {
  if (!user) {
    return false;
  }

  const adminUsername =
    normalizeUsername(
      process.env.ADMIN_USERNAME || ""
    );

  return (
    user.role === "admin" ||
    user.role === "superadmin" ||
    (
      adminUsername &&
      normalizeUsername(
        user.username
      ) === adminUsername
    )
  );
}

/* =========================================================
   FOLLOW HELPERS
========================================================= */

function isFollowing(
  followerId,
  followingId
) {
  if (
    !followerId ||
    !followingId
  ) {
    return false;
  }

  return getFollows().some(
    follow =>
      String(follow.followerId) ===
        String(followerId) &&
      String(follow.followingId) ===
        String(followingId)
  );
}

function getFollowerCount(userId) {
  return getFollows().filter(
    follow =>
      String(follow.followingId) ===
      String(userId)
  ).length;
}

function getFollowingCount(userId) {
  return getFollows().filter(
    follow =>
      String(follow.followerId) ===
      String(userId)
  ).length;
}

/* =========================================================
   POST COUNTS
========================================================= */

function getPostLikes(postId) {
  return getLikes().filter(
    like =>
      String(like.postId) ===
      String(postId)
  );
}

function getPostComments(postId) {
  return getComments().filter(
    comment =>
      String(comment.postId) ===
      String(postId)
  );
}

/* =========================================================
   SAFE USER
========================================================= */

function safeUser(
  user,
  viewer = null
) {
  if (!user) {
    return null;
  }

  const posts =
    getPosts().filter(
      post =>
        String(post.userId) ===
        String(user.id)
    );

  return {
    id: user.id,

    name:
      user.name ||
      user.username ||
      "User",

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

    role:
      user.role || "user",

    verified:
      Boolean(
        user.verified ||
        user.isVerified
      ),

    isVerified:
      Boolean(
        user.isVerified ||
        user.verified
      ),

    verificationStatus:
      user.verificationStatus ||
      "none",

    createdAt:
      user.createdAt || null,

    isAdmin:
      isAdmin(user),

    followersCount:
      getFollowerCount(
        user.id
      ),

    followingCount:
      getFollowingCount(
        user.id
      ),

    postsCount:
      posts.length,

    isFollowing:
      viewer
        ? isFollowing(
            viewer.id,
            user.id
          )
        : false
  };
}

/* =========================================================
   SAFE POST
========================================================= */

function safePost(
  post,
  viewer = null
) {
  const user =
    findUserById(
      post.userId
    );

  const likes =
    getPostLikes(
      post.id
    );

  const comments =
    getPostComments(
      post.id
    );

  const liked =
    viewer
      ? likes.some(
          like =>
            String(
              like.userId
            ) ===
            String(
              viewer.id
            )
        )
      : false;

  return {
    id: post.id,

    userId:
      post.userId,

    user:
      safeUser(
        user,
        viewer
      ),

    text:
      post.text || "",

    caption:
      post.caption ||
      post.text ||
      "",

    image:
      post.image ||
      post.imageUrl ||
      null,

    imageUrl:
      post.imageUrl ||
      post.image ||
      null,

    video:
      post.video ||
      post.videoUrl ||
      null,

    videoUrl:
      post.videoUrl ||
      post.video ||
      null,

    mediaUrl:
      post.mediaUrl ||
      post.image ||
      post.video ||
      null,

    mediaType:
      post.mediaType ||
      (
        post.video ||
        post.videoUrl
          ? "video"
          : "image"
      ),

    sound:
      post.sound ||
      null,

    hashtags:
      Array.isArray(
        post.hashtags
      )
        ? post.hashtags
        : [],

    createdAt:
      post.createdAt ||
      null,

    updatedAt:
      post.updatedAt ||
      null,

    likesCount:
      likes.length,

    likeCount:
      likes.length,

    commentsCount:
      comments.length,

    commentCount:
      comments.length,

    liked,

    isLiked:
      liked
  };
}

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

    req.session.destroy(() => {});

    return res.status(401).json({
      error:
        "Your session is no longer valid."
    });
  }

  req.user = user;

  next();
}

/* =========================================================
   ADMIN MIDDLEWARE
========================================================= */

function requireAdmin(
  req,
  res,
  next
) {
  if (
    !req.user ||
    !isAdmin(req.user)
  ) {
    return res.status(403).json({
      error:
        "Administrator access required."
    });
  }

  next();
}

/* =========================================================
   NOTIFICATIONS
========================================================= */

function createNotification({
  userId,
  fromUserId,
  type,
  postId = null,
  message = ""
}) {

  if (
    !userId ||
    !fromUserId ||
    String(userId) ===
      String(fromUserId)
  ) {
    return;
  }

  const notifications =
    getNotifications();

  notifications.unshift({
    id: makeId("notification_"),

    userId,

    fromUserId,

    type,

    postId,

    message,

    read: false,

    createdAt: now()
  });

  saveNotifications(
    notifications.slice(0, 5000)
  );
}

/* =========================================================
   EXPRESS MIDDLEWARE
========================================================= */

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
   SESSION STORE
========================================================= */

class FileSessionStore
  extends session.Store {

  constructor(file) {
    super();

    this.file = file;

    ensureJsonFile(
      this.file,
      []
    );

    this.sessions =
      readJson(
        this.file,
        []
      );
  }

  saveFile() {
    try {

      writeJson(
        this.file,
        this.sessions
      );

    } catch (error) {

      console.error(
        "SESSION SAVE ERROR:",
        error.message
      );

    }
  }

  get(
    sid,
    callback
  ) {

    const item =
      this.sessions.find(
        session =>
          session.sid === sid
      );

    if (!item) {
      return callback(
        null,
        null
      );
    }

    if (
      item.expiresAt &&
      Date.now() >
        item.expiresAt
    ) {

      this.destroy(
        sid,
        () => {}
      );

      return callback(
        null,
        null
      );
    }

    callback(
      null,
      item.session
    );
  }

  set(
    sid,
    sess,
    callback
  ) {

    const cookie =
      sess.cookie || {};

    let maxAge =
      cookie.maxAge;

    if (
      typeof maxAge !==
      "number"
    ) {
      maxAge =
        7 * 24 * 60 * 60 * 1000;
    }

    const expiresAt =
      Date.now() + maxAge;

    const existing =
      this.sessions.findIndex(
        item =>
          item.sid === sid
      );

    const record = {
      sid,
      session: sess,
      expiresAt
    };

    if (existing >= 0) {
      this.sessions[existing] =
        record;
    } else {
      this.sessions.push(
        record
      );
    }

    this.saveFile();

    if (callback) {
      callback(null);
    }
  }

  destroy(
    sid,
    callback
  ) {

    this.sessions =
      this.sessions.filter(
        item =>
          item.sid !== sid
      );

    this.saveFile();

    if (callback) {
      callback(null);
    }
  }

  touch(
    sid,
    sess,
    callback
  ) {

    const item =
      this.sessions.find(
        record =>
          record.sid === sid
      );

    if (item) {

      item.session = sess;

      const cookie =
        sess.cookie || {};

      const maxAge =
        typeof cookie.maxAge ===
        "number"
          ? cookie.maxAge
          : 7 *
            24 *
            60 *
            60 *
            1000;

      item.expiresAt =
        Date.now() + maxAge;

      this.saveFile();

    }

    if (callback) {
      callback(null);
    }
  }
}

const sessionStore =
  new FileSessionStore(
    SESSION_FILE
  );

/* =========================================================
   SESSION
========================================================= */

app.use(
  session({
    store: sessionStore,

    secret:
      process.env.SESSION_SECRET ||
      "pulse-social-change-this-secret",

    resave: false,

    saveUninitialized: false,

    rolling: true,

    cookie: {
      maxAge:
        7 *
        24 *
        60 *
        60 *
        1000,

      httpOnly: true,

      sameSite: "lax",

      secure:
        IS_PRODUCTION
    }
  })
);

/* =========================================================
   UPLOAD CONFIGURATION
========================================================= */

const imageMimeTypes =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
  ]);

const videoMimeTypes =
  new Set([
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-matroska",
    "video/ogg"
  ]);

const allowedMediaMimeTypes =
  new Set([
    ...imageMimeTypes,
    ...videoMimeTypes
  ]);

const extensionMap = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",

  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "video/x-matroska": ".mkv",
  "video/ogg": ".ogv"
};

const storage = multer.diskStorage({

  destination: function(
    req,
    file,
    cb
  ) {

    const mime =
      file.mimetype;

    if (
      videoMimeTypes.has(
        mime
      )
    ) {

      return cb(
        null,
        VIDEO_UPLOADS_DIR
      );

    }

    if (
      imageMimeTypes.has(
        mime
      )
    ) {

      return cb(
        null,
        POST_UPLOADS_DIR
      );

    }

    cb(
      new Error(
        "Unsupported file type."
      )
    );

  },

  filename: function(
    req,
    file,
    cb
  ) {

    const extension =
      extensionMap[
        file.mimetype
      ] ||
      path.extname(
        file.originalname
      ) ||
      "";

    const filename =
      `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`;

    cb(
      null,
      filename
    );

  }
});

const upload =
  multer({

    storage,

    limits: {
      fileSize:
        20 *
        1024 *
        1024,

      files: 1
    },

    fileFilter:
      function(
        req,
        file,
        cb
      ) {

        if (
          allowedMediaMimeTypes.has(
            file.mimetype
          )
        ) {

          cb(
            null,
            true
          );

        } else {

          cb(
            new Error(
              "Only JPG, PNG, WEBP, GIF, MP4, WEBM, MOV, MKV and OGG files are allowed."
            )
          );

        }

      }

  });

const profileUpload =
  multer({

    dest:
      PROFILE_UPLOADS_DIR,

    limits: {
      fileSize:
        10 *
        1024 *
        1024,

      files: 1
    },

    fileFilter:
      function(
        req,
        file,
        cb
      ) {

        if (
          imageMimeTypes.has(
            file.mimetype
          )
        ) {

          cb(
            null,
            true
          );

        } else {

          cb(
            new Error(
              "Profile picture must be an image."
            )
          );

        }

      }

  });

const coverUpload =
  multer({

    dest:
      COVER_UPLOADS_DIR,

    limits: {
      fileSize:
        10 *
        1024 *
        1024,

      files: 1
    },

    fileFilter:
      function(
        req,
        file,
        cb
      ) {

        if (
          imageMimeTypes.has(
            file.mimetype
          )
        ) {

          cb(
            null,
            true
          );

        } else {

          cb(
            new Error(
              "Cover photo must be an image."
            )
          );

        }

      }

  });

const messageUpload =
  multer({

    dest:
      MESSAGE_UPLOADS_DIR,

    limits: {
      fileSize:
        10 *
        1024 *
        1024,

      files: 1
    },

    fileFilter:
      function(
        req,
        file,
        cb
      ) {

        if (
          imageMimeTypes.has(
            file.mimetype
          )
        ) {

          cb(
            null,
            true
          );

        } else {

          cb(
            new Error(
              "Message attachment must be an image."
            )
          );

        }

      }

  });

/* =========================================================
   STATIC FILES
========================================================= */

app.use(
  express.static(
    path.join(
      ROOT_DIR,
      "public"
    )
  )
);

app.use(
  "/uploads",
  express.static(
    UPLOADS_DIR
  )
);

/* =========================================================
   BASIC ROUTES
========================================================= */

app.get(
  "/",
  function(req, res) {

    res.sendFile(
      path.join(
        ROOT_DIR,
        "public",
        "index.html"
      )
    );

  }
);

app.get(
  "/health",
  function(req, res) {

    res.json({
      ok: true,
      service: "Pulse Social",
      version: "4.0.0",
      time: now()
    });

  }
);

/* =========================================================
   API HEALTH
========================================================= */

app.get(
  "/api/health",
  function(req, res) {

    res.json({

      ok: true,

      service:
        "Pulse Social",

      version:
        "4.0.0",

      storageRoot:
        STORAGE_ROOT,

      persistentStorage:
        Boolean(
          process.env.STORAGE_ROOT
        ),

      features: {
        authentication: true,
        profiles: true,
        coverPhotos: true,
        posts: true,
        imagePosts: true,
        videoPosts: true,
        tiktokFeed: true,
        forYouFeed: true,
        followingFeed: true,
        likes: true,
        comments: true,
        follows: true,
        verifiedUsers: true,
        notifications: true,
        messages: true,
        verification: true,
        admin: true,
        railwayStorage: Boolean(
          process.env.STORAGE_ROOT
        )
      },

      time: now()

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
  function(req, res) {

    res.json({

      storageRoot:
        STORAGE_ROOT,

      dataDirectory:
        DATA_DIR,

      uploadsDirectory:
        UPLOADS_DIR,

      videoDirectory:
        VIDEO_UPLOADS_DIR,

      persistent:
        Boolean(
          process.env.STORAGE_ROOT
        )

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

    const name =
      cleanText(
        req.body.name,
        100
      );

    const username =
      normalizeUsername(
        req.body.username
      );

    const email =
      cleanText(
        req.body.email,
        200
      ).toLowerCase();

    const password =
      String(
        req.body.password ||
        ""
      );

    if (
      !name ||
      !username ||
      !email ||
      !password
    ) {

      return res.status(400).json({
        error:
          "Name, username, email and password are required."
      });

    }

    if (
      !/^[a-zA-Z0-9_.-]{3,50}$/.test(
        username
      )
    ) {

      return res.status(400).json({
        error:
          "Username must be 3-50 characters and may contain letters, numbers, underscores, dots or hyphens."
      });

    }

    if (
      password.length < 6
    ) {

      return res.status(400).json({
        error:
          "Password must be at least 6 characters."
      });

    }

    const users =
      getUsers();

    const usernameExists =
      users.some(
        user =>
          normalizeUsername(
            user.username
          ) === username
      );

    if (usernameExists) {

      return res.status(409).json({
        error:
          "Username is already taken."
      });

    }

    const emailExists =
      users.some(
        user =>
          String(
            user.email || ""
          ).toLowerCase() ===
          email
      );

    if (emailExists) {

      return res.status(409).json({
        error:
          "Email is already registered."
      });

    }

    const passwordHash =
      await bcrypt.hash(
        password,
        12
      );

    const user = {

      id:
        makeId("user_"),

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

      role:
        "user",

      verified: false,

      isVerified: false,

      verificationStatus:
        "none",

      createdAt:
        now()

    };

    users.push(user);

    saveUsers(users);

    req.session.userId =
      user.id;

    req.session.save(
      function() {

        return res.status(201).json({
          success: true,
          user:
            safeUser(
              user,
              user
            )
        });

      }
    );

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
  async function(req, res) {

    try {

      const login =
        cleanText(
          req.body.login ||
          req.body.username ||
          req.body.email,
          200
        );

      const password =
        String(
          req.body.password ||
          ""
        );

      if (
        !login ||
        !password
      ) {

        return res.status(400).json({
          error:
            "Username/email and password are required."
        });

      }

      const users =
        getUsers();

      const normalizedLogin =
        login.toLowerCase();

      const user =
        users.find(
          candidate =>
            String(
              candidate.username ||
              ""
            ).toLowerCase() ===
              normalizedLogin ||

            String(
              candidate.email ||
              ""
            ).toLowerCase() ===
              normalizedLogin
        );

      if (!user) {

        return res.status(401).json({
          error:
            "Invalid username/email or password."
        });

      }

      /*
        IMPORTANT:
        Prevents bcryptjs:
        "Illegal arguments: string, undefined"
      */

      if (
        typeof user.passwordHash !==
        "string" ||
        !user.passwordHash
      ) {

        return res.status(401).json({
          error:
            "This account does not have a valid password. Please create a new account or reset the password."
        });

      }

      const valid =
        await bcrypt.compare(
          password,
          user.passwordHash
        );

      if (!valid) {

        return res.status(401).json({
          error:
            "Invalid username/email or password."
        });

      }

      req.session.userId =
        user.id;

      req.session.save(
        function(error) {

          if (error) {

            console.error(
              "SESSION SAVE ERROR:",
              error
            );

            return res.status(500).json({
              error:
                "Unable to create login session."
            });

          }

          return res.json({
            success: true,

            user:
              safeUser(
                user,
                user
              )
          });

        }
      );

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
  function(req, res) {

    if (!req.session) {
      return res.json({
        success: true
      });
    }

    req.session.destroy(
      function(error) {

        if (error) {

          console.error(
            "LOGOUT ERROR:",
            error
          );

          return res.status(500).json({
            error:
              "Unable to log out."
          });

        }

        res.clearCookie(
          "connect.sid"
        );

        res.json({
          success: true
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
  function(req, res) {

    if (
      !req.session ||
      !req.session.userId
    ) {

      return res.json({
        loggedIn: false,
        user: null
      });

    }

    const user =
      findUserById(
        req.session.userId
      );

    if (!user) {

      return res.json({
        loggedIn: false,
        user: null
      });

    }

    res.json({
      loggedIn: true,

      user:
        safeUser(
          user,
          user
        )
    });

  }
);

/* =========================================================
   GET USER PROFILE
========================================================= */

app.get(
  "/api/users/:username",
  function(req, res) {

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

    const viewer =
      req.session &&
      req.session.userId
        ? findUserById(
            req.session.userId
          )
        : null;

    res.json({
      user:
        safeUser(
          user,
          viewer
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
  function(req, res) {

    const users =
      getUsers();

    const index =
      users.findIndex(
        user =>
          String(user.id) ===
          String(req.user.id)
      );

    if (index < 0) {

      return res.status(404).json({
        error:
          "User not found."
      });

    }

    const name =
      cleanText(
        req.body.name,
        100
      );

    const bio =
      cleanText(
        req.body.bio,
        500
      );

    if (name) {
      users[index].name =
        name;
    }

    users[index].bio =
      bio;

    saveUsers(users);

    req.user =
      users[index];

    res.json({
      success: true,

      user:
        safeUser(
          users[index],
          users[index]
        )
    });

  }
);

/* =========================================================
   PROFILE PICTURE
========================================================= */

app.post(
  "/api/profile/picture",
  requireAuth,
  profileUpload.single(
    "profilePicture"
  ),
  function(req, res) {

    try {

      if (!req.file) {

        return res.status(400).json({
          error:
            "Profile picture is required."
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

      if (index < 0) {

        return res.status(404).json({
          error:
            "User not found."
        });

      }

      const extension =
        extensionMap[
          req.file.mimetype
        ] || ".jpg";

      const filename =
        `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`;

      const finalPath =
        path.join(
          PROFILE_UPLOADS_DIR,
          filename
        );

      fs.renameSync(
        req.file.path,
        finalPath
      );

      const relativePath =
        `/uploads/profiles/${filename}`;

      const oldImage =
        users[index].profilePicture;

      users[index].profilePicture =
        relativePath;

      users[index].profileImage =
        relativePath;

      users[index].avatar =
        relativePath;

      saveUsers(users);

      deleteUploadFile(
        oldImage
      );

      res.json({
        success: true,

        profilePicture:
          relativePath,

        profileImage:
          relativePath,

        avatar:
          relativePath,

        user:
          safeUser(
            users[index],
            users[index]
          )
      });

    } catch (error) {

      console.error(
        "PROFILE PICTURE ERROR:",
        error
      );

      if (req.file) {
        safeDelete(
          req.file.path
        );
      }

      res.status(500).json({
        error:
          "Unable to upload profile picture."
      });

    }

  }
);

/* =========================================================
   COVER PHOTO
========================================================= */

function coverUploadHandler(
  req,
  res
) {

  try {

    if (!req.file) {

      return res.status(400).json({
        error:
          "Cover photo is required."
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

    if (index < 0) {

      safeDelete(
        req.file.path
      );

      return res.status(404).json({
        error:
          "User not found."
      });

    }

    const extension =
      extensionMap[
        req.file.mimetype
      ] || ".jpg";

    const filename =
      `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`;

    const finalPath =
      path.join(
        COVER_UPLOADS_DIR,
        filename
      );

    fs.renameSync(
      req.file.path,
      finalPath
    );

    const relativePath =
      `/uploads/covers/${filename}`;

    const oldCover =
      users[index].coverPhoto ||
      users[index].coverImage ||
      users[index].cover;

    users[index].coverPhoto =
      relativePath;

    users[index].coverImage =
      relativePath;

    users[index].cover =
      relativePath;

    saveUsers(users);

    deleteUploadFile(
      oldCover
    );

    res.json({
      success: true,

      coverPhoto:
        relativePath,

      coverImage:
        relativePath,

      cover:
        relativePath,

      user:
        safeUser(
          users[index],
          users[index]
        )
    });

  } catch (error) {

    console.error(
      "COVER ERROR:",
      error
    );

    if (req.file) {
      safeDelete(
        req.file.path
      );
    }

    res.status(500).json({
      error:
        "Unable to upload cover photo."
    });

  }

}

app.post(
  "/api/profile/cover",
  requireAuth,
  coverUpload.single(
    "coverPhoto"
  ),
  coverUploadHandler
);

app.post(
  "/api/profile/cover-photo",
  requireAuth,
  coverUpload.single(
    "coverPhoto"
  ),
  coverUploadHandler
);

/* =========================================================
   DELETE COVER
========================================================= */

app.delete(
  "/api/profile/cover",
  requireAuth,
  function(req, res) {

    const users =
      getUsers();

    const index =
      users.findIndex(
        user =>
          String(user.id) ===
          String(req.user.id)
      );

    if (index < 0) {

      return res.status(404).json({
        error:
          "User not found."
      });

    }

    const oldCover =
      users[index].coverPhoto ||
      users[index].coverImage ||
      users[index].cover;

    users[index].coverPhoto =
      "";

    users[index].coverImage =
      "";

    users[index].cover =
      "";

    saveUsers(users);

    deleteUploadFile(
      oldCover
    );

    res.json({
      success: true
    });

  }
);

/* =========================================================
   CREATE POST
========================================================= */

app.post(
  "/api/posts",
  requireAuth,
  upload.single("image"),
  function(req, res) {

    try {

      const text =
        cleanText(
          req.body.text ||
          req.body.caption,
          5000
        );

      const hashtags =
        extractHashtags(
          text
        );

      if (
        !text &&
        !req.file
      ) {

        return res.status(400).json({
          error:
            "Post must contain text or media."
        });

      }

      let mediaUrl = null;
      let mediaType = null;

      if (req.file) {

        if (
          videoMimeTypes.has(
            req.file.mimetype
          )
        ) {

          mediaUrl =
            `/uploads/videos/${req.file.filename}`;

          mediaType =
            "video";

        } else {

          mediaUrl =
            `/uploads/posts/${req.file.filename}`;

          mediaType =
            "image";

        }

      }

      const posts =
        getPosts();

      const post = {

        id:
          makeId("post_"),

        userId:
          req.user.id,

        text,

        caption:
          text,

        image:
          mediaType === "image"
            ? mediaUrl
            : null,

        imageUrl:
          mediaType === "image"
            ? mediaUrl
            : null,

        video:
          mediaType === "video"
            ? mediaUrl
            : null,

        videoUrl:
          mediaType === "video"
            ? mediaUrl
            : null,

        mediaUrl,

        mediaType,

        sound:
          cleanText(
            req.body.sound,
            200
          ) || null,

        hashtags,

        createdAt:
          now(),

        updatedAt:
          now()
      };

      posts.unshift(post);

      savePosts(posts);

      res.status(201).json({
        success: true,

        post:
          safePost(
            post,
            req.user
          )
      });

    } catch (error) {

      console.error(
        "CREATE POST ERROR:",
        error
      );

      if (req.file) {
        safeDelete(
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
  function(req, res) {

    try {

      const mode =
        String(
          req.query.mode ||
          req.query.type ||
          "foryou"
        ).toLowerCase();

      const limit =
        Math.min(
          Math.max(
            Number(
              req.query.limit || 100
            ),
            1
          ),
          200
        );

      const posts =
        getPosts();

      let visiblePosts =
        [...posts];

      /*
        FOLLOWING FEED
        Only posts from accounts
        the current user follows.
      */

      if (
        mode === "following" ||
        mode === "follow"
      ) {

        const followingIds =
          new Set(
            getFollows()
              .filter(
                follow =>
                  String(
                    follow.followerId
                  ) ===
                  String(
                    req.user.id
                  )
              )
              .map(
                follow =>
                  String(
                    follow.followingId
                  )
              )
          );

        visiblePosts =
          visiblePosts.filter(
            post =>
              followingIds.has(
                String(
                  post.userId
                )
              )
          );

      }

      /*
        FOR YOU
        Broad feed containing posts
        from all users.

        Newest posts first.
      */

      visiblePosts =
        visiblePosts
          .sort(
            (a, b) =>
              new Date(
                b.createdAt || 0
              ) -
              new Date(
                a.createdAt || 0
              )
          )
          .slice(
            0,
            limit
          );

      res.json({

        mode,

        posts:
          visiblePosts.map(
            post =>
              safePost(
                post,
                req.user
              )
          )

      });

    } catch (error) {

      console.error(
        "FEED ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Unable to load feed."
      });

    }

  }
);

/* =========================================================
   USER POSTS
========================================================= */

app.get(
  "/api/users/:username/posts",
  function(req, res) {

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

    const viewer =
      req.session &&
      req.session.userId
        ? findUserById(
            req.session.userId
          )
        : null;

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
              b.createdAt || 0
            ) -
            new Date(
              a.createdAt || 0
            )
        );

    res.json({
      posts:
        posts.map(
          post =>
            safePost(
              post,
              viewer
            )
        )
    });

  }
);

/* =========================================================
   LIKE POST
========================================================= */

app.post(
  "/api/posts/:id/like",
  requireAuth,
  function(req, res) {

    const postId =
      req.params.id;

    const posts =
      getPosts();

    const post =
      posts.find(
        item =>
          String(item.id) ===
          String(postId)
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
            String(postId) &&
          String(
            like.userId
          ) ===
            String(req.user.id)
      );

    let liked;

    if (
      existingIndex >= 0
    ) {

      likes.splice(
        existingIndex,
        1
      );

      liked = false;

    } else {

      likes.push({
        id:
          makeId("like_"),

        postId,

        userId:
          req.user.id,

        createdAt:
          now()
      });

      liked = true;

      createNotification({
        userId:
          post.userId,

        fromUserId:
          req.user.id,

        type:
          "like",

        postId,

        message:
          `${req.user.username} liked your post.`
      });

    }

    saveLikes(likes);

    const count =
      likes.filter(
        like =>
          String(
            like.postId
          ) ===
          String(postId)
      ).length;

    res.json({
      success: true,

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
   GET COMMENTS
========================================================= */

app.get(
  "/api/posts/:id/comments",
  requireAuth,
  function(req, res) {

    const postId =
      req.params.id;

    const post =
      getPosts().find(
        item =>
          String(item.id) ===
          String(postId)
      );

    if (!post) {

      return res.status(404).json({
        error:
          "Post not found."
      });

    }

    const comments =
      getComments()
        .filter(
          comment =>
            String(
              comment.postId
            ) ===
            String(postId)
        )
        .sort(
          (a, b) =>
            new Date(
              a.createdAt || 0
            ) -
            new Date(
              b.createdAt || 0
            )
        );

    res.json({
      comments:
        comments.map(
          comment => {

            const user =
              findUserById(
                comment.userId
              );

            return {
              id:
                comment.id,

              postId:
                comment.postId,

              userId:
                comment.userId,

              user:
                safeUser(
                  user,
                  req.user
                ),

              text:
                comment.text,

              content:
                comment.text,

              createdAt:
                comment.createdAt
            };

          }
        )
    });

  }
);

/* =========================================================
   ADD COMMENT
========================================================= */

app.post(
  "/api/posts/:id/comments",
  requireAuth,
  function(req, res) {

    const postId =
      req.params.id;

    const post =
      getPosts().find(
        item =>
          String(item.id) ===
          String(postId)
      );

    if (!post) {

      return res.status(404).json({
        error:
          "Post not found."
      });

    }

    const text =
      cleanText(
        req.body.text ||
        req.body.content,
        1000
      );

    if (!text) {

      return res.status(400).json({
        error:
          "Comment cannot be empty."
      });

    }

    const comments =
      getComments();

    const comment = {

      id:
        makeId("comment_"),

      postId,

      userId:
        req.user.id,

      text,

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

      fromUserId:
        req.user.id,

      type:
        "comment",

      postId,

      message:
        `${req.user.username} commented on your post.`
    });

    res.status(201).json({
      success: true,

      comment: {
        id:
          comment.id,

        postId,

        userId:
          req.user.id,

        user:
          safeUser(
            req.user,
            req.user
          ),

        text,

        content:
          text,

        createdAt:
          comment.createdAt
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
  function(req, res) {

    const comments =
      getComments();

    const index =
      comments.findIndex(
        comment =>
          String(
            comment.id
          ) ===
          String(
            req.params.id
          )
      );

    if (index < 0) {

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
      !isAdmin(req.user)
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
      success: true
    });

  }
);

/* =========================================================
   DELETE POST
========================================================= */

app.delete(
  "/api/posts/:id",
  requireAuth,
  function(req, res) {

    const posts =
      getPosts();

    const index =
      posts.findIndex(
        post =>
          String(
            post.id
          ) ===
          String(
            req.params.id
          )
      );

    if (index < 0) {

      return res.status(404).json({
        error:
          "Post not found."
      });

    }

    const post =
      posts[index];

    if (
      String(
        post.userId
      ) !==
        String(
          req.user.id
        ) &&
      !isAdmin(req.user)
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

    savePosts(
      posts
    );

    const likes =
      getLikes().filter(
        like =>
          String(
            like.postId
          ) !==
          String(
            post.id
          )
      );

    saveLikes(
      likes
    );

    const comments =
      getComments().filter(
        comment =>
          String(
            comment.postId
          ) !==
          String(
            post.id
          )
      );

    saveComments(
      comments
    );

    deleteUploadFile(
      post.image
    );

    deleteUploadFile(
      post.imageUrl
    );

    deleteUploadFile(
      post.video
    );

    deleteUploadFile(
      post.videoUrl
    );

    res.json({
      success: true
    });

  }
);

/* =========================================================
   FOLLOW / UNFOLLOW
========================================================= */

app.post(
  "/api/users/:id/follow",
  requireAuth,
  function(req, res) {

    const targetId =
      req.params.id;

    if (
      String(targetId) ===
      String(req.user.id)
    ) {

      return res.status(400).json({
        error:
          "You cannot follow yourself."
      });

    }

    const target =
      findUserById(
        targetId
      );

    if (!target) {

      return res.status(404).json({
        error:
          "User not found."
      });

    }

    const follows =
      getFollows();

    const existingIndex =
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
              targetId
            )
      );

    let following;

    if (
      existingIndex >= 0
    ) {

      follows.splice(
        existingIndex,
        1
      );

      following = false;

    } else {

      follows.push({

        id:
          makeId("follow_"),

        followerId:
          req.user.id,

        followingId:
          targetId,

        createdAt:
          now()

      });

      following = true;

      createNotification({
        userId:
          target.id,

        fromUserId:
          req.user.id,

        type:
          "follow",

        message:
          `${req.user.username} started following you.`
      });

    }

    saveFollows(
      follows
    );

    res.json({

      success: true,

      following,

      isFollowing:
        following,

      followersCount:
        getFollowerCount(
          target.id
        ),

      followingCount:
        getFollowingCount(
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
  function(req, res) {

    const user =
      findUserById(
        req.params.id
      );

    if (!user) {

      return res.status(404).json({
        error:
          "User not found."
      });

    }

    const viewer =
      req.session &&
      req.session.userId
        ? findUserById(
            req.session.userId
          )
        : null;

    const followers =
      getFollows()
        .filter(
          follow =>
            String(
              follow.followingId
            ) ===
            String(
              user.id
            )
        )
        .map(
          follow =>
            findUserById(
              follow.followerId
            )
        )
        .filter(Boolean);

    res.json({
      users:
        followers.map(
          follower =>
            safeUser(
              follower,
              viewer
            )
        )
    });

  }
);

/* =========================================================
   FOLLOWING
========================================================= */

app.get(
  "/api/users/:id/following",
  function(req, res) {

    const user =
      findUserById(
        req.params.id
      );

    if (!user) {

      return res.status(404).json({
        error:
          "User not found."
      });

    }

    const viewer =
      req.session &&
      req.session.userId
        ? findUserById(
            req.session.userId
          )
        : null;

    const following =
      getFollows()
        .filter(
          follow =>
            String(
              follow.followerId
            ) ===
            String(
              user.id
            )
        )
        .map(
          follow =>
            findUserById(
              follow.followingId
            )
        )
        .filter(Boolean);

    res.json({
      users:
        following.map(
          target =>
            safeUser(
              target,
              viewer
            )
        )
    });

  }
);

/* =========================================================
   SEARCH
========================================================= */

app.get(
  "/api/search",
  requireAuth,
  function(req, res) {

    const query =
      cleanText(
        req.query.q,
        100
      ).toLowerCase();

    if (!query) {

      return res.json({
        users: [],
        posts: []
      });

    }

    const users =
      getUsers()
        .filter(
          user =>
            String(
              user.username || ""
            )
              .toLowerCase()
              .includes(query) ||

            String(
              user.name || ""
            )
              .toLowerCase()
              .includes(query)
        )
        .slice(
          0,
          50
        );

    const posts =
      getPosts()
        .filter(
          post =>
            String(
              post.text || ""
            )
              .toLowerCase()
              .includes(query)
        )
        .slice(
          0,
          50
        );

    res.json({

      users:
        users.map(
          user =>
            safeUser(
              user,
              req.user
            )
        ),

      posts:
        posts.map(
          post =>
            safePost(
              post,
              req.user
            )
        )

    });

  }
);

/* =========================================================
   NOTIFICATIONS
========================================================= */

app.get(
  "/api/notifications",
  requireAuth,
  function(req, res) {

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
        .sort(
          (a, b) =>
            new Date(
              b.createdAt || 0
            ) -
            new Date(
              a.createdAt || 0
            )
        )
        .slice(
          0,
          100
        );

    res.json({

      notifications:
        notifications.map(
          notification => {

            const fromUser =
              findUserById(
                notification.fromUserId
              );

            return {
              ...notification,

              fromUser:
                safeUser(
                  fromUser,
                  req.user
                )
            };

          }
        ),

      unreadCount:
        notifications.filter(
          item =>
            !item.read
        ).length

    });

  }
);

/* =========================================================
   MARK NOTIFICATIONS READ
========================================================= */

app.post(
  "/api/notifications/read",
  requireAuth,
  function(req, res) {

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
      success: true
    });

  }
);

/* =========================================================
   MESSAGE CONVERSATIONS
========================================================= */

app.get(
  "/api/messages/conversations",
  requireAuth,
  function(req, res) {

    const messages =
      getMessages();

    const map =
      new Map();

    messages
      .filter(
        message =>
          String(
            message.senderId
          ) ===
            String(
              req.user.id
            ) ||
          String(
            message.receiverId
          ) ===
            String(
              req.user.id
            )
      )
      .sort(
        (a, b) =>
          new Date(
            b.createdAt || 0
          ) -
          new Date(
            a.createdAt || 0
          )
      )
      .forEach(
        message => {

          const otherId =
            String(
              message.senderId
            ) ===
            String(
              req.user.id
            )
              ? message.receiverId
              : message.senderId;

          if (
            !map.has(
              String(otherId)
            )
          ) {

            map.set(
              String(otherId),
              message
            );

          }

        }
      );

    const conversations =
      Array.from(
        map.entries()
      ).map(
        ([otherId, message]) => {

          const user =
            findUserById(
              otherId
            );

          return {
            user:
              safeUser(
                user,
                req.user
              ),

            lastMessage:
              message.text ||
              "",

            createdAt:
              message.createdAt,

            messageId:
              message.id
          };

        }
      );

    res.json({
      conversations
    });

  }
);

/* =========================================================
   GET MESSAGES
========================================================= */

app.get(
  "/api/messages/:userId",
  requireAuth,
  function(req, res) {

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
              a.createdAt || 0
            ) -
            new Date(
              b.createdAt || 0
            )
        );

    res.json({

      user:
        safeUser(
          otherUser,
          req.user
        ),

      messages

    });

  }
);

/* =========================================================
   SEND MESSAGE
========================================================= */

app.post(
  "/api/messages",
  requireAuth,
  messageUpload.single(
    "attachment"
  ),
  function(req, res) {

    try {

      const receiverId =
        cleanText(
          req.body.receiverId,
          100
        );

      const text =
        cleanText(
          req.body.text,
          5000
        );

      const receiver =
        findUserById(
          receiverId
        );

      if (!receiver) {

        if (req.file) {
          safeDelete(
            req.file.path
          );
        }

        return res.status(404).json({
          error:
            "Recipient not found."
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
          safeDelete(
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

      let attachment = null;

      if (req.file) {

        const extension =
          extensionMap[
            req.file.mimetype
          ] || ".jpg";

        const filename =
          `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`;

        const finalPath =
          path.join(
            MESSAGE_UPLOADS_DIR,
            filename
          );

        fs.renameSync(
          req.file.path,
          finalPath
        );

        attachment =
          `/uploads/messages/${filename}`;

      }

      const messages =
        getMessages();

      const message = {

        id:
          makeId("message_"),

        senderId:
          req.user.id,

        receiverId:
          receiver.id,

        text,

        attachment,

        read: false,

        createdAt:
          now()

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

        fromUserId:
          req.user.id,

        type:
          "message",

        message:
          `${req.user.username} sent you a message.`
      });

      res.status(201).json({

        success: true,

        message: {
          ...message,

          sender:
            safeUser(
              req.user,
              req.user
            ),

          receiver:
            safeUser(
              receiver,
              req.user
            )
        }

      });

    } catch (error) {

      console.error(
        "MESSAGE ERROR:",
        error
      );

      if (req.file) {
        safeDelete(
          req.file.path
        );
      }

      res.status(500).json({
        error:
          "Unable to send message."
      });

    }

  }
);

/* =========================================================
   UNREAD MESSAGES
========================================================= */

app.get(
  "/api/messages/unread-count",
  requireAuth,
  function(req, res) {

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
   VERIFICATION STATUS
========================================================= */

app.get(
  "/api/verification/me",
  requireAuth,
  function(req, res) {

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
              b.createdAt || 0
            ) -
            new Date(
              a.createdAt || 0
            )
        )[0] ||
      null;

    res.json({
      verified:
        Boolean(
          req.user.verified ||
          req.user.isVerified
        ),

      status:
        req.user.verificationStatus ||
        "none",

      request

    });

  }
);

/* =========================================================
   REQUEST VERIFICATION
========================================================= */

app.post(
  "/api/verification/request",
  requireAuth,
  function(req, res) {

    if (
      req.user.verified ||
      req.user.isVerified
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

      return res.status(409).json({
        error:
          "You already have a pending verification request."
      });

    }

    const reason =
      cleanText(
        req.body.reason,
        2000
      );

    const request = {

      id:
        makeId("verification_"),

      userId:
        req.user.id,

      reason,

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

    res.status(201).json({
      success: true,
      request
    });

  }
);

/* =========================================================
   ADMIN ME
========================================================= */

app.get(
  "/api/admin/me",
  requireAuth,
  requireAdmin,
  function(req, res) {

    res.json({

      isAdmin: true,

      user:
        safeUser(
          req.user,
          req.user
        )

    });

  }
);

/* =========================================================
   ADMIN STATS
========================================================= */

app.get(
  "/api/admin/stats",
  requireAuth,
  requireAdmin,
  function(req, res) {

    const users =
      getUsers();

    const posts =
      getPosts();

    const comments =
      getComments();

    const likes =
      getLikes();

    const follows =
      getFollows();

    const messages =
      getMessages();

    const verificationRequests =
      getVerificationRequests();

    res.json({

      users:
        users.length,

      posts:
        posts.length,

      comments:
        comments.length,

      likes:
        likes.length,

      follows:
        follows.length,

      messages:
        messages.length,

      verifiedUsers:
        users.filter(
          user =>
            user.verified ||
            user.isVerified
        ).length,

      pendingVerification:
        verificationRequests.filter(
          request =>
            request.status ===
            "pending"
        ).length

    });

  }
);

/* =========================================================
   ADMIN USERS
========================================================= */

app.get(
  "/api/admin/users",
  requireAuth,
  requireAdmin,
  function(req, res) {

    const users =
      getUsers();

    res.json({

      users:
        users.map(
          user =>
            safeUser(
              user,
              req.user
            )
        )

    });

  }
);

/* =========================================================
   ADMIN VERIFICATION REQUESTS
========================================================= */

app.get(
  "/api/admin/verification/requests",
  requireAuth,
  requireAdmin,
  function(req, res) {

    const requests =
      getVerificationRequests();

    res.json({

      requests:
        requests
          .sort(
            (a, b) =>
              new Date(
                b.createdAt || 0
              ) -
              new Date(
                a.createdAt || 0
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
                    req.user
                  )
              };

            }
          )

    });

  }
);

/* =========================================================
   ADMIN APPROVE VERIFICATION
========================================================= */

app.post(
  "/api/admin/verification/:id/approve",
  requireAuth,
  requireAdmin,
  function(req, res) {

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

    if (index < 0) {

      return res.status(404).json({
        error:
          "Verification request not found."
      });

    }

    const request =
      requests[index];

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

    if (userIndex < 0) {

      return res.status(404).json({
        error:
          "User no longer exists."
      });

    }

    users[userIndex].verified =
      true;

    users[userIndex].isVerified =
      true;

    users[userIndex].verificationStatus =
      "approved";

    request.status =
      "approved";

    request.updatedAt =
      now();

    saveUsers(
      users
    );

    saveVerificationRequests(
      requests
    );

    createNotification({
      userId:
        users[userIndex].id,

      fromUserId:
        req.user.id,

      type:
        "verification",

      message:
        "Your account has been verified."
    });

    res.json({
      success: true,

      user:
        safeUser(
          users[userIndex],
          req.user
        )
    });

  }
);

/* =========================================================
   ADMIN REJECT VERIFICATION
========================================================= */

app.post(
  "/api/admin/verification/:id/reject",
  requireAuth,
  requireAdmin,
  function(req, res) {

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

    if (index < 0) {

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

    if (userIndex >= 0) {

      users[userIndex].verificationStatus =
        "rejected";

      saveUsers(
        users
      );

      createNotification({
        userId:
          users[userIndex].id,

        fromUserId:
          req.user.id,

        type:
          "verification",

        message:
          "Your verification request was rejected."
      });

    }

    res.json({
      success: true,
      request
    });

  }
);

/* =========================================================
   ADMIN DELETE USER
========================================================= */

app.delete(
  "/api/admin/users/:id",
  requireAuth,
  requireAdmin,
  function(req, res) {

    const userId =
      req.params.id;

    if (
      String(userId) ===
      String(req.user.id)
    ) {

      return res.status(400).json({
        error:
          "You cannot delete your own admin account."
      });

    }

    const users =
      getUsers();

    const user =
      users.find(
        item =>
          String(
            item.id
          ) ===
          String(
            userId
          )
      );

    if (!user) {

      return res.status(404).json({
        error:
          "User not found."
      });

    }

    saveUsers(
      users.filter(
        item =>
          String(
            item.id
          ) !==
          String(
            userId
          )
      )
    );

    savePosts(
      getPosts().filter(
        post =>
          String(
            post.userId
          ) !==
          String(
            userId
          )
      )
    );

    saveComments(
      getComments().filter(
        comment =>
          String(
            comment.userId
          ) !==
          String(
            userId
          )
      )
    );

    saveLikes(
      getLikes().filter(
        like =>
          String(
            like.userId
          ) !==
          String(
            userId
          )
      )
    );

    saveFollows(
      getFollows().filter(
        follow =>
          String(
            follow.followerId
          ) !==
            String(
              userId
            ) &&
          String(
            follow.followingId
          ) !==
            String(
              userId
            )
      )
    );

    res.json({
      success: true
    });

  }
);

/* =========================================================
   HELPERS FOR FILE DELETION
========================================================= */

function safeDelete(filePath) {

  if (!filePath) {
    return;
  }

  try {

    if (
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

function deleteUploadFile(
  urlPath
) {

  if (
    !urlPath ||
    typeof urlPath !==
      "string"
  ) {
    return;
  }

  if (
    !urlPath.startsWith(
      "/uploads/"
    )
  ) {
    return;
  }

  const relative =
    urlPath.replace(
      /^\/uploads\//,
      ""
    );

  const fullPath =
    path.resolve(
      UPLOADS_DIR,
      relative
    );

  const uploadsRoot =
    path.resolve(
      UPLOADS_DIR
    );

  if (
    !fullPath.startsWith(
      uploadsRoot
    )
  ) {
    return;
  }

  safeDelete(
    fullPath
  );

}

/* =========================================================
   HASHTAGS
========================================================= */

function extractHashtags(
  text
) {

  const matches =
    String(text || "")
      .match(
        /#[a-zA-Z0-9_]+/g
      );

  if (!matches) {
    return [];
  }

  return [
    ...new Set(
      matches.map(
        tag =>
          tag.toLowerCase()
      )
    )
  ].slice(
    0,
    50
  );

}

/* =========================================================
   MULTER ERROR HANDLER
========================================================= */

app.use(
  function(
    error,
    req,
    res,
    next
  ) {

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
            "File is too large. Maximum size is 20MB."
        });

      }

      return res.status(400).json({
        error:
          error.message
      });

    }

    if (error) {

      console.error(
        "SERVER ERROR:",
        error
      );

      return res.status(400).json({
        error:
          error.message ||
          "Request failed."
      });

    }

    next();

  }
);

/* =========================================================
   404 API HANDLER
========================================================= */

app.use(
  "/api",
  function(req, res) {

    res.status(404).json({
      error:
        "API endpoint not found."
    });

  }
);

/* =========================================================
   START SERVER
========================================================= */

app.listen(
  PORT,
  HOST,
  function() {

    console.log("");
    console.log(
      "=============================================="
    );
    console.log(
      "        PULSE SOCIAL SERVER"
    );
    console.log(
      "=============================================="
    );
    console.log(
      `Server: http://${HOST}:${PORT}`
    );
    console.log(
      `Storage: ${STORAGE_ROOT}`
    );
    console.log(
      `Persistent: ${Boolean(process.env.STORAGE_ROOT)}`
    );
    console.log(
      "Video uploads: ENABLED"
    );
    console.log(
      "For You feed: ENABLED"
    );
    console.log(
      "Following feed: ENABLED"
    );
    console.log(
      "Likes: ENABLED"
    );
    console.log(
      "Comments: ENABLED"
    );
    console.log(
      "Follow system: ENABLED"
    );
    console.log(
      "Verified accounts: ENABLED"
    );
    console.log(
      "Messages: ENABLED"
    );
    console.log(
      "=============================================="
    );
    console.log("");

  }
);
