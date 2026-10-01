/*
============================================================
 PULSE SOCIAL
 Full Node.js + Express Social Media Server
 JSON File Storage
============================================================

ROLES:
  user
  admin
  superadmin

FEATURES:
  - Registration
  - Login / Logout
  - Sessions
  - Profiles
  - Profile picture
  - Cover photo
  - Posts
  - Post images
  - Likes
  - Comments
  - Follow / unfollow
  - Followers
  - Following
  - Search
  - Notifications
  - Private messaging
  - Message images
  - Unread messages
  - Verification requests
  - Admin verification
  - Admin statistics
  - JSON storage
============================================================
*/

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

const SESSION_SECRET =
  process.env.SESSION_SECRET || "pulse-social-change-this-secret";

const ADMIN_USERNAME =
  String(process.env.ADMIN_USERNAME || "")
    .trim()
    .toLowerCase();

/* =========================================================
   DIRECTORIES
========================================================= */

const ROOT = __dirname;

const DATA_DIR = path.join(ROOT, "data");
const UPLOADS_DIR = path.join(ROOT, "uploads");

const PROFILE_UPLOAD_DIR = path.join(
  UPLOADS_DIR,
  "profiles"
);

const COVER_UPLOAD_DIR = path.join(
  UPLOADS_DIR,
  "covers"
);

const POST_UPLOAD_DIR = path.join(
  UPLOADS_DIR,
  "posts"
);

const MESSAGE_UPLOAD_DIR = path.join(
  UPLOADS_DIR,
  "messages"
);

const PUBLIC_DIR = path.join(ROOT, "public");

[
  DATA_DIR,
  UPLOADS_DIR,
  PROFILE_UPLOAD_DIR,
  COVER_UPLOAD_DIR,
  POST_UPLOAD_DIR,
  MESSAGE_UPLOAD_DIR,
  PUBLIC_DIR
].forEach(dir => {
  fs.mkdirSync(dir, {
    recursive: true
  });
});

/* =========================================================
   DATA FILES
========================================================= */

const USERS_FILE = path.join(
  DATA_DIR,
  "users.json"
);

const POSTS_FILE = path.join(
  DATA_DIR,
  "posts.json"
);

const COMMENTS_FILE = path.join(
  DATA_DIR,
  "comments.json"
);

const LIKES_FILE = path.join(
  DATA_DIR,
  "likes.json"
);

const FOLLOWS_FILE = path.join(
  DATA_DIR,
  "follows.json"
);

const NOTIFICATIONS_FILE = path.join(
  DATA_DIR,
  "notifications.json"
);

const MESSAGES_FILE = path.join(
  DATA_DIR,
  "messages.json"
);

const VERIFICATION_FILE = path.join(
  DATA_DIR,
  "verification_requests.json"
);

/* =========================================================
   JSON HELPERS
========================================================= */

function ensureJSONFile(file, defaultValue = []) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(
      file,
      JSON.stringify(defaultValue, null, 2)
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
].forEach(file => ensureJSONFile(file, []));

function readJSON(file) {
  try {
    const raw = fs.readFileSync(file, "utf8");

    if (!raw.trim()) {
      return [];
    }

    return JSON.parse(raw);
  } catch (error) {
    console.error(
      "JSON READ ERROR:",
      file,
      error.message
    );

    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(
    file,
    JSON.stringify(data, null, 2)
  );
}

function generateId(prefix = "") {
  return (
    prefix +
    Date.now().toString(36) +
    crypto
      .randomBytes(8)
      .toString("hex")
  );
}

function now() {
  return new Date().toISOString();
}

function clean(value, max = 5000) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

/* =========================================================
   APP MIDDLEWARE
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
      secure:
        process.env.NODE_ENV === "production"
    }
  })
);

app.use(
  express.static(PUBLIC_DIR)
);

app.use(
  "/uploads",
  express.static(UPLOADS_DIR)
);

/* =========================================================
   MULTER
========================================================= */

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

function createImageStorage(folder, prefix) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, folder);
    },

    filename: (req, file, cb) => {
      const ext =
        path.extname(file.originalname)
          .toLowerCase();

      const filename =
        `${prefix}-${Date.now()}-` +
        crypto.randomBytes(6).toString("hex") +
        ext;

      cb(null, filename);
    }
  });
}

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

const profileUpload = multer({
  storage: createImageStorage(
    PROFILE_UPLOAD_DIR,
    "profile"
  ),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: imageFilter
});

const coverUpload = multer({
  storage: createImageStorage(
    COVER_UPLOAD_DIR,
    "cover"
  ),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: imageFilter
});

const postUpload = multer({
  storage: createImageStorage(
    POST_UPLOAD_DIR,
    "post"
  ),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: imageFilter
});

const messageUpload = multer({
  storage: createImageStorage(
    MESSAGE_UPLOAD_DIR,
    "message"
  ),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: imageFilter
});

/* =========================================================
   USER HELPERS
========================================================= */

function getUsers() {
  return readJSON(USERS_FILE);
}

function getUserById(id) {
  return getUsers().find(
    user =>
      String(user.id) === String(id)
  );
}

function getUserByUsername(username) {
  const target =
    String(username || "")
      .trim()
      .toLowerCase();

  return getUsers().find(
    user =>
      String(user.username || "")
        .toLowerCase() === target
  );
}

function getUserByEmail(email) {
  const target =
    String(email || "")
      .trim()
      .toLowerCase();

  return getUsers().find(
    user =>
      String(user.email || "")
        .toLowerCase() === target
  );
}

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
    String(user.username || "")
      .toLowerCase() === ADMIN_USERNAME
  );
}

function safeUser(user) {
  if (!user) return null;

  const verified =
    Boolean(
      user.verified ||
      user.isVerified ||
      user.verificationStatus ===
        "approved"
    );

  const profilePicture =
    user.profilePicture ||
    user.profileImage ||
    user.avatar ||
    "/images/default-avatar.png";

  const coverPhoto =
    user.coverPhoto ||
    user.coverImage ||
    "";

  return {
    id: user.id,

    name:
      user.name ||
      user.username ||
      "Pulse User",

    username:
      user.username || "",

    email:
      user.email || "",

    bio:
      user.bio || "",

    profilePicture,

    profileImage: profilePicture,

    avatar: profilePicture,

    coverPhoto,

    coverImage: coverPhoto,

    role:
      user.role || "user",

    verified,

    isVerified: verified,

    verificationStatus:
      user.verificationStatus ||
      "none",

    createdAt:
      user.createdAt || null,

    isAdmin:
      isAdminUser(user)
  };
}

/* =========================================================
   AUTH
========================================================= */

function getCurrentUser(req) {
  if (!req.session.userId) {
    return null;
  }

  return getUserById(
    req.session.userId
  );
}

function requireAuth(req, res, next) {
  const user = getCurrentUser(req);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "You must be logged in."
    });
  }

  req.user = user;

  next();
}

function requireAdmin(req, res, next) {
  const user = getCurrentUser(req);

  if (!user || !isAdminUser(user)) {
    return res.status(403).json({
      success: false,
      message: "Administrator access required."
    });
  }

  req.user = user;

  next();
}

/* =========================================================
   FOLLOW HELPERS
========================================================= */

function isFollowing(
  followerId,
  followingId
) {
  const follows =
    readJSON(FOLLOWS_FILE);

  return follows.some(
    follow =>
      String(follow.followerId) ===
        String(followerId) &&
      String(follow.followingId) ===
        String(followingId)
  );
}

function followersCount(userId) {
  return readJSON(FOLLOWS_FILE)
    .filter(
      follow =>
        String(follow.followingId) ===
        String(userId)
    ).length;
}

function followingCount(userId) {
  return readJSON(FOLLOWS_FILE)
    .filter(
      follow =>
        String(follow.followerId) ===
        String(userId)
    ).length;
}

/* =========================================================
   POST HELPERS
========================================================= */

function getPosts() {
  return readJSON(POSTS_FILE);
}

function getPostById(id) {
  return getPosts().find(
    post =>
      String(post.id) === String(id)
  );
}

function postLikeCount(postId) {
  return readJSON(LIKES_FILE)
    .filter(
      like =>
        String(like.postId) ===
        String(postId)
    ).length;
}

function postCommentCount(postId) {
  return readJSON(COMMENTS_FILE)
    .filter(
      comment =>
        String(comment.postId) ===
        String(postId)
    ).length;
}

function buildPost(post, currentUserId) {
  const author =
    getUserById(post.userId);

  const liked =
    readJSON(LIKES_FILE).some(
      like =>
        String(like.postId) ===
          String(post.id) &&
        String(like.userId) ===
          String(currentUserId)
    );

  return {
    ...post,

    user:
      safeUser(author),

    author:
      safeUser(author),

    likeCount:
      postLikeCount(post.id),

    commentCount:
      postCommentCount(post.id),

    liked,

    isLiked: liked,

    isOwner:
      String(post.userId) ===
      String(currentUserId)
  };
}

/* =========================================================
   NOTIFICATIONS
========================================================= */

function createNotification({
  userId,
  actorId,
  type,
  text,
  postId = null
}) {
  if (
    !userId ||
    !actorId ||
    String(userId) ===
      String(actorId)
  ) {
    return null;
  }

  const notifications =
    readJSON(NOTIFICATIONS_FILE);

  const notification = {
    id: generateId("notif_"),
    userId,
    actorId,
    type,
    text,
    postId,
    read: false,
    createdAt: now()
  };

  notifications.unshift(
    notification
  );

  writeJSON(
    NOTIFICATIONS_FILE,
    notifications
  );

  return notification;
}

/* =========================================================
   HEALTH
========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "online",
    platform: "Pulse Social",
    version: "4.0.0",
    storage: "JSON",
    features: {
      authentication: true,
      profiles: true,
      profilePictures: true,
      coverPhotos: true,
      posts: true,
      likes: true,
      comments: true,
      follows: true,
      notifications: true,
      messaging: true,
      messageImages: true,
      verification: true,
      admin: true
    }
  });
});

/* =========================================================
   HOME
========================================================= */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      PUBLIC_DIR,
      "index.html"
    )
  );
});

/* =========================================================
   REGISTER
========================================================= */

async function registerUser({
  name,
  username,
  email,
  password
}) {
  const users = getUsers();

  name = clean(name, 100);

  username =
    String(username || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");

  email =
    String(email || "")
      .trim()
      .toLowerCase();

  password =
    String(password || "");

  if (!name) {
    throw new Error(
      "Name is required."
    );
  }

  if (username.length < 3) {
    throw new Error(
      "Username must contain at least 3 characters."
    );
  }

  if (password.length < 6) {
    throw new Error(
      "Password must contain at least 6 characters."
    );
  }

  if (
    users.some(
      user =>
        String(user.username || "")
          .toLowerCase() ===
        username
    )
  ) {
    throw new Error(
      "Username is already taken."
    );
  }

  if (
    email &&
    users.some(
      user =>
        String(user.email || "")
          .toLowerCase() ===
        email
    )
  ) {
    throw new Error(
      "Email is already registered."
    );
  }

  const passwordHash =
    await bcrypt.hash(
      password,
      12
    );

  const user = {
    id: generateId("user_"),

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

    role: "user",

    verified: false,

    isVerified: false,

    verificationStatus:
      "none",

    createdAt: now()
  };

  users.push(user);

  writeJSON(
    USERS_FILE,
    users
  );

  return user;
}

app.post(
  "/api/register",
  async (req, res) => {
    try {
      const user =
        await registerUser({
          name: req.body.name,
          username:
            req.body.username,
          email:
            req.body.email,
          password:
            req.body.password
        });

      req.session.userId =
        user.id;

      res.json({
        success: true,
        message:
          "Account created successfully.",
        user:
          safeUser(user)
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message:
          error.message
      });
    }
  }
);

app.post(
  "/api/signup",
  async (req, res) => {
    try {
      const user =
        await registerUser({
          name: req.body.name,
          username:
            req.body.username,
          email:
            req.body.email,
          password:
            req.body.password
        });

      req.session.userId =
        user.id;

      res.json({
        success: true,
        message:
          "Account created successfully.",
        user:
          safeUser(user)
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message:
          error.message
      });
    }
  }
);

/* =========================================================
   LOGIN
========================================================= */

app.post(
  "/api/login",
  async (req, res) => {
    try {
      const login =
        String(
          req.body.login ||
          req.body.username ||
          req.body.email ||
          ""
        )
          .trim()
          .toLowerCase();

      const password =
        String(
          req.body.password || ""
        );

      if (!login || !password) {
        return res.status(400).json({
          success: false,
          message:
            "Username/email and password are required."
        });
      }

      let user =
        getUserByUsername(login);

      if (!user) {
        user =
          getUserByEmail(login);
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          message:
            "Invalid login details."
        });
      }

      if (!user.passwordHash) {
        return res.status(401).json({
          success: false,
          message:
            "This account has no valid password. Please reset the password."
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
          message:
            "Invalid login details."
        });
      }

      req.session.userId =
        user.id;

      res.json({
        success: true,
        message:
          "Login successful.",
        user:
          safeUser(user),
        admin:
          isAdminUser(user)
      });
    } catch (error) {
      console.error(
        "LOGIN ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
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
  (req, res) => {
    req.session.destroy(
      error => {
        if (error) {
          return res.status(500).json({
            success: false,
            message:
              "Unable to log out."
          });
        }

        res.clearCookie(
          "connect.sid"
        );

        res.json({
          success: true,
          message:
            "Logged out successfully."
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
  (req, res) => {
    const user =
      getCurrentUser(req);

    if (!user) {
      return res.json({
        success: true,
        loggedIn: false,
        admin: false,
        user: null
      });
    }

    res.json({
      success: true,
      loggedIn: true,
      admin:
        isAdminUser(user),
      user:
        safeUser(user)
    });
  }
);

/* =========================================================
   PROFILE
========================================================= */

app.get(
  "/api/users/:username",
  requireAuth,
  (req, res) => {
    const user =
      getUserByUsername(
        req.params.username
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found."
      });
    }

    const posts =
      getPosts().filter(
        post =>
          String(post.userId) ===
          String(user.id)
      );

    const profile = {
      ...safeUser(user),

      followersCount:
        followersCount(user.id),

      followingCount:
        followingCount(user.id),

      postsCount:
        posts.length,

      isFollowing:
        isFollowing(
          req.user.id,
          user.id
        ),

      following:
        isFollowing(
          req.user.id,
          user.id
        )
    };

    res.json({
      success: true,
      user: profile
    });
  }
);

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
        message:
          "User not found."
      });
    }

    const posts =
      getPosts()
        .filter(
          post =>
            String(post.userId) ===
            String(user.id)
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
        )
        .map(post =>
          buildPost(
            post,
            req.user.id
          )
        );

    res.json({
      success: true,
      posts
    });
  }
);

app.put(
  "/api/profile",
  requireAuth,
  (req, res) => {
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
        success: false,
        message:
          "User not found."
      });
    }

    users[index].name =
      clean(
        req.body.name ||
          users[index].name,
        100
      );

    users[index].bio =
      clean(
        req.body.bio || "",
        500
      );

    writeJSON(
      USERS_FILE,
      users
    );

    res.json({
      success: true,
      message:
        "Profile updated successfully.",
      user:
        safeUser(users[index])
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
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message:
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
        fs.unlinkSync(
          req.file.path
        );

        return res.status(404).json({
          success: false,
          message:
            "User not found."
        });
      }

      const user =
        users[index];

      const oldPicture =
        user.profilePicture;

      if (
        oldPicture &&
        oldPicture.startsWith(
          "/uploads/profiles/"
        )
      ) {
        const oldFile =
          path.basename(
            oldPicture
          );

        const oldPath =
          path.join(
            PROFILE_UPLOAD_DIR,
            oldFile
          );

        try {
          if (
            fs.existsSync(
              oldPath
            )
          ) {
            fs.unlinkSync(
              oldPath
            );
          }
        } catch {}
      }

      const profilePicture =
        `/uploads/profiles/${req.file.filename}`;

      user.profilePicture =
        profilePicture;

      user.profileImage =
        profilePicture;

      user.avatar =
        profilePicture;

      users[index] =
        user;

      writeJSON(
        USERS_FILE,
        users
      );

      res.json({
        success: true,
        message:
          "Profile picture updated.",
        profilePicture,
        user:
          safeUser(user)
      });
    } catch (error) {
      console.error(
        "PROFILE PICTURE ERROR:",
        error
      );

      if (req.file?.path) {
        try {
          fs.unlinkSync(
            req.file.path
          );
        } catch {}
      }

      res.status(500).json({
        success: false,
        message:
          "Unable to upload profile picture."
      });
    }
  }
);

/* =========================================================
   COVER PHOTO
========================================================= */

app.post(
  "/api/profile/cover",
  requireAuth,
  coverUpload.single(
    "coverPhoto"
  ),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message:
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
        try {
          fs.unlinkSync(
            req.file.path
          );
        } catch {}

        return res.status(404).json({
          success: false,
          message:
            "User not found."
        });
      }

      const user =
        users[index];

      const oldCover =
        user.coverPhoto ||
        user.coverImage ||
        "";

      if (
        oldCover.startsWith(
          "/uploads/covers/"
        )
      ) {
        const oldFile =
          path.basename(
            oldCover
          );

        const oldPath =
          path.join(
            COVER_UPLOAD_DIR,
            oldFile
          );

        try {
          if (
            fs.existsSync(
              oldPath
            )
          ) {
            fs.unlinkSync(
              oldPath
            );
          }
        } catch {}
      }

      const coverPhoto =
        `/uploads/covers/${req.file.filename}`;

      user.coverPhoto =
        coverPhoto;

      user.coverImage =
        coverPhoto;

      users[index] =
        user;

      writeJSON(
        USERS_FILE,
        users
      );

      res.json({
        success: true,
        message:
          "Cover photo updated successfully.",
        coverPhoto,
        coverImage:
          coverPhoto,
        user:
          safeUser(user)
      });
    } catch (error) {
      console.error(
        "COVER PHOTO ERROR:",
        error
      );

      if (req.file?.path) {
        try {
          fs.unlinkSync(
            req.file.path
          );
        } catch {}
      }

      res.status(500).json({
        success: false,
        message:
          "Unable to upload cover photo."
      });
    }
  }
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
      const text =
        clean(
          req.body.text || "",
          5000
        );

      if (
        !text &&
        !req.file
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Write something or select an image."
        });
      }

      const posts =
        getPosts();

      const post = {
        id:
          generateId("post_"),

        userId:
          req.user.id,

        text,

        image:
          req.file
            ? `/uploads/posts/${req.file.filename}`
            : "",

        createdAt:
          now()
      };

      posts.unshift(
        post
      );

      writeJSON(
        POSTS_FILE,
        posts
      );

      res.json({
        success: true,
        message:
          "Post published.",
        post:
          buildPost(
            post,
            req.user.id
          )
      });
    } catch (error) {
      console.error(
        "POST ERROR:",
        error
      );

      if (req.file?.path) {
        try {
          fs.unlinkSync(
            req.file.path
          );
        } catch {}
      }

      res.status(500).json({
        success: false,
        message:
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
  (req, res) => {
    const limit =
      Math.min(
        Number(
          req.query.limit || 50
        ),
        100
      );

    const followingOnly =
      String(
        req.query.following
      ) === "true";

    const posts =
      getPosts()
        .sort(
          (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
        )
        .filter(post => {
          if (!followingOnly) {
            return true;
          }

          return (
            String(
              post.userId
            ) ===
              String(
                req.user.id
              ) ||
            isFollowing(
              req.user.id,
              post.userId
            )
          );
        })
        .slice(0, limit)
        .map(post =>
          buildPost(
            post,
            req.user.id
          )
        );

    res.json({
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
        success: false,
        message:
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
        success: false,
        message:
          "You cannot delete this post."
      });
    }

    if (
      post.image &&
      post.image.startsWith(
        "/uploads/posts/"
      )
    ) {
      const file =
        path.join(
          POST_UPLOAD_DIR,
          path.basename(
            post.image
          )
        );

      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch {}
    }

    posts.splice(index, 1);

    writeJSON(
      POSTS_FILE,
      posts
    );

    const comments =
      readJSON(
        COMMENTS_FILE
      ).filter(
        comment =>
          String(comment.postId) !==
          String(post.id)
      );

    writeJSON(
      COMMENTS_FILE,
      comments
    );

    const likes =
      readJSON(
        LIKES_FILE
      ).filter(
        like =>
          String(like.postId) !==
          String(post.id)
      );

    writeJSON(
      LIKES_FILE,
      likes
    );

    res.json({
      success: true,
      message:
        "Post deleted."
    });
  }
);

/* =========================================================
   LIKE POST
========================================================= */

app.post(
  "/api/posts/:id/like",
  requireAuth,
  (req, res) => {
    const post =
      getPostById(
        req.params.id
      );

    if (!post) {
      return res.status(404).json({
        success: false,
        message:
          "Post not found."
      });
    }

    const likes =
      readJSON(
        LIKES_FILE
      );

    const index =
      likes.findIndex(
        like =>
          String(like.postId) ===
            String(post.id) &&
          String(like.userId) ===
            String(req.user.id)
      );

    let liked;

    if (index >= 0) {
      likes.splice(
        index,
        1
      );

      liked = false;
    } else {
      likes.push({
        id:
          generateId("like_"),
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
        text:
          `${req.user.name} liked your post.`,
        postId:
          post.id
      });
    }

    writeJSON(
      LIKES_FILE,
      likes
    );

    res.json({
      success: true,
      liked,
      isLiked:
        liked,
      likeCount:
        postLikeCount(
          post.id
        )
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
      getPostById(
        req.params.id
      );

    if (!post) {
      return res.status(404).json({
        success: false,
        message:
          "Post not found."
      });
    }

    const comments =
      readJSON(
        COMMENTS_FILE
      )
        .filter(
          comment =>
            String(comment.postId) ===
            String(post.id)
        )
        .sort(
          (a, b) =>
            new Date(a.createdAt) -
            new Date(b.createdAt)
        )
        .map(comment => ({
          ...comment,
          user:
            safeUser(
              getUserById(
                comment.userId
              )
            ),
          author:
            safeUser(
              getUserById(
                comment.userId
              )
            ),
          isOwner:
            String(
              comment.userId
            ) ===
            String(
              req.user.id
            )
        }));

    res.json({
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
      getPostById(
        req.params.id
      );

    if (!post) {
      return res.status(404).json({
        success: false,
        message:
          "Post not found."
      });
    }

    const text =
      clean(
        req.body.text || "",
        1000
      );

    if (!text) {
      return res.status(400).json({
        success: false,
        message:
          "Comment cannot be empty."
      });
    }

    const comments =
      readJSON(
        COMMENTS_FILE
      );

    const comment = {
      id:
        generateId("comment_"),
      postId:
        post.id,
      userId:
        req.user.id,
      text,
      createdAt:
        now()
    };

    comments.push(
      comment
    );

    writeJSON(
      COMMENTS_FILE,
      comments
    );

    createNotification({
      userId:
        post.userId,
      actorId:
        req.user.id,
      type:
        "comment",
      text:
        `${req.user.name} commented on your post.`,
      postId:
        post.id
    });

    res.json({
      success: true,
      message:
        "Comment added.",
      comment: {
        ...comment,
        user:
          safeUser(req.user),
        author:
          safeUser(req.user),
        isOwner: true
      }
    });
  }
);

app.delete(
  "/api/comments/:id",
  requireAuth,
  (req, res) => {
    const comments =
      readJSON(
        COMMENTS_FILE
      );

    const index =
      comments.findIndex(
        comment =>
          String(comment.id) ===
          String(req.params.id)
      );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message:
          "Comment not found."
      });
    }

    const comment =
      comments[index];

    if (
      String(comment.userId) !==
        String(req.user.id) &&
      !isAdminUser(req.user)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You cannot delete this comment."
      });
    }

    comments.splice(
      index,
      1
    );

    writeJSON(
      COMMENTS_FILE,
      comments
    );

    res.json({
      success: true,
      message:
        "Comment deleted."
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
      getUserById(
        req.params.id
      );

    if (!target) {
      return res.status(404).json({
        success: false,
        message:
          "User not found."
      });
    }

    if (
      String(target.id) ===
      String(req.user.id)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "You cannot follow yourself."
      });
    }

    const follows =
      readJSON(
        FOLLOWS_FILE
      );

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
            String(target.id)
      );

    let following;

    if (index >= 0) {
      follows.splice(
        index,
        1
      );

      following = false;
    } else {
      follows.push({
        id:
          generateId("follow_"),
        followerId:
          req.user.id,
        followingId:
          target.id,
        createdAt:
          now()
      });

      following = true;

      createNotification({
        userId:
          target.id,
        actorId:
          req.user.id,
        type:
          "follow",
        text:
          `${req.user.name} started following you.`
      });
    }

    writeJSON(
      FOLLOWS_FILE,
      follows
    );

    res.json({
      success: true,
      following,
      isFollowing:
        following,
      followersCount:
        followersCount(
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
  requireAuth,
  (req, res) => {
    const follows =
      readJSON(
        FOLLOWS_FILE
      );

    const users =
      follows
        .filter(
          follow =>
            String(
              follow.followingId
            ) ===
            String(
              req.params.id
            )
        )
        .map(
          follow =>
            getUserById(
              follow.followerId
            )
        )
        .filter(Boolean)
        .map(
          user =>
            safeUser(user)
        );

    res.json({
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
    const follows =
      readJSON(
        FOLLOWS_FILE
      );

    const users =
      follows
        .filter(
          follow =>
            String(
              follow.followerId
            ) ===
            String(
              req.params.id
            )
        )
        .map(
          follow =>
            getUserById(
              follow.followingId
            )
        )
        .filter(Boolean)
        .map(
          user =>
            safeUser(user)
        );

    res.json({
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
    const q =
      String(
        req.query.q || ""
      )
        .trim()
        .toLowerCase();

    if (!q) {
      return res.json({
        success: true,
        users: []
      });
    }

    const users =
      getUsers()
        .filter(user => {
          const name =
            String(
              user.name || ""
            ).toLowerCase();

          const username =
            String(
              user.username || ""
            ).toLowerCase();

          return (
            name.includes(q) ||
            username.includes(q)
          );
        })
        .slice(0, 30)
        .map(user => ({
          ...safeUser(user),

          followersCount:
            followersCount(
              user.id
            ),

          followingCount:
            followingCount(
              user.id
            ),

          isFollowing:
            isFollowing(
              req.user.id,
              user.id
            )
        }));

    res.json({
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
      readJSON(
        NOTIFICATIONS_FILE
      )
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
              b.createdAt
            ) -
            new Date(
              a.createdAt
            )
        )
        .map(
          notification => ({
            ...notification,
            actor:
              safeUser(
                getUserById(
                  notification.actorId
                )
              )
          })
        );

    res.json({
      success: true,
      notifications,
      unreadCount:
        notifications.filter(
          n => !n.read
        ).length
    });
  }
);

app.post(
  "/api/notifications/read",
  requireAuth,
  (req, res) => {
    const notifications =
      readJSON(
        NOTIFICATIONS_FILE
      );

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

    writeJSON(
      NOTIFICATIONS_FILE,
      notifications
    );

    res.json({
      success: true
    });
  }
);

/* =========================================================
   STATISTICS
========================================================= */

app.get(
  "/api/stats",
  requireAuth,
  (req, res) => {
    const posts =
      getPosts().filter(
        post =>
          String(post.userId) ===
          String(req.user.id)
      );

    const likes =
      readJSON(
        LIKES_FILE
      );

    const comments =
      readJSON(
        COMMENTS_FILE
      );

    const likesReceived =
      likes.filter(
        like =>
          posts.some(
            post =>
              String(
                post.id
              ) ===
              String(
                like.postId
              )
          )
      ).length;

    const commentsReceived =
      comments.filter(
        comment =>
          posts.some(
            post =>
              String(
                post.id
              ) ===
              String(
                comment.postId
              )
          )
      ).length;

    res.json({
      success: true,

      stats: {
        posts:
          posts.length,

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
   MESSAGES
========================================================= */

/*
Message object:

{
  id,
  senderId,
  receiverId,
  text,
  image,
  createdAt,
  read
}
*/

function buildMessage(
  message,
  currentUserId
) {
  const sender =
    getUserById(
      message.senderId
    );

  const receiver =
    getUserById(
      message.receiverId
    );

  return {
    ...message,

    sender:
      safeUser(sender),

    receiver:
      safeUser(receiver),

    isMine:
      String(
        message.senderId
      ) ===
      String(
        currentUserId
      )
  };
}

/* =========================================================
   MESSAGE CONVERSATIONS
========================================================= */

app.get(
  "/api/messages/conversations",
  requireAuth,
  (req, res) => {
    const messages =
      readJSON(
        MESSAGES_FILE
      );

    const relevant =
      messages.filter(
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
      );

    const map =
      new Map();

    relevant.forEach(
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

        const key =
          String(otherId);

        const existing =
          map.get(key);

        if (
          !existing ||
          new Date(
            message.createdAt
          ) >
            new Date(
              existing.message.createdAt
            )
        ) {
          map.set(key, {
            message,
            unreadCount: 0
          });
        }
      }
    );

    relevant.forEach(
      message => {
        if (
          String(
            message.receiverId
          ) ===
            String(
              req.user.id
            ) &&
          !message.read
        ) {
          const otherId =
            String(
              message.senderId
            );

          const conversation =
            map.get(otherId);

          if (conversation) {
            conversation.unreadCount++;
          }
        }
      }
    );

    const conversations =
      Array.from(
        map.entries()
      )
        .map(
          ([userId, data]) => {
            const otherUser =
              getUserById(
                userId
              );

            if (!otherUser) {
              return null;
            }

            return {
              user:
                safeUser(
                  otherUser
                ),

              lastMessage:
                buildMessage(
                  data.message,
                  req.user.id
                ),

              unreadCount:
                data.unreadCount
            };
          }
        )
        .filter(Boolean)
        .sort(
          (a, b) =>
            new Date(
              b.lastMessage.createdAt
            ) -
            new Date(
              a.lastMessage.createdAt
            )
        );

    res.json({
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
        message:
          "User not found."
      });
    }

    const messages =
      readJSON(
        MESSAGES_FILE
      );

    const conversation =
      messages.filter(
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

    let changed = false;

    conversation.forEach(
      message => {
        if (
          String(
            message.receiverId
          ) ===
            String(
              req.user.id
            ) &&
          !message.read
        ) {
          message.read =
            true;

          const original =
            messages.find(
              item =>
                String(
                  item.id
                ) ===
                String(
                  message.id
                )
            );

          if (original) {
            original.read =
              true;

            changed = true;
          }
        }
      }
    );

    if (changed) {
      writeJSON(
        MESSAGES_FILE,
        messages
      );
    }

    res.json({
      success: true,

      user:
        safeUser(
          otherUser
        ),

      messages:
        conversation.map(
          message =>
            buildMessage(
              message,
              req.user.id
            )
        )
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
    "image"
  ),
  (req, res) => {
    try {
      const receiverId =
        String(
          req.body.receiverId ||
          req.body.userId ||
          ""
        ).trim();

      const text =
        clean(
          req.body.text || "",
          5000
        );

      if (!receiverId) {
        if (req.file?.path) {
          try {
            fs.unlinkSync(
              req.file.path
            );
          } catch {}
        }

        return res.status(400).json({
          success: false,
          message:
            "Receiver is required."
        });
      }

      const receiver =
        getUserById(
          receiverId
        );

      if (!receiver) {
        if (req.file?.path) {
          try {
            fs.unlinkSync(
              req.file.path
            );
          } catch {}
        }

        return res.status(404).json({
          success: false,
          message:
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
        if (req.file?.path) {
          try {
            fs.unlinkSync(
              req.file.path
            );
          } catch {}
        }

        return res.status(400).json({
          success: false,
          message:
            "You cannot message yourself."
        });
      }

      if (
        !text &&
        !req.file
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Message cannot be empty."
        });
      }

      const messages =
        readJSON(
          MESSAGES_FILE
        );

      const message = {
        id:
          generateId("msg_"),

        senderId:
          req.user.id,

        receiverId:
          receiver.id,

        text,

        image:
          req.file
            ? `/uploads/messages/${req.file.filename}`
            : "",

        createdAt:
          now(),

        read: false
      };

      messages.push(
        message
      );

      writeJSON(
        MESSAGES_FILE,
        messages
      );

      createNotification({
        userId:
          receiver.id,
        actorId:
          req.user.id,
        type:
          "message",
        text:
          `${req.user.name} sent you a message.`
      });

      res.json({
        success: true,
        message:
          buildMessage(
            message,
            req.user.id
          )
      });
    } catch (error) {
      console.error(
        "MESSAGE ERROR:",
        error
      );

      if (req.file?.path) {
        try {
          fs.unlinkSync(
            req.file.path
          );
        } catch {}
      }

      res.status(500).json({
        success: false,
        message:
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
    const messages =
      readJSON(
        MESSAGES_FILE
      );

    const count =
      messages.filter(
        message =>
          String(
            message.receiverId
          ) ===
            String(
              req.user.id
            ) &&
          !message.read
      ).length;

    res.json({
      success: true,
      count,
      unreadCount:
        count
    });
  }
);

/* =========================================================
   DELETE MESSAGE
========================================================= */

app.delete(
  "/api/messages/:id",
  requireAuth,
  (req, res) => {
    const messages =
      readJSON(
        MESSAGES_FILE
      );

    const index =
      messages.findIndex(
        message =>
          String(
            message.id
          ) ===
          String(
            req.params.id
          )
      );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message:
          "Message not found."
      });
    }

    const message =
      messages[index];

    if (
      String(
        message.senderId
      ) !==
      String(
        req.user.id
      ) &&
      !isAdminUser(req.user)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You cannot delete this message."
      });
    }

    if (
      message.image &&
      message.image.startsWith(
        "/uploads/messages/"
      )
    ) {
      const file =
        path.join(
          MESSAGE_UPLOAD_DIR,
          path.basename(
            message.image
          )
        );

      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch {}
    }

    messages.splice(
      index,
      1
    );

    writeJSON(
      MESSAGES_FILE,
      messages
    );

    res.json({
      success: true,
      message:
        "Message deleted."
    });
  }
);

/* =========================================================
   VERIFICATION
========================================================= */

app.get(
  "/api/verification/me",
  requireAuth,
  (req, res) => {
    const requests =
      readJSON(
        VERIFICATION_FILE
      );

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
        )[0] || null;

    res.json({
      success: true,
      verified:
        Boolean(
          req.user.verified
        ),
      status:
        req.user
          .verificationStatus ||
        "none",
      request
    });
  }
);

app.post(
  "/api/verification/request",
  requireAuth,
  (req, res) => {
    if (
      req.user.verified
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Your account is already verified."
      });
    }

    const reason =
      clean(
        req.body.reason || "",
        2000
      );

    if (!reason) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a reason for verification."
      });
    }

    const requests =
      readJSON(
        VERIFICATION_FILE
      );

    const existing =
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

    if (existing) {
      return res.status(400).json({
        success: false,
        message:
          "You already have a pending verification request."
      });
    }

    const request = {
      id:
        generateId("verify_"),

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

    writeJSON(
      VERIFICATION_FILE,
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

    if (index >= 0) {
      users[index]
        .verificationStatus =
        "pending";

      writeJSON(
        USERS_FILE,
        users
      );
    }

    res.json({
      success: true,
      message:
        "Verification request submitted.",
      request
    });
  }
);

/* =========================================================
   ADMIN
========================================================= */

app.get(
  "/api/admin/me",
  requireAdmin,
  (req, res) => {
    res.json({
      success: true,
      admin:
        safeUser(req.user)
    });
  }
);

app.get(
  "/api/admin/stats",
  requireAdmin,
  (req, res) => {
    const users =
      getUsers();

    const posts =
      getPosts();

    const comments =
      readJSON(
        COMMENTS_FILE
      );

    const follows =
      readJSON(
        FOLLOWS_FILE
      );

    res.json({
      success: true,

      stats: {
        users:
          users.length,

        posts:
          posts.length,

        comments:
          comments.length,

        follows:
          follows.length,

        verifiedUsers:
          users.filter(
            user =>
              user.verified
          ).length
      }
    });
  }
);

app.get(
  "/api/admin/users",
  requireAdmin,
  (req, res) => {
    const users =
      getUsers().map(
        user => ({
          ...safeUser(user),

          followersCount:
            followersCount(
              user.id
            ),

          followingCount:
            followingCount(
              user.id
            )
        })
      );

    res.json({
      success: true,
      users
    });
  }
);

app.get(
  "/api/admin/verification/requests",
  requireAdmin,
  (req, res) => {
    const requests =
      readJSON(
        VERIFICATION_FILE
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
          request => ({
            ...request,

            user:
              safeUser(
                getUserById(
                  request.userId
                )
              )
          })
        );

    res.json({
      success: true,
      requests
    });
  }
);

/* =========================================================
   APPROVE VERIFICATION
========================================================= */

app.post(
  "/api/admin/verification/:requestId/approve",
  requireAdmin,
  (req, res) => {
    const requests =
      readJSON(
        VERIFICATION_FILE
      );

    const index =
      requests.findIndex(
        request =>
          String(
            request.id
          ) ===
          String(
            req.params.requestId
          )
      );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message:
          "Verification request not found."
      });
    }

    const request =
      requests[index];

    request.status =
      "approved";

    request.updatedAt =
      now();

    request.reviewedBy =
      req.user.id;

    writeJSON(
      VERIFICATION_FILE,
      requests
    );

    const users =
      getUsers();

    const userIndex =
      users.findIndex(
        user =>
          String(user.id) ===
          String(request.userId)
      );

    if (userIndex >= 0) {
      users[userIndex]
        .verified = true;

      users[userIndex]
        .isVerified = true;

      users[userIndex]
        .verificationStatus =
        "approved";

      writeJSON(
        USERS_FILE,
        users
      );

      createNotification({
        userId:
          users[userIndex].id,
        actorId:
          req.user.id,
        type:
          "verification",
        text:
          "Your account has been verified."
      });
    }

    res.json({
      success: true,
      message:
        "Verification approved."
    });
  }
);

/* =========================================================
   REJECT VERIFICATION
========================================================= */

app.post(
  "/api/admin/verification/:requestId/reject",
  requireAdmin,
  (req, res) => {
    const requests =
      readJSON(
        VERIFICATION_FILE
      );

    const index =
      requests.findIndex(
        request =>
          String(
            request.id
          ) ===
          String(
            req.params.requestId
          )
      );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message:
          "Verification request not found."
      });
    }

    const request =
      requests[index];

    request.status =
      "rejected";

    request.updatedAt =
      now();

    request.reviewedBy =
      req.user.id;

    writeJSON(
      VERIFICATION_FILE,
      requests
    );

    const users =
      getUsers();

    const userIndex =
      users.findIndex(
        user =>
          String(user.id) ===
          String(request.userId)
      );

    if (userIndex >= 0) {
      users[userIndex]
        .verificationStatus =
        "rejected";

      writeJSON(
        USERS_FILE,
        users
      );

      createNotification({
        userId:
          users[userIndex].id,
        actorId:
          req.user.id,
        type:
          "verification",
        text:
          "Your verification request was not approved."
      });
    }

    res.json({
      success: true,
      message:
        "Verification rejected."
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
    res.sendFile(
      path.join(
        PUBLIC_DIR,
        "admin.html"
      )
    );
  }
);

app.get(
  "/admin-verification.html",
  requireAdmin,
  (req, res) => {
    res.sendFile(
      path.join(
        PUBLIC_DIR,
        "admin-verification.html"
      )
    );
  }
);

/* =========================================================
   API 404
========================================================= */

app.use(
  "/api",
  (req, res) => {
    res.status(404).json({
      success: false,
      message:
        "API endpoint not found."
    });
  }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  (error, req, res, next) => {
    console.error(
      "SERVER ERROR:",
      error
    );

    if (
      error instanceof
      multer.MulterError
    ) {
      return res.status(400).json({
        success: false,
        message:
          error.message
      });
    }

    if (
      error.message &&
      (
        error.message.includes(
          "Only JPG"
        )
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          error.message
      });
    }

    res.status(500).json({
      success: false,
      message:
        "Something went wrong on the server."
    });
  }
);

/* =========================================================
   START
========================================================= */

app.listen(
  PORT,
  HOST,
  () => {
    console.log("");
    console.log(
      "=============================================="
    );
    console.log(
      "        PULSE SOCIAL SERVER ONLINE"
    );
    console.log(
      "=============================================="
    );
    console.log(
      `Local: http://localhost:${PORT}`
    );
    console.log(
      `Host:  ${HOST}`
    );
    console.log(
      "Storage: JSON"
    );
    console.log(
      "Cover Photos: ENABLED"
    );
    console.log(
      "Messaging: ENABLED"
    );
    console.log(
      "Message Images: ENABLED"
    );
    console.log(
      "=============================================="
    );
    console.log("");
  }
);